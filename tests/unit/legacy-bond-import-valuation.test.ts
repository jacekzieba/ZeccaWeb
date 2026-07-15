import { describe, expect, it } from "vitest";
import type { RecordType } from "@/domain/models/investor-data";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";
import {
  buildInstrumentList,
  buildPortfolioDetail,
  buildInvestorDataSnapshot,
} from "@/sync/records/investor-snapshot";

const portfolioID = "11111111-1111-4111-8111-111111111111";

function record(type: RecordType, id: string, payload: unknown): DecryptedRecord {
  return {
    id,
    deviceId: "test",
    updatedAt: "2026-07-15T20:05:00.000Z",
    deletedAt: null,
    envelope: { type, payloadVersion: 1, schemaVersion: 1, payload },
  };
}

const bonds = [
  { id: "22222222-2222-4222-8222-222222222222", txID: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", code: "ROS1228", quantity: 15, purchase: "2022-12-22T10:00:00.000Z" },
  { id: "33333333-3333-4333-8333-333333333333", txID: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2", code: "ROS0229", quantity: 100, purchase: "2023-02-27T10:00:00.000Z" },
  { id: "44444444-4444-4444-8444-444444444444", txID: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3", code: "ROS1129", quantity: 20, purchase: "2023-11-30T10:00:00.000Z" },
  { id: "55555555-5555-4555-8555-555555555555", txID: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4", code: "ROD0338", quantity: 50, purchase: "2026-03-27T10:00:00.000Z" },
];

function legacyPkoRecords(): DecryptedRecord[] {
  return [
    record("account", portfolioID, {
      recordType: "account",
      id: portfolioID,
      name: "Obligacje",
      baseCurrency: "PLN",
    }),
    ...bonds.map((bond) =>
      record("asset", bond.id, {
        recordType: "asset",
        id: bond.id,
        kind: "treasuryBond",
        symbol: bond.code,
        name: bond.code,
        currency: "PLN",
        // PKO imports created before the fix contain no issue parameters.
        bondParams: null,
      }),
    ),
    record("transaction", "66666666-6666-4666-8666-666666666666", {
      recordType: "transaction",
      id: "66666666-6666-4666-8666-666666666666",
      date: "2022-12-22T09:00:00.000Z",
      portfolioID,
      instrumentID: null,
      transactionType: "cashDeposit",
      quantity: null,
      price: null,
      grossAmount: 18_500,
      currency: "PLN",
      fees: 0,
      taxes: 0,
    }),
    ...bonds.map((bond) =>
      record("transaction", bond.txID, {
        recordType: "transaction",
        id: bond.txID,
        date: bond.purchase,
        portfolioID,
        instrumentID: bond.id,
        transactionType: "buy",
        quantity: bond.quantity,
        price: 100,
        grossAmount: bond.quantity * 100,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
    ),
  ];
}

describe("legacy PKO bond valuation", () => {
  const asOf = new Date("2026-07-15T20:05:00.000Z");

  it("prices parameterless legacy issues and creates a daily accrual history", () => {
    const records = legacyPkoRecords();
    const rows = buildInstrumentList(records, { asOf });
    const snapshot = buildInvestorDataSnapshot(records, {
      asOf,
      historyGranularity: "daily",
    });
    const detail = buildPortfolioDetail(records, portfolioID, {
      asOf,
      historyGranularity: "daily",
    })!;

    expect(rows.map((row) => row.valuationSource)).toEqual([
      "treasuryBond",
      "treasuryBond",
      "treasuryBond",
      "treasuryBond",
    ]);
    expect(
      rows
        .map((row) => ({ symbol: row.symbol, price: Number(row.lastPrice.toFixed(2)) }))
        .sort((a, b) => a.symbol.localeCompare(b.symbol)),
    ).toEqual([
      { symbol: "ROD0338", price: 101.76 },
      { symbol: "ROS0229", price: 124.42 },
      { symbol: "ROS1129", price: 117.36 },
      { symbol: "ROS1228", price: 126.4 },
    ]);
    // PKO displays the unit value to cents; the reconciled statement total is
    // the sum of those displayed unit values times the held quantity.
    expect(
      rows.reduce(
        (sum, row) => sum + Number(row.lastPrice.toFixed(2)) * row.totalQuantity,
        0,
      ),
    ).toBeCloseTo(21_773.2, 2);
    expect(rows.reduce((sum, row) => sum + row.marketValue, 0)).toBeCloseTo(21_773.36, 2);
    expect(snapshot.totalValue).toBeCloseTo(21_773.36, 2);
    expect(detail.totalValue).toBeCloseTo(21_773.36, 2);

    const series = detail.valuationSeries;
    expect(series.at(-1)?.value).toBeCloseTo(21_773.36, 2);
    expect(series.at(-1)!.value).toBeGreaterThan(series.at(-2)!.value);
  });
});
