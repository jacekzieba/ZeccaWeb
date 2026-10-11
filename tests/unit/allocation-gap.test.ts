import { describe, expect, it } from "vitest";
import { kindToAssetClass } from "@/domain/allocation/asset-class";
import {
  GAP_NEUTRAL_PP,
  aggregateTarget,
  buildAllocationGap,
  computeActualAllocation,
} from "@/domain/allocation/allocation-gap";

const holding = (kind: string, marketValue: number) => ({ kind, marketValue });

describe("kindToAssetClass", () => {
  it.each([
    ["stock", "equity"],
    ["etf", "equity"],
    ["treasuryBond", "bonds"],
    ["listedBond", "bonds"],
    ["crypto", "crypto"],
    ["otherAsset", "other"],
    ["deposit", "deposit"],
    ["cash", "cash"],
    ["somethingNew", "other"],
    [undefined, "other"],
  ] as const)("%s -> %s", (kind, expected) => {
    expect(kindToAssetClass(kind)).toBe(expected);
  });
});

describe("computeActualAllocation", () => {
  it("buckets holdings by class as percent of total holdings value", () => {
    const actual = computeActualAllocation([
      holding("etf", 300),
      holding("stock", 100),
      holding("treasuryBond", 100),
    ]);
    expect(actual.equity).toBeCloseTo(80);
    expect(actual.bonds).toBeCloseTo(20);
    expect(actual.crypto).toBe(0);
  });

  it("returns zeros when there is no value", () => {
    const actual = computeActualAllocation([]);
    expect(Object.values(actual).every((v) => v === 0)).toBe(true);
  });
});

describe("aggregateTarget", () => {
  it("weights each portfolio's target by its value share of ALL portfolios", () => {
    const target = aggregateTarget([
      { totalValue: 750, target: { equity: 80, bonds: 20 } },
      { totalValue: 250, target: {} },
    ]);
    expect(target.equity).toBeCloseTo(60);
    expect(target.bonds).toBeCloseTo(15);
  });

  it("is all zeros when total value is not positive", () => {
    const target = aggregateTarget([{ totalValue: 0, target: { equity: 100 } }]);
    expect(target.equity).toBe(0);
  });
});

describe("buildAllocationGap", () => {
  const actual = computeActualAllocation([holding("etf", 70), holding("treasuryBond", 30)]);

  it("has one row per asset class and signed delta in percentage points", () => {
    const gap = buildAllocationGap({ equity: 60, bonds: 40 }, actual);
    expect(gap.hasTarget).toBe(true);
    expect(gap.rows.map((r) => r.key)).toEqual(["equity", "bonds", "crypto", "other", "deposit", "cash"]);
    const equity = gap.rows.find((r) => r.key === "equity")!;
    expect(equity.targetPct).toBe(60);
    expect(equity.actualPct).toBeCloseTo(70);
    expect(equity.deltaPp).toBeCloseTo(10);
    expect(equity.tone).toBe("over");
    expect(gap.rows.find((r) => r.key === "bonds")!.tone).toBe("under");
  });

  it("treats |delta| below 1 pp as neutral", () => {
    const gap = buildAllocationGap({ equity: 69.5, bonds: 30.5 }, actual);
    expect(gap.rows.find((r) => r.key === "equity")!.tone).toBe("neutral");
    expect(GAP_NEUTRAL_PP).toBe(1);
  });

  it("reports no plan when target sums below 0.01", () => {
    const gap = buildAllocationGap({}, actual);
    expect(gap.hasTarget).toBe(false);
    expect(gap.rows.every((r) => r.targetPct === null && r.deltaPp === null)).toBe(true);
    expect(gap.rows.find((r) => r.key === "equity")!.actualPct).toBeCloseTo(70);
  });

  it("shows a class held but absent from the plan as fully over", () => {
    const gap = buildAllocationGap({ equity: 100 }, actual);
    const bonds = gap.rows.find((r) => r.key === "bonds")!;
    expect(bonds.targetPct).toBe(0);
    expect(bonds.tone).toBe("over");
  });
});
