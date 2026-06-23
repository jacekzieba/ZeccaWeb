import {
  resolveFxRate,
  resolveInstrumentPrice,
  type FxRateInput,
  type FxTransactionInput,
  type MarketQuoteInput,
  type ManualValuationInput,
  type PriceTransactionInput,
} from "@/domain/valuation/price-resolver";
import { bondPeriodRate } from "@/domain/valuation/bond-rates";

export type { FxRateInput } from "@/domain/valuation/price-resolver";

const EPSILON = 0.000001;

export type BondParamsInput = {
  maturityDate: Date;
  nominalValue: number;
  firstPeriodRate: number;
  subsequentBase: string;
  marginOverBase: number;
  capitalization: string;
  interestPayment: string;
};

export type OpenLotInput = {
  purchaseDate: Date;
  quantity: number;
};

export type PositionAssetInput = {
  kind: string;
  currency: string;
  bondParams?: BondParamsInput | null;
};

export type ValuationTransactionInput = PriceTransactionInput & FxTransactionInput;

export type PositionValuationDataset = {
  manualValuations: ManualValuationInput[];
  marketQuotes: MarketQuoteInput[];
  transactions: ValuationTransactionInput[];
  fxRates: FxRateInput[];
  useLatestTransactionFxRate?: boolean;
};

export type PositionValuation = {
  price: number;
  currency: string;
  priceDate: Date | null;
  source: "manual" | "market" | "transaction" | "treasuryBond" | "missing";
  sourceLabel: string;
  marketValue: number;
};

export function valueCashBalances(
  cashBalances: Iterable<[string, number]>,
  dataset: Pick<PositionValuationDataset, "transactions" | "fxRates">,
  asOf: Date,
) {
  let value = 0;

  for (const [currency, balance] of cashBalances) {
    value += balance * fxRateForCurrency(currency, dataset, asOf);
  }

  return value;
}

export function valueInstrumentPosition(input: {
  instrumentID: string;
  quantity: number;
  asset?: PositionAssetInput;
  lots: OpenLotInput[];
  dataset: PositionValuationDataset;
  asOf: Date;
  /**
   * When true, treasury bonds are valued by their accrual formula and any
   * explicit manual valuation / market quote is ignored. Used for the
   * day-over-day change so a bond's 1D move reflects real daily interest
   * accrual rather than the flat step between sparse manual valuations.
   */
  bondsUseFormula?: boolean;
}): PositionValuation {
  const { instrumentID, quantity, asset, lots, dataset, asOf, bondsUseFormula } =
    input;

  if (asset?.kind === "treasuryBond" && asset.bondParams) {
    const explicitPrice = bondsUseFormula
      ? null
      : resolveInstrumentPrice(
          instrumentID,
          {
            assetCurrency: asset.currency,
            manualValuations: dataset.manualValuations,
            marketQuotes: dataset.marketQuotes,
            transactions: [],
          },
          asOf,
        );

    if (explicitPrice && explicitPrice.source !== "missing") {
      return {
        price: explicitPrice.value,
        currency: explicitPrice.currency,
        priceDate: explicitPrice.date,
        source: explicitPrice.source,
        sourceLabel: priceSourceLabel(explicitPrice.source),
        marketValue:
          quantity *
          explicitPrice.value *
          fxRateForCurrency(explicitPrice.currency, dataset, asOf),
      };
    }

    const marketValue = lots.reduce(
      (sum, lot) =>
        sum +
        lot.quantity *
          dirtyTreasuryBondPrice(asset.bondParams!, lot.purchaseDate, asOf),
      0,
    );
    const price = quantity > EPSILON ? marketValue / quantity : 0;

    return {
      price,
      currency: asset.currency,
      priceDate: asOf,
      source: "treasuryBond",
      sourceLabel: "Obligacja skarbowa",
      marketValue: marketValue * fxRateForCurrency(asset.currency, dataset, asOf),
    };
  }

  const price = resolveInstrumentPrice(
    instrumentID,
    {
      assetCurrency: asset?.currency,
      manualValuations: dataset.manualValuations,
      marketQuotes: dataset.marketQuotes,
      transactions: dataset.transactions,
    },
    asOf,
  );

  return {
    price: price.value,
    currency: price.currency,
    priceDate: price.date,
    source: price.source,
    sourceLabel: priceSourceLabel(price.source),
    marketValue:
      quantity * price.value * fxRateForCurrency(price.currency, dataset, asOf),
  };
}

function priceSourceLabel(source: PositionValuation["source"]) {
  switch (source) {
    case "manual":
      return "Wycena ręczna";
    case "market":
      return "Cena rynkowa";
    case "transaction":
      return "Cena transakcyjna";
    case "treasuryBond":
      return "Obligacja skarbowa";
    case "missing":
      return "Brak ceny";
  }
}

function fxRateForCurrency(
  currency: string,
  dataset: Pick<
    PositionValuationDataset,
    "transactions" | "fxRates" | "useLatestTransactionFxRate"
  >,
  asOf: Date,
) {
  return resolveFxRate(currency, dataset.transactions, asOf, dataset.fxRates, {
    latestTransactionRate: dataset.useLatestTransactionFxRate,
  }).rate;
}

function dirtyTreasuryBondPrice(
  params: BondParamsInput,
  purchaseDate: Date,
  asOf: Date,
) {
  const effectiveAsOf =
    asOf.getTime() < params.maturityDate.getTime() ? asOf : params.maturityDate;
  if (effectiveAsOf.getTime() <= purchaseDate.getTime()) {
    return params.nominalValue;
  }

  let periodStart = purchaseDate;
  let periodIndex = 0;
  let principal = params.nominalValue;
  let carriedInterest = 0;

  while (periodStart.getTime() < effectiveAsOf.getTime()) {
    const periodEnd = addYears(periodStart, 1);
    const annualRate = bondPeriodRate(params, periodIndex, periodStart) / 100;

    if (effectiveAsOf.getTime() < periodEnd.getTime()) {
      const totalDays = Math.max(1, daysBetween(periodStart, periodEnd));
      const elapsedDays = Math.max(0, daysBetween(periodStart, effectiveAsOf));
      const accrued = principal * annualRate * Math.min(elapsedDays / totalDays, 1);
      return principal + carriedInterest + accrued;
    }

    const fullPeriodInterest = principal * annualRate;
    if (params.interestPayment === "przy wykupie") {
      if (params.capitalization === "roczna") {
        principal += fullPeriodInterest;
      } else {
        carriedInterest += fullPeriodInterest;
      }
    }

    periodStart = periodEnd;
    periodIndex += 1;
  }

  return principal + carriedInterest;
}

function addYears(date: Date, years: number) {
  const copy = new Date(date);
  copy.setUTCFullYear(copy.getUTCFullYear() + years);
  return copy;
}

function daysBetween(start: Date, end: Date) {
  return (end.getTime() - start.getTime()) / 86_400_000;
}
