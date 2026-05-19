export type PriceSource = "manual" | "transaction" | "missing";

export type FxRateSource = "pln" | "history" | "transaction" | "fxConversion" | "missing";

export type DatedValue = {
  date: Date;
};

export type ManualValuationInput = DatedValue & {
  instrumentID: string;
  value: number;
  currency: string;
};

export type PriceTransactionInput = DatedValue & {
  instrumentID?: string | null;
  price?: number | null;
  currency: string;
};

export type FxTransactionInput = DatedValue & {
  transactionType: string;
  currency: string;
  grossAmount: number;
  fxRateToBase?: number | null;
  targetCurrency?: string | null;
  targetGrossAmount?: number | null;
};

export type FxRateInput = DatedValue & {
  currency: string;
  rate: number;
};

export type InstrumentPrice = {
  value: number;
  currency: string;
  date: Date | null;
  source: PriceSource;
};

export type FxRateResolution = {
  rate: number;
  date: Date | null;
  source: FxRateSource;
};

const EPSILON = 0.000001;

export function resolveInstrumentPrice(
  instrumentID: string,
  input: {
    assetCurrency?: string | null;
    manualValuations: ManualValuationInput[];
    transactions: PriceTransactionInput[];
  },
  valuationDate: Date,
): InstrumentPrice {
  const manualValuation = latestBeforeOrOn(
    input.manualValuations.filter(
      (valuation) =>
        valuation.instrumentID === instrumentID &&
        valuation.value > EPSILON &&
        valuation.date.getTime() <= valuationDate.getTime(),
    ),
  );

  if (manualValuation) {
    return {
      value: manualValuation.value,
      currency: manualValuation.currency,
      date: manualValuation.date,
      source: "manual",
    };
  }

  const pricedTransaction = latestBeforeOrOn(
    input.transactions.filter(
      (transaction) =>
        transaction.instrumentID === instrumentID &&
        (transaction.price ?? 0) > EPSILON &&
        transaction.date.getTime() <= valuationDate.getTime(),
    ),
  );

  if (pricedTransaction?.price) {
    return {
      value: pricedTransaction.price,
      currency: pricedTransaction.currency,
      date: pricedTransaction.date,
      source: "transaction",
    };
  }

  return {
    value: 0,
    currency: input.assetCurrency ?? "PLN",
    date: null,
    source: "missing",
  };
}

export function resolveFxRate(
  currency: string,
  transactions: FxTransactionInput[],
  valuationDate: Date,
  history: FxRateInput[] = [],
): FxRateResolution {
  if (currency === "PLN") {
    return { rate: 1, date: valuationDate, source: "pln" };
  }

  const historicalRate = latestBeforeOrOn(
    history.filter(
      (rate) =>
        rate.currency === currency &&
        rate.rate > EPSILON &&
        rate.date.getTime() <= valuationDate.getTime(),
    ),
  );

  if (historicalRate) {
    return {
      rate: historicalRate.rate,
      date: historicalRate.date,
      source: "history",
    };
  }

  const directRate = latestBeforeOrOn(
    transactions.filter(
      (transaction) =>
        transaction.currency === currency &&
        (transaction.fxRateToBase ?? 0) > EPSILON &&
        transaction.date.getTime() <= valuationDate.getTime(),
    ),
  );

  if (directRate?.fxRateToBase) {
    return {
      rate: directRate.fxRateToBase,
      date: directRate.date,
      source: "transaction",
    };
  }

  const conversionRate = latestBeforeOrOn(
    transactions.filter(
      (transaction) =>
        transaction.transactionType === "fxConversion" &&
        transaction.currency === currency &&
        transaction.targetCurrency === "PLN" &&
        transaction.grossAmount > EPSILON &&
        (transaction.targetGrossAmount ?? 0) > EPSILON &&
        transaction.date.getTime() <= valuationDate.getTime(),
    ),
  );

  if (conversionRate?.targetGrossAmount) {
    return {
      rate: conversionRate.targetGrossAmount / conversionRate.grossAmount,
      date: conversionRate.date,
      source: "fxConversion",
    };
  }

  const inverseConversionRate = latestBeforeOrOn(
    transactions.filter(
      (transaction) =>
        transaction.transactionType === "fxConversion" &&
        transaction.currency === "PLN" &&
        transaction.targetCurrency === currency &&
        transaction.grossAmount > EPSILON &&
        (transaction.targetGrossAmount ?? 0) > EPSILON &&
        transaction.date.getTime() <= valuationDate.getTime(),
    ),
  );

  if (inverseConversionRate?.targetGrossAmount) {
    return {
      rate: inverseConversionRate.grossAmount / inverseConversionRate.targetGrossAmount,
      date: inverseConversionRate.date,
      source: "fxConversion",
    };
  }

  return { rate: 1, date: null, source: "missing" };
}

function latestBeforeOrOn<TValue extends DatedValue>(values: TValue[]) {
  return values.reduce<TValue | null>(
    (latest, value) =>
      !latest || value.date.getTime() > latest.date.getTime() ? value : latest,
    null,
  );
}
