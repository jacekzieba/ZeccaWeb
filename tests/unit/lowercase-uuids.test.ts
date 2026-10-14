import { describe, expect, it } from "vitest";
import { lowercaseUuids } from "@/sync/records/encrypted-records";

describe("lowercaseUuids", () => {
  it("ujednolica wielkość liter UUID w zagnieżdżonym payloadzie", () => {
    expect(
      lowercaseUuids({
        id: "D1FD9DBD-0000-4000-8000-ABCDEF012345",
        name: "ABC",
        nested: [{ portfolioID: "D1FD9DBD-0000-4000-8000-ABCDEF012345" }],
        amount: 5,
        none: null,
      }),
    ).toEqual({
      id: "d1fd9dbd-0000-4000-8000-abcdef012345",
      name: "ABC",
      nested: [{ portfolioID: "d1fd9dbd-0000-4000-8000-abcdef012345" }],
      amount: 5,
      none: null,
    });
  });
});

import { buildInstrumentList } from "@/sync/records/investor-snapshot";
import { makeRecord as record } from "./helpers/records";

describe("snapshot z UUID różnej wielkości liter", () => {
  it("transakcja z wielkim UUID portfela trafia do portfela z małym UUID", () => {
    const A = "d1fd9dbd-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const I = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const T = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const records = [
      record("account", A, { recordType: "account", id: A, name: "Główny", baseCurrency: "PLN" }),
      record("asset", I, { recordType: "asset", id: I, kind: "etf", symbol: "IEMA", name: "IEMA", currency: "USD" }),
      record("transaction", T, {
        recordType: "transaction",
        id: T,
        date: "2026-10-13T10:00:00.000Z",
        portfolioID: A.toUpperCase(),
        instrumentID: I.toUpperCase(),
        transactionType: "buy",
        quantity: 100,
        price: 60,
        grossAmount: 6000,
        currency: "USD",
        fxRateToBase: 3.9177,
        fees: 0,
        taxes: 0,
      }),
    ];
    const [row] = buildInstrumentList(records, {
      asOf: new Date("2026-10-14T00:00:00Z"),
      useLatestTransactionFxRate: true,
    });
    expect(row?.totalQuantity).toBe(100);
  });
});
