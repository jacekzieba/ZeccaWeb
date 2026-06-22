import { describe, expect, it } from "vitest";
import {
  ASSET_CLASSES,
  emptyAllocation,
  readAllocation,
  sumAllocation,
} from "@/features/portfolios/asset-classes";

describe("asset-class allocation helpers", () => {
  it("covers exactly the six macOS asset classes in order", () => {
    expect(ASSET_CLASSES.map((c) => c.key)).toEqual([
      "equity",
      "bonds",
      "crypto",
      "other",
      "deposit",
      "cash",
    ]);
  });

  it("zeroes every class for an empty allocation", () => {
    expect(emptyAllocation()).toEqual({
      equity: 0,
      bonds: 0,
      crypto: 0,
      other: 0,
      deposit: 0,
      cash: 0,
    });
  });

  it("reads known keys, drops unknown ones, and fills missing with 0", () => {
    expect(readAllocation({ equity: 65, bonds: 35, legacy: 10 })).toEqual({
      equity: 65,
      bonds: 35,
      crypto: 0,
      other: 0,
      deposit: 0,
      cash: 0,
    });
  });

  it("clamps out-of-range shares to 0–100", () => {
    const result = readAllocation({ equity: 150, cash: -20 });
    expect(result.equity).toBe(100);
    expect(result.cash).toBe(0);
  });

  it("handles a missing allocation", () => {
    expect(readAllocation(undefined)).toEqual(emptyAllocation());
    expect(readAllocation(null)).toEqual(emptyAllocation());
  });

  it("sums all class shares", () => {
    expect(sumAllocation(readAllocation({ equity: 65, bonds: 35 }))).toBe(100);
    expect(sumAllocation(emptyAllocation())).toBe(0);
  });
});
