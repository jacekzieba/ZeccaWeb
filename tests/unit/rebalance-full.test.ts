import { describe, expect, it } from "vitest";
import { buildTaxLots, planFullRebalance, type TaxLots } from "@/domain/allocation/rebalance";
import { emptyAllocation, type AssetClassKey } from "@/features/portfolios/asset-classes";

function lots(partial: Partial<Record<AssetClassKey, Partial<TaxLots>>>): Record<AssetClassKey, TaxLots> {
  const result = {} as Record<AssetClassKey, TaxLots>;
  for (const key of Object.keys(emptyAllocation()) as AssetClassKey[]) {
    result[key] = { exemptValue: 0, taxableValue: 0, taxableCost: 0, ...partial[key] };
  }
  return result;
}

const current = (v: Partial<Record<AssetClassKey, number>>) => ({ ...emptyAllocation(), ...v });
const order = (plan: ReturnType<typeof planFullRebalance>, key: AssetClassKey) =>
  plan.orders.find((o) => o.key === key);

describe("planFullRebalance", () => {
  it("sells the overweight class and buys the underweight one to hit the target", () => {
    const plan = planFullRebalance({
      target: { equity: 50, bonds: 50 },
      currentByClass: current({ equity: 800, bonds: 200 }),
      lotsByClass: lots({ equity: { taxableValue: 800, taxableCost: 400 } }),
      contribution: 0,
    });
    expect(order(plan, "equity")).toMatchObject({ action: "sell" });
    expect(order(plan, "equity")!.amount).toBeCloseTo(300, 2);
    expect(order(plan, "bonds")).toMatchObject({ action: "buy" });
    expect(order(plan, "bonds")!.amount).toBeCloseTo(300, 2);
    expect(plan.postMaxDriftPp).toBeCloseTo(0, 1);
    // 300 sold at a 50% gain ratio, 19% tax
    expect(plan.estimatedTax).toBeCloseTo(28.5, 2);
  });

  it("sells from tax-wrapper (exempt) holdings first", () => {
    const plan = planFullRebalance({
      target: { equity: 50, bonds: 50 },
      currentByClass: current({ equity: 800, bonds: 200 }),
      lotsByClass: lots({ equity: { exemptValue: 100, taxableValue: 700, taxableCost: 350 } }),
      contribution: 0,
    });
    // 300 sold: 100 exempt, 200 taxable at 50% gain => 200 * 0.5 * 0.19
    expect(plan.estimatedTax).toBeCloseTo(19, 2);
  });

  it("charges no tax when everything sold sits in an exempt wrapper", () => {
    const plan = planFullRebalance({
      target: { equity: 50, bonds: 50 },
      currentByClass: current({ equity: 800, bonds: 200 }),
      lotsByClass: lots({ equity: { exemptValue: 800 } }),
      contribution: 0,
    });
    expect(plan.estimatedTax).toBe(0);
  });

  it("does not tax a sale at a loss", () => {
    const plan = planFullRebalance({
      target: { equity: 50, bonds: 50 },
      currentByClass: current({ equity: 800, bonds: 200 }),
      lotsByClass: lots({ equity: { taxableValue: 800, taxableCost: 1000 } }),
      contribution: 0,
    });
    expect(plan.estimatedTax).toBe(0);
  });

  it("treats cash and deposits as untaxed", () => {
    const plan = planFullRebalance({
      target: { equity: 100 },
      currentByClass: current({ cash: 500, deposit: 500 }),
      lotsByClass: lots({ cash: { taxableValue: 500, taxableCost: 100 }, deposit: { taxableValue: 500, taxableCost: 100 } }),
      contribution: 0,
    });
    expect(plan.estimatedTax).toBe(0);
    expect(order(plan, "equity")!.amount).toBeCloseTo(1000, 2);
  });

  it("balances buys and sells against the contribution", () => {
    const plan = planFullRebalance({
      target: { equity: 50, bonds: 50 },
      currentByClass: current({ equity: 800, bonds: 200 }),
      lotsByClass: lots({ equity: { taxableValue: 800, taxableCost: 800 } }),
      contribution: 500,
    });
    const buys = plan.orders.filter((o) => o.action === "buy").reduce((s, o) => s + o.amount, 0);
    const sells = plan.orders.filter((o) => o.action === "sell").reduce((s, o) => s + o.amount, 0);
    expect(buys - sells).toBeCloseTo(500, 2);
  });

  it("returns an empty plan without a target", () => {
    const plan = planFullRebalance({
      target: {},
      currentByClass: current({ equity: 100 }),
      lotsByClass: lots({}),
      contribution: 100,
    });
    expect(plan.orders).toEqual([]);
    expect(plan.estimatedTax).toBe(0);
  });
});

describe("buildTaxLots", () => {
  it("splits holdings per class by exempt vs taxable and treats unknown cost as no gain", () => {
    const result = buildTaxLots([
      { kind: "etf", marketValue: 100, costBasis: 60, exempt: false },
      { kind: "stock", marketValue: 50, exempt: false },
      { kind: "etf", marketValue: 200, costBasis: 10, exempt: true },
      { kind: "treasuryBond", marketValue: 30, costBasis: 30, exempt: false },
    ]);
    expect(result.equity).toEqual({ exemptValue: 200, taxableValue: 150, taxableCost: 110 });
    expect(result.bonds).toEqual({ exemptValue: 0, taxableValue: 30, taxableCost: 30 });
  });
});
