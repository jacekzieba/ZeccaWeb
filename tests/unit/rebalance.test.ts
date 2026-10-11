import { describe, expect, it } from "vitest";
import { planBuyOnlyRebalance } from "@/domain/allocation/rebalance";
import { sumByAssetClass } from "@/domain/allocation/allocation-gap";

const values = (v: Partial<Record<string, number>>) => sumByAssetClass(
  Object.entries(v).map(([kind, marketValue]) => ({ kind, marketValue: marketValue ?? 0 })),
);

describe("planBuyOnlyRebalance", () => {
  it("never sells and spends exactly the contribution", () => {
    const plan = planBuyOnlyRebalance({
      target: { equity: 60, bonds: 40 },
      currentByClass: values({ etf: 800, treasuryBond: 200 }),
      contribution: 100,
    });
    expect(plan.orders.every((o) => o.amount > 0 && o.action === "buy")).toBe(true);
    expect(plan.orders.reduce((s, o) => s + o.amount, 0)).toBeCloseTo(100, 2);
    // equity is already over target: everything goes to bonds
    expect(plan.orders).toHaveLength(1);
    expect(plan.orders[0].key).toBe("bonds");
    expect(plan.postMaxDriftPp).toBeLessThan(plan.preMaxDriftPp);
  });

  it("reaches the target exactly when the contribution is large enough", () => {
    const plan = planBuyOnlyRebalance({
      target: { equity: 50, bonds: 50 },
      currentByClass: values({ etf: 600, treasuryBond: 200 }),
      contribution: 400,
    });
    const bonds = plan.orders.find((o) => o.key === "bonds")!;
    expect(bonds.amount).toBeCloseTo(400, 2);
    expect(plan.postMaxDriftPp).toBeCloseTo(0, 1);
  });

  it("splits between underweight classes by equalizing drift", () => {
    const plan = planBuyOnlyRebalance({
      target: { equity: 50, bonds: 30, crypto: 20 },
      currentByClass: values({ etf: 1000 }),
      contribution: 1000,
    });
    const by = Object.fromEntries(plan.orders.map((o) => [o.key, o.amount]));
    expect(by.bonds).toBeCloseTo(600, 0);
    expect(by.crypto).toBeCloseTo(400, 0);
    expect(by.equity ?? 0).toBe(0);
  });

  it("never buys classes with no target", () => {
    const plan = planBuyOnlyRebalance({
      target: { equity: 100 },
      currentByClass: values({ etf: 100, crypto: 100 }),
      contribution: 100,
    });
    expect(plan.orders.map((o) => o.key)).toEqual(["equity"]);
  });

  it("returns an empty plan with no target or no contribution", () => {
    const current = values({ etf: 100 });
    expect(planBuyOnlyRebalance({ target: {}, currentByClass: current, contribution: 100 }).orders).toEqual([]);
    expect(planBuyOnlyRebalance({ target: { equity: 100 }, currentByClass: current, contribution: 0 }).orders).toEqual([]);
  });

  it("works from an empty portfolio by following the target split", () => {
    const plan = planBuyOnlyRebalance({
      target: { equity: 75, bonds: 25 },
      currentByClass: values({}),
      contribution: 1000,
    });
    const by = Object.fromEntries(plan.orders.map((o) => [o.key, o.amount]));
    expect(by.equity).toBeCloseTo(750, 2);
    expect(by.bonds).toBeCloseTo(250, 2);
  });
});
