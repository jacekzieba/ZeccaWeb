import type { DecryptedRecord } from "@/sync/records/encrypted-records";
import type { CpiSeries } from "@/domain/valuation/bond-rates";
import type { FxRateInput } from "@/domain/valuation/price-resolver";
import { makeRecord } from "./records";

// Adapter: scenariusz „złoty” z repo natywnego (Zecca/Tests/Fixtures/...) →
// rekordy synchronizacji, które web czyta tak samo jak dane z aplikacji Apple.
// Daty w fixturze to dni bez godziny; natywny test buduje je o północy.

export type GoldenTransaction = {
  date: string;
  instrumentSymbol?: string;
  type: string;
  quantity?: number;
  price?: number;
  grossAmount: number;
  currency: string;
  fees?: number;
  taxes?: number;
  fxRateToBase?: number;
  targetCurrency?: string;
  targetGrossAmount?: number;
  transferKind?: string;
  transferSourceKind?: string;
  contributionTreatment?: string;
  transferCostBasisMode?: string;
  transferLots?: {
    acquisitionDate: string;
    quantity: number;
    unitCost: number;
    currency: string;
    fxRateToBase?: number;
  }[];
};

export type GoldenScenario = {
  asOf: string;
  portfolio: { name: string; type: string };
  instruments: { symbol: string; kind: string; name: string; currency: string; category: string }[];
  transactions: GoldenTransaction[];
  latestPrices: Record<string, number>;
  previousPrices30d: Record<string, number>;
  latestFX: Record<string, number>;
  priceHistory: Record<string, { date: string; close: number }[]>;
  fxHistory: Record<string, { date: string; rate: number }[]>;
  cpiHistory: { date: string; yoyRate: number }[];
  // Oczekiwane liczby mają różne kształty (liczby, słowniki, tablice) — testy je rzutują.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expected: Record<string, any>;
  invalidTransactions: GoldenTransaction[];
};

const PORTFOLIO_ID = "11111111-1111-4111-8111-111111111111";
const uuid = (prefix: string, n: number) =>
  `${prefix}0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const iso = (day: string) => `${day}T00:00:00.000Z`;

export type BuiltGolden = {
  records: DecryptedRecord[];
  asOf: Date;
  fxRates: FxRateInput[];
  cpi: CpiSeries;
  portfolioId: string;
  instrumentIds: Record<string, string>;
};

/** `withQuotes: false` pomija notowania — wtedy wycena opiera się na cenach transakcji. */
export function buildGoldenRecords(scenario: GoldenScenario): BuiltGolden {
  const instrumentIds = Object.fromEntries(
    scenario.instruments.map((item, i) => [item.symbol, uuid("2", i + 1)]),
  );
  const records: DecryptedRecord[] = [
    makeRecord("account", PORTFOLIO_ID, {
      recordType: "account",
      id: PORTFOLIO_ID,
      name: scenario.portfolio.name,
      accountType: scenario.portfolio.type,
      baseCurrency: "PLN",
    }),
  ];
  for (const item of scenario.instruments) {
    const id = instrumentIds[item.symbol];
    records.push(
      makeRecord("asset", id, {
        recordType: "asset",
        id,
        kind: item.kind,
        symbol: item.symbol,
        name: item.name,
        currency: item.currency,
        category: item.category,
      }),
    );
  }
  scenario.transactions.forEach((t, i) => {
    const id = uuid("3", i + 1);
    records.push(
      makeRecord("transaction", id, {
        recordType: "transaction",
        id,
        date: iso(t.date),
        portfolioID: PORTFOLIO_ID,
        instrumentID: t.instrumentSymbol ? instrumentIds[t.instrumentSymbol] : null,
        transactionType: t.type,
        quantity: t.quantity ?? null,
        price: t.price ?? null,
        grossAmount: t.grossAmount,
        currency: t.currency,
        fees: t.fees ?? 0,
        taxes: t.taxes ?? 0,
        fxRateToBase: t.fxRateToBase ?? null,
        targetCurrency: t.targetCurrency ?? null,
        targetGrossAmount: t.targetGrossAmount ?? null,
        transferKind: t.transferKind ?? null,
        transferSourceKind: t.transferSourceKind ?? null,
        contributionTreatment: t.contributionTreatment ?? null,
        transferCostBasisMode: t.transferCostBasisMode ?? null,
        transferLots: t.transferLots
          ? t.transferLots.map((lot) => ({ ...lot, acquisitionDate: iso(lot.acquisitionDate) }))
          : null,
      }),
    );
  });
  let q = 0;
  for (const [symbol, bars] of Object.entries(scenario.priceHistory)) {
    for (const bar of bars) {
      q += 1;
      const id = uuid("4", q);
      records.push(
        makeRecord("marketQuote", id, {
          recordType: "marketQuote",
          id,
          instrumentID: instrumentIds[symbol],
          date: iso(bar.date),
          price: bar.close,
          currency: scenario.instruments.find((x) => x.symbol === symbol)!.currency,
        }),
      );
    }
  }
  const asOf = new Date(iso(scenario.asOf));
  const fxRates: FxRateInput[] = Object.entries(scenario.fxHistory).flatMap(([currency, rates]) =>
    rates.map((r) => ({ currency, rate: r.rate, date: new Date(iso(r.date)) })),
  );
  const cpi: CpiSeries = Object.fromEntries(
    scenario.cpiHistory.map((c) => [c.date.slice(0, 7), c.yoyRate]),
  );
  return { records, asOf, fxRates, cpi, portfolioId: PORTFOLIO_ID, instrumentIds };
}
