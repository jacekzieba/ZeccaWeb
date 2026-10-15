import { describe, expect, it } from "vitest";
import { buildInstrumentList } from "@/sync/records/investor-snapshot";
import { makeRecord as record } from "./helpers/records";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const I = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function valuation(id: string, value: number, savedAt: string) {
  return record(
    "manualValuation",
    id,
    { recordType: "manualValuation", id, instrumentID: I, date: "2026-10-14T00:00:00.000Z", value, currency: "PLN" },
    savedAt,
  );
}

describe("wycena manualna z tego samego dnia", () => {
  it("wygrywa ostatnio zapisana, niezależnie od kolejności rekordów", () => {
    const base = [
      record("account", A, { recordType: "account", id: A, name: "Główny", baseCurrency: "PLN" }),
      record("asset", I, { recordType: "asset", id: I, kind: "stock", symbol: "KGHM", name: "KGHM", currency: "PLN" }),
      record("transaction", "cccccccc-cccc-4ccc-8ccc-cccccccccccc", {
        recordType: "transaction", id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", date: "2026-10-01T10:00:00.000Z",
        portfolioID: A, instrumentID: I, transactionType: "buy", quantity: 10, price: 100, grossAmount: 1000,
        currency: "PLN", fees: 0, taxes: 0,
      }),
    ];
    const oldest = valuation("11111111-1111-4111-8111-111111111111", 150, "2026-10-14T15:10:00.000Z");
    const middle = valuation("22222222-2222-4222-8222-222222222222", 200, "2026-10-14T15:12:00.000Z");
    const newest = valuation("33333333-3333-4333-8333-333333333333", 250, "2026-10-14T15:13:00.000Z");

    for (const order of [[oldest, middle, newest], [newest, oldest, middle]]) {
      const [row] = buildInstrumentList([...base, ...order], { asOf: new Date("2026-10-14T18:00:00Z") });
      expect(row?.lastPrice).toBe(250);
    }
  });
});
