import { describe, expect, it } from "vitest";
import {
  currencyBreakdown,
  drawdownSeries,
  inflationIndexSeries,
  pnlOverTimeSeries,
  rebaseToHundred,
} from "@/domain/metrics/chart-series";
import { computeMaxDrawdownPct } from "@/domain/metrics/portfolio-metrics";

const pt = (date: string, value: number) => ({ label: date, date, value });

describe("drawdownSeries", () => {
  const perf = [pt("2025-01-01", 100), pt("2025-02-01", 120), pt("2025-03-01", 90), pt("2025-04-01", 130)];

  it("is the percent below the running peak, never positive", () => {
    const dd = drawdownSeries(perf).map((p) => p.value);
    expect(dd[0]).toBe(0);
    expect(dd[1]).toBe(0);
    expect(dd[2]).toBeCloseTo(-25);
    expect(dd[3]).toBe(0);
  });

  it("its minimum equals the max-drawdown KPI", () => {
    const min = Math.min(...drawdownSeries(perf).map((p) => p.value));
    expect(min).toBeCloseTo(computeMaxDrawdownPct(perf.map((p) => p.value)));
  });

  it("keeps date and label of the source points", () => {
    expect(drawdownSeries(perf)[2].date).toBe("2025-03-01");
  });
});

describe("pnlOverTimeSeries", () => {
  it("is value minus net invested at each point", () => {
    const pnl = pnlOverTimeSeries(
      [pt("2025-01-01", 1000), pt("2025-02-01", 1500)],
      [pt("2025-01-01", 1000), pt("2025-02-01", 1200)],
    );
    expect(pnl.map((p) => p.value)).toEqual([0, 300]);
  });

  it("clamps to the shorter series", () => {
    const pnl = pnlOverTimeSeries([pt("a", 1), pt("b", 2), pt("c", 3)], [pt("a", 1)]);
    expect(pnl).toHaveLength(1);
  });
});

describe("rebaseToHundred", () => {
  it("starts at 100", () => {
    const r = rebaseToHundred([pt("2025-01-01", 250), pt("2025-02-01", 275)]);
    expect(r[0].value).toBe(100);
    expect(r[1].value).toBeCloseTo(110);
  });
  it("returns an empty array for an empty or zero-based series", () => {
    expect(rebaseToHundred([])).toEqual([]);
    expect(rebaseToHundred([pt("a", 0), pt("b", 5)])).toEqual([]);
  });
});

describe("inflationIndexSeries", () => {
  it("compounds the annual rate over elapsed time on the same dates", () => {
    const perf = [pt("2024-01-01", 100), pt("2025-01-01", 110), pt("2026-01-01", 120)];
    const idx = inflationIndexSeries(perf, 5);
    expect(idx.map((p) => p.date)).toEqual(perf.map((p) => p.date));
    expect(idx[0].value).toBe(100);
    expect(idx[1].value).toBeCloseTo(105, 0);
    expect(idx[2].value).toBeCloseTo(110.25, 0);
  });
});

describe("currencyBreakdown", () => {
  it("sums market value per currency as sorted percent shares", () => {
    const slices = currencyBreakdown([
      { currency: "PLN", marketValue: 600 },
      { currency: "USD", marketValue: 300 },
      { currency: "pln", marketValue: 100 },
      { currency: "EUR", marketValue: 0 },
    ]);
    expect(slices).toEqual([
      { label: "PLN", percent: 70 },
      { label: "USD", percent: 30 },
    ]);
  });
  it("is empty without value", () => {
    expect(currencyBreakdown([])).toEqual([]);
  });
});
