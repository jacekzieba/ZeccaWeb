import { describe, expect, it } from "vitest";
import type { RecordType } from "@/domain/models/investor-data";
import { makeRecord } from "./helpers/records";
import { buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";

const accountID = "11111111-1111-4111-8111-111111111111";
const instrumentID = "22222222-2222-4222-8222-222222222222";

const record = (type: RecordType, id: string, payload: unknown) =>
  makeRecord(type, id, payload, "2026-05-15T10:00:00.000Z");

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

  it("keeps fees and taxes out of realised P&L, matching native cost buckets", () => {
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

    // Native LedgerEngine reports realised P&L as gross proceeds − FIFO cost;
    // fees and taxes are reported separately by the cost/tax KPIs.
    expect(snapshot.metrics.realizedPnl).toBeCloseTo(120, 5);
  });

  it("does not capitalise buy commission into realised P&L cost basis", () => {
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

    // Native FIFO lot cost is quantity × price. Entry commission is tracked in
    // fees, not capitalised into realised P&L.
    expect(snapshot.metrics.realizedPnl).toBeCloseTo(300, 5);
  });

  it("books nothing for a sell that carries no price, matching native", () => {
    const snapshot = buildInvestorDataSnapshot([
      ...baseRecords(),
      record("transaction", "55555555-5555-4555-8555-555555555558", {
        recordType: "transaction",
        id: "55555555-5555-4555-8555-555555555558",
        date: "2026-03-01T10:00:00.000Z",
        portfolioID: accountID,
        instrumentID,
        transactionType: "sell",
        quantity: 10,
        price: null,
        grossAmount: 1_200,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
    ]);

    // Native `LedgerEngine` guards `.sell` on instrumentID, quantity AND price,
    // so a price-less sell books no realised P&L and leaves the lot open.
    // Deriving a price from grossAmount here would report profit on a position
    // the ledger still holds.
    expect(snapshot.metrics.realizedPnl).toBeCloseTo(0, 5);
  });

  it("books a bond redemption that carries no price, matching native", () => {
    const snapshot = buildInvestorDataSnapshot([
      ...baseRecords(),
      record("transaction", "55555555-5555-4555-8555-555555555559", {
        recordType: "transaction",
        id: "55555555-5555-4555-8555-555555555559",
        date: "2026-03-01T10:00:00.000Z",
        portfolioID: accountID,
        instrumentID,
        transactionType: "bondRedemption",
        quantity: 10,
        price: null,
        grossAmount: 1_200,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
    ]);

    // Native guards `.bondRedemption` on instrumentID and quantity only — a
    // redemption is priced by its redemption amount, not a unit price.
    // 1 200 − (10 × 100) = 200
    expect(snapshot.metrics.realizedPnl).toBeCloseTo(200, 5);
  });

  it("gives a price-less buy no cost basis, matching the ledger's own guard", () => {
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
      record("transaction", "44444444-4444-4444-8444-44444444444a", {
        recordType: "transaction",
        id: "44444444-4444-4444-8444-44444444444a",
        date: "2026-01-03T10:00:00.000Z",
        portfolioID: accountID,
        instrumentID,
        transactionType: "buy",
        quantity: 4,
        price: null,
        grossAmount: 1_000,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
      record("transaction", "55555555-5555-4555-8555-55555555555a", {
        recordType: "transaction",
        id: "55555555-5555-4555-8555-55555555555a",
        date: "2026-03-01T10:00:00.000Z",
        portfolioID: accountID,
        instrumentID,
        transactionType: "sell",
        quantity: 4,
        price: 300,
        grossAmount: 1_200,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
    ]);

    // Native `LedgerEngine` guards `.buy` on price and skips the record whole:
    // no cash movement, no position, no lot. `applyTransaction` mirrors that,
    // so this FIFO pass must too — deriving a 250/unit basis from `grossAmount`
    // would leave the ledger holding no lot while realised P&L priced one.
    //
    // With no lot to consume, `lotCoverage` scales the proceeds to 0, matching
    // the cash the ledger actually credited. Native books the full 1 200 here
    // because it has no coverage concept; web deliberately stays conservative
    // rather than reporting profit it never received, and flags the skipped buy
    // through the `transaction-incomplete` diagnostic instead of staying quiet.
    expect(snapshot.metrics.realizedPnl).toBeCloseTo(0, 5);
  });

  it("scales proceeds to the fraction of the sale actually backed by lots", () => {
    const snapshot = buildInvestorDataSnapshot([
      ...baseRecords(),
      // Sells 20 against a 10-unit holding: only half the disposal is backed by
      // an open lot, so the ledger credits half the proceeds. Realised P&L has
      // to use the same fraction, or it books gains on units never acquired.
      record("transaction", "55555555-5555-4555-8555-55555555555b", {
        recordType: "transaction",
        id: "55555555-5555-4555-8555-55555555555b",
        date: "2026-03-01T10:00:00.000Z",
        portfolioID: accountID,
        instrumentID,
        transactionType: "sell",
        quantity: 20,
        price: 130,
        grossAmount: 2_600,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
    ]);

    // Coverage 10/20 = 0.5 → proceeds 2 600 × 0.5 = 1 300, cost 10 × 100 = 1 000.
    expect(snapshot.metrics.realizedPnl).toBeCloseTo(300, 5);
  });

  it("is zero while no position has been closed", () => {
    const snapshot = buildInvestorDataSnapshot(baseRecords());
    expect(snapshot.metrics.realizedPnl).toBeCloseTo(0, 5);
  });
});
