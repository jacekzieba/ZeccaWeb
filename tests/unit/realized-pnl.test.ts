import { describe, expect, it } from "vitest";
import type { RecordType } from "@/domain/models/investor-data";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";
import { buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";

const accountID = "11111111-1111-4111-8111-111111111111";
const instrumentID = "22222222-2222-4222-8222-222222222222";

function record(type: RecordType, id: string, payload: unknown): DecryptedRecord {
  return {
    id,
    deviceId: "test",
    updatedAt: "2026-05-15T10:00:00.000Z",
    deletedAt: null,
    envelope: { type, payloadVersion: 1, schemaVersion: 1, payload },
  };
}

function baseRecords() {
  return [
    record("account", accountID, {
      recordType: "account",
      id: accountID,
      name: "Core",
      baseCurrency: "PLN",
    }),
    record("asset", instrumentID, {
      recordType: "asset",
      id: instrumentID,
      kind: "etf",
      symbol: "VWCE",
      name: "Vanguard FTSE All-World",
      currency: "PLN",
    }),
    record("transaction", "33333333-3333-4333-8333-333333333333", {
      recordType: "transaction",
      id: "33333333-3333-4333-8333-333333333333",
      date: "2026-01-02T10:00:00.000Z",
      portfolioID: accountID,
      instrumentID: null,
      transactionType: "cashDeposit",
      grossAmount: 10_000,
      currency: "PLN",
      fees: 0,
      taxes: 0,
    }),
    record("transaction", "44444444-4444-4444-8444-444444444444", {
      recordType: "transaction",
      id: "44444444-4444-4444-8444-444444444444",
      date: "2026-01-03T10:00:00.000Z",
      portfolioID: accountID,
      instrumentID,
      transactionType: "buy",
      quantity: 10,
      price: 100,
      grossAmount: 1_000,
      currency: "PLN",
      fees: 0,
      taxes: 0,
    }),
  ];
}

describe("realised P&L (FIFO)", () => {
  it("books proceeds minus FIFO cost basis on a partial sell", () => {
    const snapshot = buildInvestorDataSnapshot([
      ...baseRecords(),
      record("transaction", "55555555-5555-4555-8555-555555555555", {
        recordType: "transaction",
        id: "55555555-5555-4555-8555-555555555555",
        date: "2026-03-01T10:00:00.000Z",
        portfolioID: accountID,
        instrumentID,
        transactionType: "sell",
        quantity: 4,
        price: 130,
        grossAmount: 520,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
    ]);

    // (130 − 100) × 4 = 120
    expect(snapshot.metrics.realizedPnl).toBeCloseTo(120, 5);
  });

  it("subtracts fees and taxes from the realised proceeds", () => {
    const snapshot = buildInvestorDataSnapshot([
      ...baseRecords(),
      record("transaction", "55555555-5555-4555-8555-555555555556", {
        recordType: "transaction",
        id: "55555555-5555-4555-8555-555555555556",
        date: "2026-03-01T10:00:00.000Z",
        portfolioID: accountID,
        instrumentID,
        transactionType: "sell",
        quantity: 4,
        price: 130,
        grossAmount: 520,
        currency: "PLN",
        fees: 5,
        taxes: 3,
      }),
    ]);

    // 520 − 5 − 3 − 400 = 112
    expect(snapshot.metrics.realizedPnl).toBeCloseTo(112, 5);
  });

  it("capitalises the buy commission into the cost basis", () => {
    const snapshot = buildInvestorDataSnapshot([
      record("account", accountID, {
        recordType: "account",
        id: accountID,
        name: "Core",
        baseCurrency: "PLN",
      }),
      record("asset", instrumentID, {
        recordType: "asset",
        id: instrumentID,
        kind: "etf",
        symbol: "VWCE",
        name: "Vanguard FTSE All-World",
        currency: "PLN",
      }),
      record("transaction", "33333333-3333-4333-8333-333333333333", {
        recordType: "transaction",
        id: "33333333-3333-4333-8333-333333333333",
        date: "2026-01-02T10:00:00.000Z",
        portfolioID: accountID,
        transactionType: "cashDeposit",
        grossAmount: 10_000,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
      record("transaction", "44444444-4444-4444-8444-444444444444", {
        recordType: "transaction",
        id: "44444444-4444-4444-8444-444444444444",
        date: "2026-01-03T10:00:00.000Z",
        portfolioID: accountID,
        instrumentID,
        transactionType: "buy",
        quantity: 10,
        price: 100,
        grossAmount: 1_000,
        currency: "PLN",
        fees: 10,
        taxes: 0,
      }),
      record("transaction", "55555555-5555-4555-8555-555555555557", {
        recordType: "transaction",
        id: "55555555-5555-4555-8555-555555555557",
        date: "2026-03-01T10:00:00.000Z",
        portfolioID: accountID,
        instrumentID,
        transactionType: "sell",
        quantity: 10,
        price: 130,
        grossAmount: 1_300,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
    ]);

    // Cost basis = 10×100 + 10 buy commission = 1010; proceeds 1300 → 290
    // (not 300, which would ignore the entry cost the exit side already nets).
    expect(snapshot.metrics.realizedPnl).toBeCloseTo(290, 5);
  });

  it("is zero while no position has been closed", () => {
    const snapshot = buildInvestorDataSnapshot(baseRecords());
    expect(snapshot.metrics.realizedPnl).toBeCloseTo(0, 5);
  });
});
