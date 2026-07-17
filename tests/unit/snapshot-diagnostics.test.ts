import { describe, expect, it } from "vitest";
import { buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";
import { treasuryBondMacroGaps, type BondParamsInput } from "@/domain/valuation/position-valuator";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";
import type { RecordType } from "@/domain/models/investor-data";

function record(type: RecordType, id: string, payload: unknown): DecryptedRecord {
  return {
    id,
    deviceId: "test",
    updatedAt: "2026-06-30T10:00:00.000Z",
    deletedAt: null,
    envelope: { type, payloadVersion: 1, schemaVersion: 1, payload },
  };
}

const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const USD_ASSET = "22222222-2222-4222-8222-222222222222";

describe("snapshot diagnostics", () => {
  it("flags a held foreign asset with no price and no FX rate", () => {
    const records = [
      record("account", ACCOUNT, { recordType: "account", id: ACCOUNT, name: "Core", baseCurrency: "PLN" }),
      record("asset", USD_ASSET, {
        recordType: "asset",
        id: USD_ASSET,
        kind: "stock",
        symbol: "AAPL",
        name: "Apple",
        currency: "USD",
      }),
      // A buy establishes the holding but carries no price and no fxRateToBase,
      // so both the price and the USD rate are unresolved.
      record("transaction", "33333333-3333-4333-8333-333333333333", {
        recordType: "transaction",
        id: "33333333-3333-4333-8333-333333333333",
        date: "2026-01-05T00:00:00.000Z",
        portfolioID: ACCOUNT,
        instrumentID: USD_ASSET,
        transactionType: "buy",
        quantity: 10,
        grossAmount: 0,
        currency: "USD",
        fees: 0,
        taxes: 0,
      }),
    ];

    const snapshot = buildInvestorDataSnapshot(records, { asOf: new Date("2026-06-30T00:00:00.000Z") });
    const codes = (snapshot.diagnostics ?? []).map((d) => d.code);
    expect(codes).toContain("price-missing");
    expect(snapshot.diagnostics?.find((d) => d.code === "price-missing")?.context).toBe("AAPL");
  });

  it("emits no diagnostics when a held asset has a market price", () => {
    const records = [
      record("account", ACCOUNT, { recordType: "account", id: ACCOUNT, name: "Core", baseCurrency: "PLN" }),
      record("asset", USD_ASSET, {
        recordType: "asset",
        id: USD_ASSET,
        kind: "stock",
        symbol: "PKN",
        name: "Orlen",
        currency: "PLN",
      }),
      record("transaction", "33333333-3333-4333-8333-333333333333", {
        recordType: "transaction",
        id: "33333333-3333-4333-8333-333333333333",
        date: "2026-01-05T00:00:00.000Z",
        portfolioID: ACCOUNT,
        instrumentID: USD_ASSET,
        transactionType: "buy",
        quantity: 10,
        price: 65,
        grossAmount: 650,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
    ];

    const snapshot = buildInvestorDataSnapshot(records, { asOf: new Date("2026-06-30T00:00:00.000Z") });
    expect(snapshot.diagnostics).toEqual([]);
  });
});

describe("treasuryBondMacroGaps", () => {
  const rorParams: BondParamsInput = {
    issueDate: new Date("2026-01-01T00:00:00.000Z"),
    maturityDate: new Date("2027-01-01T00:00:00.000Z"),
    nominalValue: 100,
    firstPeriodRate: 5.75,
    subsequentBase: "stopa referencyjna NBP",
    marginOverBase: 0,
    capitalization: "brak",
    interestPayment: "co miesiąc",
  };

  it("reports a gap when the reference-rate series does not cover a subsequent period", () => {
    // Empty reference series → every period after the first falls back.
    expect(
      treasuryBondMacroGaps(rorParams, new Date("2026-01-01T00:00:00.000Z"), new Date("2026-05-01T00:00:00.000Z"), undefined, []),
    ).toBe(true);
  });

  it("reports no gap when the series covers the periods", () => {
    const series = [{ date: new Date("2025-01-01T00:00:00.000Z"), rate: 4.5 }];
    expect(
      treasuryBondMacroGaps(rorParams, new Date("2026-01-01T00:00:00.000Z"), new Date("2026-05-01T00:00:00.000Z"), undefined, series),
    ).toBe(false);
  });
});
