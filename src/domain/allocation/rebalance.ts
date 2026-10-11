import { ASSET_CLASSES, type AssetClassKey } from "@/features/portfolios/asset-classes";

type ByClass = Record<AssetClassKey, number>;

export type RebalanceOrder = {
  key: AssetClassKey;
  /** Amount to buy, in the same currency as `currentByClass`. */
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
    amount: amounts[i],
    resultingDriftPp: (after[i] / newTotal) * 100 - targetOf(key),
  }))
    .filter((order) => order.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  return { orders, preMaxDriftPp, postMaxDriftPp: maxDrift(after, newTotal) };
}
