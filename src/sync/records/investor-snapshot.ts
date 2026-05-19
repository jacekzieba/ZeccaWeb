import { z } from "zod";
import type {
  AllocationSlice,
  CashBalance,
  HoldingRow,
  InstrumentRow,
  InvestorDataSnapshot,
  PortfolioDetail,
  PortfolioSummary,
  TransactionRow,
} from "@/domain/models/investor-data";
import {
  resolveFxRate,
  resolveInstrumentPrice,
  type FxRateInput,
} from "@/domain/valuation/price-resolver";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";

const APPLE_REFERENCE_DATE_UNIX_MS = Date.UTC(2001, 0, 1);
const EPSILON = 0.000001;

const swiftDateSchema = z.union([z.number(), z.string()]);

const accountPayloadSchema = z.object({
  recordType: z.literal("account"),
  id: z.string().uuid(),
  name: z.string(),
  baseCurrency: z.string().min(1),
});

const assetPayloadSchema = z.object({
  recordType: z.literal("asset"),
  id: z.string().uuid(),
  kind: z.string(),
  symbol: z.string(),
  name: z.string(),
  currency: z.string().min(1),
  category: z.string().nullable().optional(),
});

const transferLotSchema = z.object({
  acquisitionDate: swiftDateSchema,
  quantity: z.number(),
  unitCost: z.number(),
  currency: z.string(),
  fxRateToBase: z.number().nullable().optional(),
});

const transactionPayloadSchema = z.object({
  recordType: z.literal("transaction"),
  id: z.string().uuid(),
  date: swiftDateSchema,
  portfolioID: z.string().uuid(),
  instrumentID: z.string().uuid().nullable().optional(),
  transactionType: z.string(),
  quantity: z.number().nullable().optional(),
  price: z.number().nullable().optional(),
  grossAmount: z.number(),
  currency: z.string().min(1),
  fees: z.number(),
  taxes: z.number(),
  fxRateToBase: z.number().nullable().optional(),
  targetCurrency: z.string().nullable().optional(),
  targetGrossAmount: z.number().nullable().optional(),
  transferKind: z.string().nullable().optional(),
  transferLots: z.array(transferLotSchema).nullable().optional(),
});

const manualValuationPayloadSchema = z.object({
  recordType: z.literal("manualValuation"),
  id: z.string().uuid(),
  instrumentID: z.string().uuid(),
  date: swiftDateSchema,
  value: z.number(),
  currency: z.string().min(1),
});

const settingsPayloadSchema = z.object({
  recordType: z.literal("settings"),
  id: z.string().uuid().optional(),
  baseCurrency: z.string().min(1).optional(),
  updatedAt: swiftDateSchema.optional(),
});

type AccountPayload = z.infer<typeof accountPayloadSchema>;
type AssetPayload = z.infer<typeof assetPayloadSchema>;
type TransactionPayload = z.infer<typeof transactionPayloadSchema>;
type ManualValuationPayload = z.infer<typeof manualValuationPayloadSchema>;
type SettingsPayload = z.infer<typeof settingsPayloadSchema>;

type Ledger = {
  positions: Map<string, number>;
  cashBalances: Map<string, number>;
};

type ParsedDataset = {
  accounts: AccountPayload[];
  assets: AssetPayload[];
  transactions: TransactionPayload[];
  manualValuations: ManualValuationPayload[];
  settings: SettingsPayload[];
  fxRates: FxRateInput[];
};

export type SnapshotBuildOptions = {
  fxRates?: FxRateInput[];
};

type PortfolioValuation = {
  totalValue: number;
  cashValue: number;
  positionCount: number;
  allocationValues: Map<string, number>;
};

export function buildInvestorDataSnapshot(
  records: DecryptedRecord[],
  options: SnapshotBuildOptions = {},
): InvestorDataSnapshot {
  const dataset = parseDataset(records, options);
  const baseCurrency = getBaseCurrency(dataset);
  const asOf = getAsOf(records, dataset);
  const accounts = getAccounts(dataset, baseCurrency);
  const portfolios = accounts.map((account) =>
    buildPortfolioSummary(account, dataset, asOf),
  );
  const totalValue = portfolios.reduce(
    (sum, portfolio) => sum + portfolio.value,
    0,
  );
  const cash = accounts.reduce((sum, account) => {
    const transactions = transactionsForPortfolio(dataset.transactions, account.id);
    const ledger = computeLedger(transactions, asOf);
    return sum + valueCash(ledger, dataset, asOf);
  }, 0);
  const valuationSeries = buildValuationSeries(accounts, dataset, asOf);
  const monthlyChange = calculateMonthlyChange(valuationSeries);

  return {
    asOf: asOf.toISOString(),
    totalValue,
    monthlyChange,
    cash,
    portfolios,
    valuationSeries,
    allocation: buildAllocation(accounts, dataset, asOf, totalValue),
  };
}

function parseDataset(
  records: DecryptedRecord[],
  options: SnapshotBuildOptions = {},
): ParsedDataset {
  const dataset: ParsedDataset = {
    accounts: [],
    assets: [],
    transactions: [],
    manualValuations: [],
    settings: [],
    fxRates: options.fxRates ?? [],
  };

  for (const record of records) {
    if (record.deletedAt) {
      continue;
    }

    switch (record.envelope.type) {
      case "account":
        dataset.accounts.push(accountPayloadSchema.parse(record.envelope.payload));
        break;
      case "asset":
        dataset.assets.push(assetPayloadSchema.parse(record.envelope.payload));
        break;
      case "transaction":
        dataset.transactions.push(
          transactionPayloadSchema.parse(record.envelope.payload),
        );
        break;
      case "manualValuation":
        dataset.manualValuations.push(
          manualValuationPayloadSchema.parse(record.envelope.payload),
        );
        break;
      case "settings":
        dataset.settings.push(settingsPayloadSchema.parse(record.envelope.payload));
        break;
      case "income":
        break;
    }
  }

  dataset.transactions.sort(
    (left, right) =>
      toDate(left.date).getTime() - toDate(right.date).getTime(),
  );
  dataset.manualValuations.sort(
    (left, right) =>
      toDate(left.date).getTime() - toDate(right.date).getTime(),
  );

  return dataset;
}

function getBaseCurrency(dataset: ParsedDataset) {
  return (
    dataset.settings
      .filter((settings) => settings.baseCurrency)
      .sort(
        (left, right) =>
          toDate(left.updatedAt ?? 0).getTime() -
          toDate(right.updatedAt ?? 0).getTime(),
      )
      .at(-1)?.baseCurrency ??
    dataset.accounts[0]?.baseCurrency ??
    "PLN"
  );
}

function getAsOf(records: DecryptedRecord[], dataset: ParsedDataset) {
  const dates = [
    ...records.map((record) => new Date(record.updatedAt)),
    ...dataset.transactions.map((transaction) => toDate(transaction.date)),
    ...dataset.manualValuations.map((valuation) => toDate(valuation.date)),
  ].filter((date) => !Number.isNaN(date.getTime()));

  if (dates.length === 0) {
    return new Date();
  }

  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

function getAccounts(dataset: ParsedDataset, baseCurrency: string) {
  if (dataset.accounts.length > 0) {
    return dataset.accounts;
  }

  return [
    {
      recordType: "account" as const,
      id: "00000000-0000-4000-8000-000000000000",
      name: "Portfel",
      baseCurrency,
    },
  ];
}

function buildPortfolioSummary(
  account: AccountPayload,
  dataset: ParsedDataset,
  asOf: Date,
): PortfolioSummary {
  const transactions = transactionsForPortfolio(dataset.transactions, account.id);
  const valuation = valuePortfolio(computeLedger(transactions, asOf), dataset, asOf);

  return {
    id: account.id,
    name: account.name,
    baseCurrency: account.baseCurrency,
    value: valuation.totalValue,
    dailyChange: 0,
    positions: valuation.positionCount,
  };
}

function transactionsForPortfolio(
  transactions: TransactionPayload[],
  portfolioID: string,
) {
  return transactions.filter(
    (transaction) => transaction.portfolioID === portfolioID,
  );
}

function computeLedger(transactions: TransactionPayload[], asOf: Date): Ledger {
  const ledger: Ledger = {
    positions: new Map(),
    cashBalances: new Map(),
  };

  for (const transaction of transactions) {
    if (toDate(transaction.date).getTime() > asOf.getTime()) {
      continue;
    }

    applyTransaction(ledger, transaction);
  }

  return ledger;
}

function applyTransaction(ledger: Ledger, transaction: TransactionPayload) {
  const type = transaction.transactionType;
  const grossAmount = transaction.grossAmount;
  const fees = transaction.fees;
  const taxes = transaction.taxes;
  const currency = transaction.currency;
  const fxRate = transaction.fxRateToBase;

  switch (type) {
    case "cashDeposit":
    case "transferIn":
      addCash(ledger, currency, grossAmount);
      break;
    case "accountTransferIn":
      if (transaction.transferKind === "asset") {
        addAssetTransfer(ledger, transaction);
      } else {
        addCash(ledger, currency, grossAmount);
      }
      break;
    case "cashWithdrawal":
    case "transferOut":
      addCash(ledger, currency, -grossAmount);
      break;
    case "buy":
      addCashForTrade(ledger, transaction, -(grossAmount + fees));
      addPosition(ledger, transaction.instrumentID, transaction.quantity ?? 0);
      break;
    case "sell":
      addCashForTrade(ledger, transaction, grossAmount - fees - taxes);
      addPosition(ledger, transaction.instrumentID, -(transaction.quantity ?? 0));
      break;
    case "dividend":
    case "interest":
    case "bondCoupon":
      addCash(ledger, currency, grossAmount - fees - taxes);
      break;
    case "bondRedemption":
      addCash(ledger, currency, grossAmount - fees - taxes);
      addPosition(ledger, transaction.instrumentID, -(transaction.quantity ?? 0));
      break;
    case "depositOpen":
      addCash(ledger, currency, -grossAmount);
      addPosition(ledger, transaction.instrumentID, 1);
      break;
    case "depositClose":
      addCash(ledger, currency, grossAmount - fees - taxes);
      addPosition(ledger, transaction.instrumentID, -(transaction.quantity ?? 1));
      break;
    case "fee":
    case "tax":
      addCash(ledger, currency, -grossAmount);
      break;
    case "fxConversion":
      addCash(ledger, currency, -grossAmount);
      if (transaction.targetCurrency && transaction.targetGrossAmount) {
        addCash(
          ledger,
          transaction.targetCurrency,
          transaction.targetGrossAmount,
        );
      } else if (fxRate) {
        addCash(ledger, "PLN", grossAmount * fxRate);
      }
      break;
    case "correction":
      addCash(ledger, currency, grossAmount);
      break;
  }
}

function addAssetTransfer(ledger: Ledger, transaction: TransactionPayload) {
  const instrumentID = transaction.instrumentID;
  if (!instrumentID) {
    return;
  }

  const lots = transaction.transferLots ?? [];
  const quantity =
    lots.length > 0
      ? lots.reduce((sum, lot) => sum + lot.quantity, 0)
      : transaction.quantity ?? 0;

  addPosition(ledger, instrumentID, quantity);
}

function addCashForTrade(
  ledger: Ledger,
  transaction: TransactionPayload,
  amount: number,
) {
  addCash(ledger, transaction.currency, amount);
}

function addCash(ledger: Ledger, currency: string, amount: number) {
  ledger.cashBalances.set(currency, (ledger.cashBalances.get(currency) ?? 0) + amount);
}

function addPosition(
  ledger: Ledger,
  instrumentID: string | null | undefined,
  quantity: number,
) {
  if (!instrumentID || Math.abs(quantity) <= EPSILON) {
    return;
  }

  ledger.positions.set(
    instrumentID,
    (ledger.positions.get(instrumentID) ?? 0) + quantity,
  );
}

function valuePortfolio(
  ledger: Ledger,
  dataset: ParsedDataset,
  asOf: Date,
): PortfolioValuation {
  const assetsByID = new Map(dataset.assets.map((asset) => [asset.id, asset]));
  const allocationValues = new Map<string, number>();
  let holdingsValue = 0;
  let positionCount = 0;

  for (const [instrumentID, quantity] of ledger.positions) {
    if (quantity <= EPSILON) {
      continue;
    }

    const asset = assetsByID.get(instrumentID);
    const price = latestPriceForInstrument(instrumentID, dataset, asOf);
    const marketValue =
      quantity * price.value * fxRateForCurrency(price.currency, dataset, asOf);

    if (marketValue <= EPSILON) {
      continue;
    }

    holdingsValue += marketValue;
    positionCount += 1;
    const assetClass = assetClassLabel(asset?.kind);
    allocationValues.set(
      assetClass,
      (allocationValues.get(assetClass) ?? 0) + marketValue,
    );
  }

  const cashValue = valueCash(ledger, dataset, asOf);

  if (cashValue > EPSILON) {
    allocationValues.set(
      "Gotówka",
      (allocationValues.get("Gotówka") ?? 0) + cashValue,
    );
  }

  return {
    totalValue: holdingsValue + cashValue,
    cashValue,
    positionCount,
    allocationValues,
  };
}

function valueCash(
  ledger: Ledger,
  dataset: Pick<ParsedDataset, "transactions" | "fxRates">,
  asOf: Date,
) {
  let value = 0;

  for (const [currency, balance] of ledger.cashBalances) {
    value += balance * fxRateForCurrency(currency, dataset, asOf);
  }

  return value;
}

function latestPriceForInstrument(
  instrumentID: string,
  dataset: ParsedDataset,
  asOf: Date,
) {
  const asset = dataset.assets.find((candidate) => candidate.id === instrumentID);
  return resolveInstrumentPrice(
    instrumentID,
    {
      assetCurrency: asset?.currency,
      manualValuations: dataset.manualValuations.map((valuation) => ({
        instrumentID: valuation.instrumentID,
        value: valuation.value,
        currency: valuation.currency,
        date: toDate(valuation.date),
      })),
      transactions: dataset.transactions.map((transaction) => ({
        instrumentID: transaction.instrumentID,
        price: transaction.price,
        currency: transaction.currency,
        date: toDate(transaction.date),
      })),
    },
    asOf,
  );
}

function fxRateForCurrency(
  currency: string,
  dataset: Pick<ParsedDataset, "transactions" | "fxRates">,
  asOf: Date,
) {
  return resolveFxRate(
    currency,
    dataset.transactions.map((transaction) => ({
      transactionType: transaction.transactionType,
      currency: transaction.currency,
      grossAmount: transaction.grossAmount,
      fxRateToBase: transaction.fxRateToBase,
      targetCurrency: transaction.targetCurrency,
      targetGrossAmount: transaction.targetGrossAmount,
      date: toDate(transaction.date),
    })),
    asOf,
    dataset.fxRates,
  ).rate;
}

function buildAllocation(
  accounts: AccountPayload[],
  dataset: ParsedDataset,
  asOf: Date,
  totalValue: number,
): AllocationSlice[] {
  if (totalValue <= EPSILON) {
    return [];
  }

  const values = new Map<string, number>();

  for (const account of accounts) {
    const ledger = computeLedger(
      transactionsForPortfolio(dataset.transactions, account.id),
      asOf,
    );
    const valuation = valuePortfolio(ledger, dataset, asOf);

    for (const [label, value] of valuation.allocationValues) {
      values.set(label, (values.get(label) ?? 0) + value);
    }
  }

  return [...values.entries()]
    .filter(([, value]) => value > EPSILON)
    .sort(([, left], [, right]) => right - left)
    .map(([label, value]) => ({
      label,
      percent: (value / totalValue) * 100,
    }));
}

function buildValuationSeries(
  accounts: AccountPayload[],
  dataset: ParsedDataset,
  asOf: Date,
) {
  const dates = fullMonthEndDates(dataset, asOf);

  return dates.map((date) => {
    const value = accounts.reduce((sum, account) => {
      const ledger = computeLedger(
        transactionsForPortfolio(dataset.transactions, account.id),
        date,
      );
      return sum + valuePortfolio(ledger, dataset, date).totalValue;
    }, 0);

    return {
      label: monthLabel(date),
      date: date.toISOString(),
      value,
    };
  });
}

function fullMonthEndDates(dataset: ParsedDataset, asOf: Date): Date[] {
  const allDates = [
    ...dataset.transactions.map((t) => toDate(t.date)),
    ...dataset.manualValuations.map((v) => toDate(v.date)),
  ].filter((d) => !Number.isNaN(d.getTime()));

  if (allDates.length === 0) {
    return [asOf];
  }

  const earliest = new Date(Math.min(...allDates.map((d) => d.getTime())));
  const dates: Date[] = [];

  let year = earliest.getUTCFullYear();
  let month = earliest.getUTCMonth(); // month-end of earliest month

  while (true) {
    const monthEnd = new Date(Date.UTC(year, month + 1, 0));
    if (monthEnd >= asOf) {
      dates.push(asOf);
      break;
    }
    dates.push(monthEnd);
    month += 1;
    if (month > 11) { month = 0; year += 1; }
  }

  return dates;
}

function calculateMonthlyChange(
  valuationSeries: InvestorDataSnapshot["valuationSeries"],
) {
  const previous = valuationSeries.at(-2)?.value ?? 0;
  const current = valuationSeries.at(-1)?.value ?? 0;

  if (previous <= EPSILON) {
    return 0;
  }

  return ((current - previous) / previous) * 100;
}

function assetClassLabel(kind: string | undefined) {
  switch (kind) {
    case "stock":
    case "etf":
      return "Akcje / ETF";
    case "treasuryBond":
    case "listedBond":
      return "Obligacje";
    case "crypto":
      return "Kryptowaluty";
    case "deposit":
      return "Lokaty";
    case "cash":
      return "Gotówka";
    default:
      return "Inne aktywa";
  }
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("pl-PL", { month: "short" }).format(date);
}

function toDate(value: z.infer<typeof swiftDateSchema>) {
  if (typeof value === "number") {
    return new Date(APPLE_REFERENCE_DATE_UNIX_MS + value * 1000);
  }

  return new Date(value);
}

export function buildPortfolioDetail(
  records: DecryptedRecord[],
  portfolioId: string,
  options: SnapshotBuildOptions = {},
): PortfolioDetail | null {
  const dataset = parseDataset(records, options);
  const account = dataset.accounts.find((a) => a.id === portfolioId);
  if (!account) return null;

  const asOf = getAsOf(records, dataset);
  const transactions = transactionsForPortfolio(dataset.transactions, portfolioId);
  const ledger = computeLedger(transactions, asOf);
  const assetsByID = new Map(dataset.assets.map((a) => [a.id, a]));

  const holdings: HoldingRow[] = [];
  let holdingsValue = 0;

  for (const [instrumentId, quantity] of ledger.positions) {
    if (quantity <= EPSILON) continue;

    const asset = assetsByID.get(instrumentId);
    const price = latestPriceForInstrument(instrumentId, dataset, asOf);
    const marketValue =
      quantity * price.value * fxRateForCurrency(price.currency, dataset, asOf);

    if (marketValue <= EPSILON) continue;

    holdingsValue += marketValue;
    holdings.push({
      instrumentId,
      symbol: asset?.symbol ?? instrumentId.slice(0, 8),
      name: asset?.name ?? asset?.symbol ?? instrumentId.slice(0, 8),
      kind: asset?.kind ?? "unknown",
      quantity,
      lastPrice: price.value,
      currency: price.currency,
      marketValue,
      portfolioPercent: 0,
    });
  }

  const cashValue = valueCash(ledger, dataset, asOf);
  const totalValue = holdingsValue + cashValue;

  for (const h of holdings) {
    h.portfolioPercent = totalValue > EPSILON ? (h.marketValue / totalValue) * 100 : 0;
  }

  holdings.sort((a, b) => b.marketValue - a.marketValue);

  const cashBalances: CashBalance[] = [...ledger.cashBalances.entries()]
    .filter(([, amount]) => Math.abs(amount) > EPSILON)
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => b.amount - a.amount);

  const valuationSeries = buildValuationSeries([account], dataset, asOf);

  return {
    id: account.id,
    name: account.name,
    baseCurrency: account.baseCurrency,
    totalValue,
    cashValue,
    holdings,
    cashBalances,
    valuationSeries,
  };
}

export function buildTransactionList(records: DecryptedRecord[]): TransactionRow[] {
  const dataset = parseDataset(records);
  const accountsById = new Map(dataset.accounts.map((a) => [a.id, a]));
  const assetsById = new Map(dataset.assets.map((a) => [a.id, a]));

  return dataset.transactions
    .map((tx) => {
      const portfolio = accountsById.get(tx.portfolioID);
      const asset = tx.instrumentID ? assetsById.get(tx.instrumentID) : undefined;
      return {
        id: tx.id,
        date: toDate(tx.date).toISOString(),
        portfolioId: tx.portfolioID,
        portfolioName: portfolio?.name ?? tx.portfolioID.slice(0, 8),
        instrumentId: tx.instrumentID ?? null,
        instrumentSymbol: asset?.symbol ?? null,
        instrumentName: asset?.name ?? null,
        transactionType: tx.transactionType,
        quantity: tx.quantity ?? null,
        price: tx.price ?? null,
        grossAmount: tx.grossAmount,
        currency: tx.currency,
        fees: tx.fees,
        taxes: tx.taxes,
      } satisfies TransactionRow;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function buildInstrumentList(
  records: DecryptedRecord[],
  options: SnapshotBuildOptions = {},
): InstrumentRow[] {
  const dataset = parseDataset(records, options);
  const asOf = getAsOf(records, dataset);

  // Aggregate quantity held per instrument across all portfolios
  const quantityByInstrument = new Map<string, number>();
  const portfoliosByInstrument = new Map<string, Set<string>>();

  for (const account of dataset.accounts) {
    const txs = transactionsForPortfolio(dataset.transactions, account.id);
    const ledger = computeLedger(txs, asOf);
    for (const [instrumentId, qty] of ledger.positions) {
      if (qty <= EPSILON) continue;
      quantityByInstrument.set(instrumentId, (quantityByInstrument.get(instrumentId) ?? 0) + qty);
      const pfSet = portfoliosByInstrument.get(instrumentId) ?? new Set();
      pfSet.add(account.name);
      portfoliosByInstrument.set(instrumentId, pfSet);
    }
  }

  const rows: InstrumentRow[] = [];

  for (const asset of dataset.assets) {
    const totalQuantity = quantityByInstrument.get(asset.id) ?? 0;
    const price = latestPriceForInstrument(asset.id, dataset, asOf);
    const marketValue =
      totalQuantity * price.value * fxRateForCurrency(price.currency, dataset, asOf);

    rows.push({
      id: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      kind: asset.kind,
      currency: price.currency,
      lastPrice: price.value,
      lastPriceDate: price.date?.toISOString() ?? null,
      totalQuantity,
      marketValue,
      portfolios: [...(portfoliosByInstrument.get(asset.id) ?? [])],
    });
  }

  // Sort: held first (by market value), then unowned alphabetically
  return rows.sort((a, b) => {
    const aHeld = a.totalQuantity > EPSILON;
    const bHeld = b.totalQuantity > EPSILON;
    if (aHeld && !bHeld) return -1;
    if (!aHeld && bHeld) return 1;
    if (aHeld && bHeld) return b.marketValue - a.marketValue;
    return a.name.localeCompare(b.name, "pl");
  });
}
