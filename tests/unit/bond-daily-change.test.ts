import { describe, expect, it } from "vitest";
import type { RecordType } from "@/domain/models/investor-data";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";
import { buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";

const accountID = "11111111-1111-4111-8111-111111111111";
const bondID = "22222222-2222-4222-8222-222222222222";

function record(
  type: RecordType,
  id: string,
  payload: unknown,
  updatedAt = "2026-06-23T10:00:00.000Z",
): DecryptedRecord {
  return {
    id,
    deviceId: "test",
    updatedAt,
    deletedAt: null,
    envelope: { type, payloadVersion: 1, schemaVersion: 1, payload },
  };
}

const asOf = new Date("2026-06-23T20:00:00.000Z");

function baseRecords(): DecryptedRecord[] {
  return [
    record("account", accountID, {
      recordType: "account",
      id: accountID,
      name: "Obligacje",
      accountType: "Własny",
      baseCurrency: "PLN",
      colorHex: "#8C6F30",
      targetAllocation: {},
    }),
    record("asset", bondID, {
      recordType: "asset",
      id: bondID,
      kind: "treasuryBond",
      symbol: "EDO0834",
      name: "EDO 10-letnie",
      currency: "PLN",
      bondParams: {
        issueDate: "2024-08-01T00:00:00.000Z",
        maturityDate: "2034-08-01T00:00:00.000Z",
        nominalValue: 100,
        firstPeriodRate: 6.55,
        subsequentBase: "inflacja",
        marginOverBase: 2.0,
        capitalization: "roczna",
        interestPayment: "przy wykupie",
      },
    }),
    record("transaction", "33333333-3333-4333-8333-333333333333", {
      recordType: "transaction",
      id: "33333333-3333-4333-8333-333333333333",
      date: "2024-08-01T10:00:00.000Z",
      portfolioID: accountID,
      instrumentID: bondID,
      transactionType: "buy",
      quantity: 200,
      price: 100,
      grossAmount: 20000,
      currency: "PLN",
      fees: 0,
      taxes: 0,
    }),
  ];
}

describe("treasury bond 1D change", () => {
  it("reflects daily accrual when valued by formula (no manual valuation)", () => {
    const snapshot = buildInvestorDataSnapshot(baseRecords(), { asOf });
    const bonds = snapshot.portfolios.find((p) => p.name === "Obligacje")!;
    expect(bonds.dailyChange).toBeGreaterThan(0);
  });

  it("reflects daily accrual even when a manual valuation overrides the headline price", () => {
    // Sparse manual valuations (e.g. copied from obligacjeskarbowe.pl). Before
    // the fix these forced the 1D change to exactly 0% because the explicit
    // price overrode the daily-accrual formula and `withPricesCappedAt`
    // backdated today's valuation onto yesterday.
    const records = [
      ...baseRecords(),
      record("manualValuation", "44444444-4444-4444-8444-444444444444", {
        recordType: "manualValuation",
        id: "44444444-4444-4444-8444-444444444444",
        instrumentID: bondID,
        date: "2026-05-24T00:00:00.000Z",
        value: 113.0,
        currency: "PLN",
      }),
      record("manualValuation", "55555555-5555-4555-8555-555555555555", {
        recordType: "manualValuation",
        id: "55555555-5555-4555-8555-555555555555",
        instrumentID: bondID,
        date: "2026-06-23T00:00:00.000Z",
        value: 113.6,
        currency: "PLN",
      }),
    ];

    const snapshot = buildInvestorDataSnapshot(records, { asOf });
    const bonds = snapshot.portfolios.find((p) => p.name === "Obligacje")!;
    expect(bonds.dailyChange).toBeGreaterThan(0);
  });
});
