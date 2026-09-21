import { describe, expect, it } from "vitest";
import { buildGoldenRecords, type GoldenScenario, type GoldenTransaction } from "./helpers/native-golden";
import { randomBook } from "./helpers/random-book";
import { buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";

// Zysk niezrealizowany = zysk instrumentów (po dzisiejszym kursie) + efekt kursu od zakupu.
// Bliźniak natywnych testów w EngineInvariantTests.swift (ADR-0008).

const usd = (rates: [string, number][]): GoldenScenario["fxHistory"] => ({
  USD: rates.map(([date, rate]) => ({ date, rate })),
});

const scenario = (transactions: GoldenTransaction[], fxHistory: GoldenScenario["fxHistory"], price = 120): GoldenScenario => ({
  asOf: "2026-03-01",
  portfolio: { name: "T", type: "custom" },
  instruments: [{ symbol: "U", kind: "etf", name: "U", currency: "USD", category: "equityForeign" }],
  transactions: [{ date: "2026-01-01", type: "cashDeposit", grossAmount: 1_000, currency: "USD", fxRateToBase: 4.0 }, ...transactions],
  latestPrices: {}, previousPrices30d: {}, latestFX: {},
  priceHistory: { U: [{ date: "2026-01-02", close: 100 }, { date: "2026-03-01", close: price }] },
  fxHistory, cpiHistory: [{ date: "2026-01-01", yoyRate: 3 }], expected: {}, invalidTransactions: [],
});

const metrics = (sc: GoldenScenario) => {
  const b = buildGoldenRecords(sc);
  return buildInvestorDataSnapshot(b.records, { asOf: b.asOf, fxRates: b.fxRates, cpi: b.cpi, useMarketQuotes: true, historyGranularity: "daily" }).metrics;
};

const buy = (rate?: number): GoldenTransaction => ({
  date: "2026-01-02", instrumentSymbol: "U", type: "buy", quantity: 10, price: 100, grossAmount: 1_000, currency: "USD",
  ...(rate ? { fxRateToBase: rate } : {}),
});

describe("efekt kursowy w zysku niezrealizowanym", () => {
  it("postać zamknięta: 10 szt. po 100 USD przy 4,0, dziś 120 USD przy 4,2", () => {
    const m = metrics(scenario([buy(4.0)], usd([["2026-01-02", 4.0], ["2026-03-01", 4.2]])));
    expect(m.unrealizedPnl).toBeCloseTo(1_040, 2);   // 10×120×4,2 − 10×100×4,0
    expect(m.unrealizedFxEffect).toBeCloseTo(200, 2); // 1000 USD × (4,2 − 4,0)
    expect(m.unrealizedPnl - m.unrealizedFxEffect).toBeCloseTo(840, 2); // 200 USD × 4,2
  });

  it("kurs się nie ruszył: efekt zero", () => {
    const m = metrics(scenario([buy(4.0)], usd([["2026-01-02", 4.0], ["2026-03-01", 4.0]])));
    expect(m.unrealizedFxEffect).toBeCloseTo(0, 6);
  });

  it("kurs spadł: efekt ujemny, a zysk instrumentu dodatni", () => {
    const m = metrics(scenario([buy(4.0)], usd([["2026-01-02", 4.0], ["2026-03-01", 3.8]])));
    expect(m.unrealizedFxEffect).toBeCloseTo(-200, 2);
    expect(m.unrealizedPnl - m.unrealizedFxEffect).toBeCloseTo(760, 2); // 200 USD × 3,8
  });

  it("zakup bez zapisanego kursu: brak informacji to nie zmiana kursu (efekt zero)", () => {
    const m = metrics(scenario([buy()], usd([["2026-01-02", 4.0], ["2026-03-01", 4.2]])));
    expect(m.unrealizedFxEffect).toBe(0);
  });

  it("księgi tylko w PLN: efekt zawsze zero; wielowalutowe: zawsze policzalny", () => {
    for (let seed = 1; seed <= 25; seed += 1) {
      const pln = metrics(randomBook(seed, { dividends: true }));
      expect(pln.unrealizedFxEffect, `PLN seed ${seed}`).toBe(0);
      const foreign = metrics(randomBook(seed, { foreign: true, costs: true, dividends: true }));
      expect(Number.isFinite(foreign.unrealizedFxEffect), `USD seed ${seed}`).toBe(true);
    }
  });
});
