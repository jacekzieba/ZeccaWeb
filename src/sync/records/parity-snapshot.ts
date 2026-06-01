import type {
  HoldingRow,
  InstrumentRow,
  InvestorDataSnapshot,
  PortfolioDetail,
  TransactionRow,
} from "@/domain/models/investor-data";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";
import {
  buildInstrumentList,
  buildInvestorDataSnapshot,
  buildPortfolioDetail,
  buildTransactionList,
  type SnapshotBuildOptions,
} from "@/sync/records/investor-snapshot";
import {
  summarizeDecryptedRecords,
  type SyncRecordSummary,
} from "@/sync/records/sync-summary";

export type ParitySnapshot = {
  schema: "investor-web-parity-snapshot/v1";
  recordSummary: Omit<SyncRecordSummary, "decryptedAt">;
  totals: {
    asOf: string;
    totalValue: number;
    cash: number;
    monthlyChange: number;
    income: InvestorDataSnapshot["income"];
    valuationPointCount: number;
    firstValuationPoint: InvestorDataSnapshot["valuationSeries"][number] | null;
    lastValuationPoint: InvestorDataSnapshot["valuationSeries"][number] | null;
  };
  portfolios: Array<{
    id: string;
    name: string;
    baseCurrency: string;
    value: number;
    positions: number;
    cashValue: number;
    holdings: HoldingRow[];
    cashBalances: PortfolioDetail["cashBalances"];
  }>;
  instruments: InstrumentRow[];
  transactions: TransactionRow[];
};

export function buildParitySnapshot(
  records: DecryptedRecord[],
  options: SnapshotBuildOptions = {},
): ParitySnapshot {
  const snapshot = buildInvestorDataSnapshot(records, options);
  const summary = summarizeDecryptedRecords(records);
  const transactions = buildTransactionList(records);
  const instruments = buildInstrumentList(records, options);
  const portfolios = snapshot.portfolios.map((portfolio) => {
    const detail = buildPortfolioDetail(records, portfolio.id, options);

    return {
      id: portfolio.id,
      name: portfolio.name,
      baseCurrency: portfolio.baseCurrency,
      value: roundMoney(portfolio.value),
      positions: portfolio.positions,
      cashValue: roundMoney(detail?.cashValue ?? 0),
      holdings: sortByString(
        (detail?.holdings ?? []).map(normalizeHolding),
        (holding) => holding.instrumentId,
      ),
      cashBalances: sortByString(
        (detail?.cashBalances ?? []).map((balance) => ({
          ...balance,
          amount: roundMoney(balance.amount),
        })),
        (balance) => balance.currency,
      ),
    };
  });

  return {
    schema: "investor-web-parity-snapshot/v1",
    recordSummary: {
      totalRecords: summary.totalRecords,
      latestUpdatedAt: summary.latestUpdatedAt,
      byType: summary.byType,
    },
    totals: {
      asOf: snapshot.asOf,
      totalValue: roundMoney(snapshot.totalValue),
      cash: roundMoney(snapshot.cash),
      monthlyChange: roundPercent(snapshot.monthlyChange),
      income: {
        earningCount: snapshot.income.earningCount,
        burdenCount: snapshot.income.burdenCount,
        earningsPLN: roundMoney(snapshot.income.earningsPLN),
        burdensPLN: roundMoney(snapshot.income.burdensPLN),
        netPLN: roundMoney(snapshot.income.netPLN),
      },
      valuationPointCount: snapshot.valuationSeries.length,
      firstValuationPoint: normalizeValuationPoint(snapshot.valuationSeries[0]),
      lastValuationPoint: normalizeValuationPoint(snapshot.valuationSeries.at(-1)),
    },
    portfolios: sortByString(portfolios, (portfolio) => portfolio.id),
    instruments: sortByString(instruments.map(normalizeInstrument), (instrument) => instrument.id),
    transactions: sortByString(
      transactions.map(normalizeTransaction),
      (transaction) => transaction.id,
    ),
  };
}

function normalizeValuationPoint(
  point: InvestorDataSnapshot["valuationSeries"][number] | undefined,
) {
  if (!point) return null;

  return {
    ...point,
    value: roundMoney(point.value),
  };
}

function normalizeHolding(holding: HoldingRow): HoldingRow {
  return {
    ...holding,
    quantity: roundQuantity(holding.quantity),
    lastPrice: roundMoney(holding.lastPrice),
    marketValue: roundMoney(holding.marketValue),
    portfolioPercent: roundPercent(holding.portfolioPercent),
  };
}

function normalizeInstrument(instrument: InstrumentRow): InstrumentRow {
  return {
    ...instrument,
    lastPrice: roundMoney(instrument.lastPrice),
    totalQuantity: roundQuantity(instrument.totalQuantity),
    marketValue: roundMoney(instrument.marketValue),
    portfolios: [...instrument.portfolios].sort((a, b) => a.localeCompare(b)),
  };
}

function normalizeTransaction(transaction: TransactionRow): TransactionRow {
  return {
    ...transaction,
    quantity: transaction.quantity == null ? null : roundQuantity(transaction.quantity),
    price: transaction.price == null ? null : roundMoney(transaction.price),
    grossAmount: roundMoney(transaction.grossAmount),
    fees: roundMoney(transaction.fees),
    taxes: roundMoney(transaction.taxes),
  };
}

function roundMoney(value: number) {
  return round(value, 2);
}

function roundPercent(value: number) {
  return round(value, 4);
}

function roundQuantity(value: number) {
  return round(value, 8);
}

function round(value: number, digits: number) {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function sortByString<T>(items: T[], getKey: (item: T) => string) {
  return [...items].sort((a, b) => getKey(a).localeCompare(getKey(b)));
}
