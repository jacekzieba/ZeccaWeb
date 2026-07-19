import { describe, expect, it } from "vitest";
import { buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";
import type { RecordType } from "@/domain/models/investor-data";

function record(type: RecordType, id: string, payload: unknown): DecryptedRecord {
  return {
    id,
    deviceId: "test",
    updatedAt: "2026-01-03T12:00:00.000Z",
    deletedAt: null,
    envelope: { type, payloadVersion: 1, schemaVersion: 1, payload },
  };
}

const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const ETF = "22222222-2222-4222-8222-222222222222";

/**
 * Pins the daily valuation series on a fully hand-computable scenario, guarding
 * the incremental-ledger path in `buildValuationSeries`:
 *   Jan 1: deposit 1000, buy 2×ETF @100 → cash 800 + holdings 200 = 1000
 *   Jan 2: manual valuation unchanged (100) → 800 + 200 = 1000
 *   Jan 3: manual valuation 150 → 800 + 300 = 1100
 */
describe("buildValuationSeries incremental ledger", () => {
  const records: DecryptedRecord[] = [
    record("account", ACCOUNT, { recordType: "account", id: ACCOUNT, name: "Core", baseCurrency: "PLN" }),
    record("asset", ETF, { recordType: "asset", id: ETF, kind: "etf", symbol: "ETF", name: "ETF", currency: "PLN" }),
    record("transaction", "33333333-3333-4333-8333-333333333333", {
      recordType: "transaction", id: "33333333-3333-4333-8333-333333333333",
      date: "2026-01-01T12:00:00.000Z", portfolioID: ACCOUNT, transactionType: "cashDeposit",
      grossAmount: 1000, currency: "PLN", fees: 0, taxes: 0,
    }),
    record("transaction", "44444444-4444-4444-8444-444444444444", {
      recordType: "transaction", id: "44444444-4444-4444-8444-444444444444",
      date: "2026-01-01T12:00:00.000Z", portfolioID: ACCOUNT, instrumentID: ETF, transactionType: "buy",
      quantity: 2, price: 100, grossAmount: 200, currency: "PLN", fees: 0, taxes: 0,
    }),
    record("manualValuation", "55555555-5555-4555-8555-555555555555", {
      recordType: "manualValuation", id: "55555555-5555-4555-8555-555555555555",
      instrumentID: ETF, date: "2026-01-01T12:00:00.000Z", value: 100, currency: "PLN",
    }),
    record("manualValuation", "66666666-6666-4666-8666-666666666666", {
      recordType: "manualValuation", id: "66666666-6666-4666-8666-666666666666",
      instrumentID: ETF, date: "2026-01-03T12:00:00.000Z", value: 150, currency: "PLN",
    }),
  ];

  it("advances the running ledger across dates and prices each day correctly", () => {
    const snapshot = buildInvestorDataSnapshot(records, {
      asOf: new Date("2026-01-03T12:00:00.000Z"),
      historyGranularity: "daily",
      useMarketQuotes: true,
    });

    const values = snapshot.valuationSeries.map((point) => point.value);
    expect(values).toHaveLength(3);
    expect(values[0]).toBeCloseTo(1000, 6);
    expect(values[1]).toBeCloseTo(1000, 6);
    expect(values[2]).toBeCloseTo(1100, 6);
  });

  it("skips a transaction with an unparseable date instead of corrupting the series", () => {
    // An unparseable date can't be ordered or valued: before validation it
    // crashed the build (Invalid time value in the performance series) or
    // stalled the incremental cursor, dropping every later transaction. The
    // record must be skipped with a diagnostic, leaving the series intact.
    const badDated = record("transaction", "77777777-7777-4777-8777-777777777777", {
      recordType: "transaction", id: "77777777-7777-4777-8777-777777777777",
      date: "not-a-date", portfolioID: ACCOUNT, transactionType: "cashDeposit",
      grossAmount: 50, currency: "PLN", fees: 0, taxes: 0,
    });

    const snapshot = buildInvestorDataSnapshot([badDated, ...records], {
      asOf: new Date("2026-01-03T12:00:00.000Z"),
      historyGranularity: "daily",
      useMarketQuotes: true,
    });

    expect((snapshot.diagnostics ?? []).some((d) => d.code === "record-skipped")).toBe(true);
    const values = snapshot.valuationSeries.map((point) => point.value);
    expect(values).toHaveLength(3);
    expect(values[2]).toBeCloseTo(1100, 6);
    expect(values[2]).toBeCloseTo(snapshot.totalValue, 6);
  });
});
