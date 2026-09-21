import { describe, expect, it } from "vitest";
import { buildGoldenRecords, type GoldenScenario, type GoldenTransaction } from "./helpers/native-golden";
import { buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";

// Odsetki od lokaty = kwota przy zamknięciu − wpłacona przy otwarciu (jak natywny
// LedgerEngine: `dividendsInterest += max(0, kwota − koszt)`). Wcześniej web wliczał do
// „odsetek” tylko transakcje interest/bondCoupon, więc lokata 2 000 → 2 100 dawała 0.

const scenario = (transactions: GoldenTransaction[], asOf = "2026-06-01"): GoldenScenario => ({
  asOf,
  portfolio: { name: "T", type: "custom" },
  instruments: [
    { symbol: "LOK1", kind: "deposit", name: "Lokata 1", currency: "PLN", category: "currency" },
    { symbol: "LOK2", kind: "deposit", name: "Lokata 2", currency: "PLN", category: "currency" },
  ],
  transactions: [{ date: "2026-01-01", type: "cashDeposit", grossAmount: 100_000, currency: "PLN" }, ...transactions],
  latestPrices: {}, previousPrices30d: {}, latestFX: {}, priceHistory: {}, fxHistory: {},
  cpiHistory: [{ date: "2026-01-01", yoyRate: 3 }], expected: {}, invalidTransactions: [],
});

const interestOf = (sc: GoldenScenario) => {
  const b = buildGoldenRecords(sc);
  const s = buildInvestorDataSnapshot(b.records, { asOf: b.asOf, fxRates: b.fxRates, cpi: b.cpi, historyGranularity: "daily" });
  return { interest: s.cashflows.interest, cash: s.cash };
};
const open = (day: string, amount: number, symbol = "LOK1"): GoldenTransaction => ({ date: day, instrumentSymbol: symbol, type: "depositOpen", grossAmount: amount, currency: "PLN" });
const close = (day: string, amount: number, symbol = "LOK1", quantity?: number): GoldenTransaction => ({ date: day, instrumentSymbol: symbol, type: "depositClose", grossAmount: amount, currency: "PLN", ...(quantity ? { quantity } : {}) });

describe("odsetki od lokat w podsumowaniu przepływów", () => {
  it("zamknięta lokata: kwota końcowa − wpłacona = odsetki", () => {
    const { interest, cash } = interestOf(scenario([open("2026-02-01", 25_000), close("2026-05-01", 25_812.5)]));
    expect(interest).toBeCloseTo(812.5, 2);
    expect(cash).toBeCloseTo(100_812.5, 2); // gotówka już zawierała odsetki; zmienia się tylko etykieta
  });

  it("otwarta lokata nie daje odsetek", () => {
    expect(interestOf(scenario([open("2026-02-01", 25_000)])).interest).toBe(0);
  });

  it("zamknięcie poniżej wpłaty (strata) nie daje ujemnych odsetek", () => {
    expect(interestOf(scenario([open("2026-02-01", 25_000), close("2026-05-01", 24_900)])).interest).toBe(0);
  });

  it("kilka lokat: FIFO w obrębie tego samego instrumentu, osobno dla różnych", () => {
    const sc = scenario([
      open("2026-02-01", 10_000, "LOK1"),
      open("2026-02-05", 20_000, "LOK1"),
      open("2026-02-07", 5_000, "LOK2"),
      close("2026-04-01", 10_500, "LOK1"), // zamyka pierwszą partię (10 000) → +500
      close("2026-04-02", 5_100, "LOK2"), // → +100
      close("2026-05-01", 20_600, "LOK1"), // zamyka drugą (20 000) → +600
    ]);
    expect(interestOf(sc).interest).toBeCloseTo(1_200, 2);
  });

  it("odsetki po dacie wyceny nie wliczają się", () => {
    const sc = scenario([open("2026-02-01", 25_000), close("2026-08-01", 25_800)], "2026-06-01");
    expect(interestOf(sc).interest).toBe(0);
  });

  it("sumują się z osobnymi transakcjami „odsetki”", () => {
    const sc = scenario([
      open("2026-02-01", 25_000),
      close("2026-05-01", 25_500),
      { date: "2026-05-02", type: "interest", grossAmount: 50, currency: "PLN" },
    ]);
    expect(interestOf(sc).interest).toBeCloseTo(550, 2);
  });
});
