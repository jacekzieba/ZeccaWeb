import { describe, expect, it } from "vitest";
import {
  MODEL_BENCHMARKS,
  buildBenchmarkSeries,
  growthFromMonthly,
  toMonthly,
} from "@/domain/benchmark/model-benchmarks";

const point = (date: string, value: number) => ({ label: date, date, value });

describe("buildBenchmarkSeries", () => {
  const sp500 = MODEL_BENCHMARKS.find((b) => b.id === "sp500")!;

  it("starts at 100 and has one point per requested month", () => {
    const series = buildBenchmarkSeries(sp500, 25);
    expect(series.growth).toHaveLength(25);
    expect(series.growth[0]).toBe(100);
    expect(series.returns).toHaveLength(24);
  });

  it("lands exactly on the assumed CAGR over its span", () => {
    const months = 37; // three years
    const series = buildBenchmarkSeries(sp500, months);
    const years = (months - 1) / 12;
    const cagr = Math.pow(series.growth.at(-1)! / 100, 1 / years) - 1;
    expect(cagr).toBeCloseTo(sp500.cagr, 6);
  });

  it("is deterministic for a given seed and differs between seeds", () => {
    const a = buildBenchmarkSeries(sp500, 13);
    const b = buildBenchmarkSeries(sp500, 13);
    const other = buildBenchmarkSeries({ ...sp500, seed: sp500.seed + 1 }, 13);
    expect(a.growth).toEqual(b.growth);
    expect(other.growth).not.toEqual(a.growth);
  });

  it("clamps to at least two points", () => {
    expect(buildBenchmarkSeries(sp500, 0).growth).toHaveLength(2);
  });

  it("exposes the four model portfolios with assumed parameters", () => {
    expect(MODEL_BENCHMARKS.map((b) => b.id)).toEqual(["allweather", "6040", "permanent", "sp500"]);
  });
});

describe("toMonthly", () => {
  it("keeps the last point of each calendar month in date order", () => {
    const monthly = toMonthly([
      point("2025-02-03", 3),
      point("2025-01-10", 1),
      point("2025-01-28", 2),
      point("2025-02-20", 4),
    ]);
    expect(monthly.map((p) => p.value)).toEqual([2, 4]);
  });
});

describe("growthFromMonthly", () => {
  it("rebases to 100 and derives month-over-month returns", () => {
    const g = growthFromMonthly([point("2025-01-31", 200), point("2025-02-28", 220), point("2025-03-31", 198)]);
    expect(g.growth[0]).toBe(100);
    expect(g.growth[1]).toBeCloseTo(110);
    expect(g.returns[0]).toBeCloseTo(0.1);
    expect(g.returns[1]).toBeCloseTo(-0.1);
    expect(g.labels).toHaveLength(3);
  });

  it("returns a flat placeholder when there is not enough history", () => {
    const g = growthFromMonthly([point("2025-01-31", 200)]);
    expect(g.growth).toEqual([100, 100]);
    expect(g.returns).toEqual([0]);
  });
});
