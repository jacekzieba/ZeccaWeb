import { describe, expect, it } from "vitest";
import {
  computePeriodReturnPct,
  historySpanDays,
  ANNUALIZATION_MIN_DAYS,
} from "@/domain/metrics/portfolio-metrics";
import { annualizedOrNull, dayCountLabel, isShortHistory, mwrDisplay } from "@/domain/metrics/short-history";
import { buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";
import { makeRecord as record } from "./helpers/records";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("zwrot za okres (zmodyfikowany Dietz)", () => {
  it("jedna wpłata: zysk / wpłata", () => {
    const flows = [{ date: day("2026-10-01"), amount: -1000 }];
    expect(computePeriodReturnPct(flows, 1030, day("2026-10-11"))).toBeCloseTo(3, 6);
    expect(historySpanDays(flows, day("2026-10-11"))).toBe(10);
  });

  it("dopłata w połowie okresu waży się połową", () => {
    const flows = [
      { date: day("2026-10-01"), amount: -1000 },
      { date: day("2026-10-11"), amount: -1000 },
    ];
    // zysk 100 przy kapitale ważonym 1000 + 1000 * 0,5 = 1500
    expect(computePeriodReturnPct(flows, 2100, day("2026-10-21"))).toBeCloseTo((100 / 1500) * 100, 6);
  });

  it("wypłata zmniejsza kapitał wpłacony", () => {
    const flows = [
      { date: day("2026-10-01"), amount: -1000 },
      { date: day("2026-10-06"), amount: 200 },
    ];
    // wpłacono 1000 − 200, wartość końcowa 850 → zysk 50
    expect(computePeriodReturnPct(flows, 850, day("2026-10-11"))).toBeCloseTo((50 / 900) * 100, 6);
  });

  it("brak przepływów albo okres zerowej długości → null", () => {
    expect(computePeriodReturnPct([], 100, day("2026-10-11"))).toBeNull();
    expect(computePeriodReturnPct([{ date: day("2026-10-11"), amount: -100 }], 100, day("2026-10-11"))).toBeNull();
  });
});

describe("wyświetlanie wyników rocznych", () => {
  it("poniżej roku pokazuje zwrot za okres z wyjaśnieniem", () => {
    const view = mwrDisplay({ xirrPct: 5400, historyDays: 5, periodReturnPct: 1.2 });
    expect(view).toMatchObject({ value: 1.2, period: true });
    expect(view.sub).toBe("za 5 dni · rocznie od 1 roku");
    expect(view.explanation).toContain("od roku historii");
    expect(dayCountLabel(1)).toBe("1 dzień");
  });

  it("od roku zostaje XIRR", () => {
    const view = mwrDisplay({ xirrPct: 12.3, historyDays: ANNUALIZATION_MIN_DAYS, periodReturnPct: 12 });
    expect(view).toMatchObject({ value: 12.3, period: false, explanation: null });
  });

  it("CAGR poniżej roku jest ukryty", () => {
    expect(annualizedOrNull({ historyDays: 30 }, 7)).toEqual({ value: null, shortHistory: true });
    expect(annualizedOrNull({ historyDays: 400 }, 7)).toEqual({ value: 7, shortHistory: false });
    expect(isShortHistory({})).toBe(false);
  });
});

describe("metryki snapshotu przy krótkiej historii", () => {
  it("udostępniają historyDays i periodReturnPct", () => {
    const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const records = [
      record("account", A, { recordType: "account", id: A, name: "Główny", baseCurrency: "PLN" }),
      record("transaction", "cccccccc-cccc-4ccc-8ccc-cccccccccccc", {
        recordType: "transaction", id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        date: "2026-10-01T10:00:00.000Z", portfolioID: A, instrumentID: null,
        transactionType: "cashDeposit", grossAmount: 1000, currency: "PLN", fees: 0, taxes: 0,
      }),
    ];
    const snapshot = buildInvestorDataSnapshot(records, {
      asOf: new Date("2026-10-11T12:00:00Z"),
      historyGranularity: "daily",
      useLatestTransactionFxRate: true,
      useMarketQuotes: true,
    });
    expect(snapshot.metrics.historyDays).toBe(10);
    // sama gotówka: wartość = wpłata → zwrot za okres 0
    expect(snapshot.metrics.periodReturnPct).toBeCloseTo(0, 6);
  });
});
