import { describe, expect, it } from "vitest";
import { buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";
import type { RecordType } from "@/domain/models/investor-data";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";
import { makeRecord } from "./helpers/records";

const accountID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const rorID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const record = (type: RecordType, id: string, payload: unknown) =>
  makeRecord(type, id, payload, "2026-03-20T10:00:00.000Z");

const records: DecryptedRecord[] = [
  record("account", accountID, {
    recordType: "account",
    id: accountID,
    name: "Obligacje",
    accountType: "standard",
    baseCurrency: "PLN",
  }),
  record("asset", rorID, {
    recordType: "asset",
    id: rorID,
    kind: "treasuryBond",
    symbol: "ROR0127",
    name: "ROR0127",
    currency: "PLN",
    bondParams: {
      issueDate: "2026-01-15T00:00:00.000Z",
      maturityDate: "2027-01-15T00:00:00.000Z",
      nominalValue: 100,
      firstPeriodRate: 5.75,
      subsequentBase: "stopa referencyjna NBP",
      marginOverBase: 0,
      capitalization: "brak",
      interestPayment: "co miesiąc",
    },
  }),
  record("transaction", "cccccccc-cccc-4ccc-8ccc-cccccccccccc", {
    recordType: "transaction",
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    date: "2026-01-15T00:00:00.000Z",
    portfolioID: accountID,
    instrumentID: null,
    transactionType: "cashDeposit",
    grossAmount: 100,
    currency: "PLN",
    fees: 0,
    taxes: 0,
  }),
  record("transaction", "dddddddd-dddd-4ddd-8ddd-dddddddddddd", {
    recordType: "transaction",
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    date: "2026-01-15T00:00:00.000Z",
    portfolioID: accountID,
    instrumentID: rorID,
    transactionType: "buy",
    quantity: 1,
    price: 100,
    grossAmount: 100,
    currency: "PLN",
    fees: 0,
    taxes: 0,
  }),
];

describe("buildInvestorDataSnapshot threads injected NBP rates to bond valuation", () => {
  it("uses the injected series instead of the hardcoded fallback", () => {
    const snapshot = buildInvestorDataSnapshot(records, {
      asOf: new Date("2026-03-20T00:00:00.000Z"),
      referenceRates: [
        { date: new Date("2025-12-04T00:00:00.000Z"), rate: 2.0 },
      ],
    });

    expect(snapshot.portfolios[0].value).toBe(100.03);
  });

  it("uses the native fallback table when no series is injected", () => {
    const snapshot = buildInvestorDataSnapshot(records, {
      asOf: new Date("2026-03-20T00:00:00.000Z"),
    });

    expect(snapshot.portfolios[0].value).toBe(100.05);
  });
});
