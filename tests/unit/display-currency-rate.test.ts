import { describe, expect, it } from "vitest";
import { buildGoldenRecords, type GoldenScenario } from "./helpers/native-golden";
import { hasDisplayCurrencyRate } from "@/sync/records/investor-snapshot";

// DATA-002 (bliźniak DisplayCurrencyFallbackTests.swift): bez kursu waluty prezentacji
// UI zostaje przy PLN zamiast podpisywać kwoty w PLN jako USD/EUR.

const scenario = (deposit: GoldenScenario["transactions"][number]): GoldenScenario => ({
  asOf: "2026-03-01",
  portfolio: { name: "T", type: "custom" },
  instruments: [],
  transactions: [deposit],
  latestPrices: {}, previousPrices30d: {}, latestFX: {},
  priceHistory: {}, fxHistory: {}, cpiHistory: [{ date: "2026-01-01", yoyRate: 3 }], expected: {}, invalidTransactions: [],
});

const asOf = new Date("2026-03-01T12:00:00Z");

describe("kurs waluty prezentacji", () => {
  const plnOnly = buildGoldenRecords(scenario({ date: "2026-01-01", type: "cashDeposit", grossAmount: 1_000, currency: "PLN" })).records;

  it("PLN nie potrzebuje kursu", () => {
    expect(hasDisplayCurrencyRate(plnOnly, "PLN", [], asOf)).toBe(true);
  });

  it("bez serii NBP i bez transakcji w USD kursu brak", () => {
    expect(hasDisplayCurrencyRate(plnOnly, "USD", [], asOf)).toBe(false);
    expect(hasDisplayCurrencyRate(null, "USD", [], asOf)).toBe(false);
  });

  it("seria NBP z dnia ≤ wyceny wystarcza, późniejsza nie", () => {
    expect(hasDisplayCurrencyRate(plnOnly, "USD", [{ currency: "USD", date: new Date("2026-02-27"), rate: 3.9 }], asOf)).toBe(true);
    expect(hasDisplayCurrencyRate(plnOnly, "USD", [{ currency: "USD", date: new Date("2026-03-05"), rate: 3.9 }], asOf)).toBe(false);
  });

  it("własna transakcja w USD z kursem też jest kursem (jak w snapshocie)", () => {
    const usd = buildGoldenRecords(scenario({ date: "2026-01-01", type: "cashDeposit", grossAmount: 1_000, currency: "USD", fxRateToBase: 4.0 })).records;
    expect(hasDisplayCurrencyRate(usd, "USD", [], asOf)).toBe(true);
  });
});
