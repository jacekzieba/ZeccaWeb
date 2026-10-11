import { ASSET_CLASSES, type AssetClassKey } from "@/features/portfolios/asset-classes";
import { kindToAssetClass } from "./asset-class";

type ByClass = Record<AssetClassKey, number>;

export type RebalanceOrder = {
  key: AssetClassKey;
  action: "buy" | "sell";
  /** Amount to buy or sell, in the same currency as `currentByClass`. */
  amount: number;
  /** Drift (actual - target, in p.p.) of this class after the purchase. */
  resultingDriftPp: number;
};

export type RebalancePlan = {
  orders: RebalanceOrder[];
  preMaxDriftPp: number;
  postMaxDriftPp: number;
};

/**
 * Buy-only rebalancing: spends `contribution` on underweight classes so the largest
 * absolute drift from `target` (percent) is as small as possible. Never sells, so it
 * triggers no tax. Presentational only — it writes nothing to sync.
 *
 * Water-filling: find the drift level `d` at which topping every target class up to
 * `target + d` costs exactly `contribution`.
 */
export function planBuyOnlyRebalance(input: {
  target: Partial<Record<string, number>>;
  currentByClass: ByClass;
  contribution: number;
}): RebalancePlan {
  const { target, currentByClass, contribution } = input;
  const targetOf = (key: AssetClassKey) => Math.max(0, target[key] ?? 0);
  const current = ASSET_CLASSES.map(({ key }) => currentByClass[key] ?? 0);
  const currentTotal = current.reduce((s, v) => s + v, 0);
  const targetSum = ASSET_CLASSES.reduce((s, { key }) => s + targetOf(key), 0);

  const maxDrift = (values: number[], total: number) =>
    total > 0
      ? Math.max(...ASSET_CLASSES.map(({ key }, i) => Math.abs((values[i] / total) * 100 - targetOf(key))))
      : 0;
  const preMaxDriftPp = maxDrift(current, currentTotal);

  if (!(contribution > 0) || targetSum < 0.01) {
    return { orders: [], preMaxDriftPp, postMaxDriftPp: preMaxDriftPp };
  }

  const newTotal = currentTotal + contribution;
  const spendAt = (d: number) =>
    ASSET_CLASSES.reduce((sum, { key }, i) => {
      if (targetOf(key) <= 0) return sum;
      return sum + Math.max(0, ((targetOf(key) + d) / 100) * newTotal - current[i]);
    }, 0);

  // spendAt is non-decreasing in d; find d where it equals the contribution.
  let lo = -100;
  let hi = 100;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (spendAt(mid) < contribution) lo = mid;
    else hi = mid;
  }
  const level = (lo + hi) / 2;

  const raw = ASSET_CLASSES.map(({ key }, i) =>
    targetOf(key) <= 0 ? 0 : Math.max(0, ((targetOf(key) + level) / 100) * newTotal - current[i]),
  );
  const rawSum = raw.reduce((s, v) => s + v, 0);
  const scale = rawSum > 0 ? contribution / rawSum : 0;
  const amounts = raw.map((v) => Math.round(v * scale * 100) / 100);

  const after = current.map((v, i) => v + amounts[i]);
  const orders = ASSET_CLASSES.map(({ key }, i): RebalanceOrder => ({
    key,
    action: "buy",
    amount: amounts[i],
    resultingDriftPp: (after[i] / newTotal) * 100 - targetOf(key),
  }))
    .filter((order) => order.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  return { orders, preMaxDriftPp, postMaxDriftPp: maxDrift(after, newTotal) };
}

/** Belka: 19% on realized gains. */
export const CAPITAL_GAINS_TAX_RATE = 0.19;

/** Classes whose sale is not taxed as a capital gain here: cash, and deposits (interest is taxed at source). */
const UNTAXED_CLASSES: ReadonlySet<AssetClassKey> = new Set(["cash", "deposit"]);

/** Holdings of one class split by tax treatment (all in the plan's currency). */
export type TaxLots = {
  /** Value held in IKE/IKZE-type wrappers: selling it triggers no tax. */
  exemptValue: number;
  /** Value held in taxable accounts and its cost basis (FIFO). */
  taxableValue: number;
  taxableCost: number;
};

export type FullRebalancePlan = {
  orders: RebalanceOrder[];
  /** Estimated Belka on the sells; an estimate at class level, not a tax calculation. */
  estimatedTax: number;
  preMaxDriftPp: number;
  postMaxDriftPp: number;
};

/**
 * Full rebalancing: brings every class to its target share of `currentTotal + contribution`,
 * selling overweight classes and buying underweight ones. Sells draw on exempt-wrapper
 * holdings first, then on taxable ones at the class's average gain ratio. Presentational
 * only — it writes nothing to sync.
 */
export function planFullRebalance(input: {
  target: Partial<Record<string, number>>;
  currentByClass: ByClass;
  lotsByClass: Record<AssetClassKey, TaxLots>;
  contribution: number;
  taxRate?: number;
}): FullRebalancePlan {
  const { target, currentByClass, lotsByClass, contribution } = input;
  const taxRate = input.taxRate ?? CAPITAL_GAINS_TAX_RATE;
  const targetOf = (key: AssetClassKey) => Math.max(0, target[key] ?? 0);
  const targetSum = ASSET_CLASSES.reduce((s, { key }) => s + targetOf(key), 0);
  const currentTotal = ASSET_CLASSES.reduce((s, { key }) => s + (currentByClass[key] ?? 0), 0);
  const extra = Math.max(0, contribution);

  const maxDrift = (valueOf: (key: AssetClassKey) => number, total: number) =>
    total > 0
      ? Math.max(...ASSET_CLASSES.map(({ key }) => Math.abs((valueOf(key) / total) * 100 - targetOf(key))))
      : 0;
  const preMaxDriftPp = maxDrift((key) => currentByClass[key] ?? 0, currentTotal);

  if (targetSum < 0.01) {
    return { orders: [], estimatedTax: 0, preMaxDriftPp, postMaxDriftPp: preMaxDriftPp };
  }

  const newTotal = currentTotal + extra;
  const orders: RebalanceOrder[] = [];
  const after = new Map<AssetClassKey, number>();
  let estimatedTax = 0;

  for (const { key } of ASSET_CLASSES) {
    const value = currentByClass[key] ?? 0;
    // Share of the new total this class should hold, normalised so targets that don't sum to 100 still work.
    const ideal = (targetOf(key) / targetSum) * newTotal;
    const delta = Math.round((ideal - value) * 100) / 100;
    after.set(key, value + delta);
    if (Math.abs(delta) < 0.005) continue;
    if (delta > 0) {
      orders.push({ key, action: "buy", amount: delta, resultingDriftPp: 0 });
      continue;
    }
    const sell = Math.min(-delta, value);
    orders.push({ key, action: "sell", amount: sell, resultingDriftPp: 0 });
    if (UNTAXED_CLASSES.has(key)) continue;
    const lots = lotsByClass[key];
    const fromExempt = Math.min(sell, Math.max(0, lots.exemptValue));
    const fromTaxable = Math.min(sell - fromExempt, Math.max(0, lots.taxableValue));
    const gainRatio =
      lots.taxableValue > 0 ? Math.max(0, (lots.taxableValue - lots.taxableCost) / lots.taxableValue) : 0;
    estimatedTax += fromTaxable * gainRatio * taxRate;
  }

  const result = orders
    .map((order) => ({
      ...order,
      resultingDriftPp: newTotal > 0 ? ((after.get(order.key) ?? 0) / newTotal) * 100 - targetOf(order.key) : 0,
    }))
    .sort((a, b) => (a.action === b.action ? b.amount - a.amount : a.action === "sell" ? -1 : 1));

  return {
    orders: result,
    estimatedTax: Math.round(estimatedTax * 100) / 100,
    preMaxDriftPp,
    postMaxDriftPp: maxDrift((key) => after.get(key) ?? 0, newTotal),
  };
}

/**
 * Splits holdings into per-class tax lots. A missing cost basis is treated as "no gain"
 * (cost = value), so the tax estimate errs low rather than inventing a gain.
 */
export function buildTaxLots(
  holdings: ReadonlyArray<{ kind: string; marketValue: number; costBasis?: number; exempt: boolean }>,
): Record<AssetClassKey, TaxLots> {
  const result = {} as Record<AssetClassKey, TaxLots>;
  for (const { key } of ASSET_CLASSES) result[key] = { exemptValue: 0, taxableValue: 0, taxableCost: 0 };
  for (const holding of holdings) {
    const lots = result[kindToAssetClass(holding.kind)];
    if (holding.exempt) {
      lots.exemptValue += holding.marketValue;
    } else {
      lots.taxableValue += holding.marketValue;
      lots.taxableCost += holding.costBasis ?? holding.marketValue;
    }
  }
  return result;
}
