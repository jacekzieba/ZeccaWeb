import {
  ASSET_CLASSES,
  emptyAllocation,
  sumAllocation,
  type AssetClassKey,
} from "@/features/portfolios/asset-classes";
import { kindToAssetClass } from "./asset-class";

/** Native `AllocationGapRow`: a delta under 1 p.p. is shown as neutral. Not configurable. */
export const GAP_NEUTRAL_PP = 1;

type Allocation = Record<AssetClassKey, number>;

export type GapTone = "neutral" | "over" | "under";

export type GapRow = {
  key: AssetClassKey;
  /** null when no target plan is set. */
  targetPct: number | null;
  actualPct: number;
  /** actual - target in percentage points; null when no target plan is set. */
  deltaPp: number | null;
  tone: GapTone;
};

export type AllocationGap = {
  rows: GapRow[];
  hasTarget: boolean;
};

/** Market value per asset class (holdings only; portfolio cash is not included). */
export function sumByAssetClass(
  holdings: ReadonlyArray<{ kind: string; marketValue: number }>,
): Allocation {
  const result = emptyAllocation();
  for (const h of holdings) result[kindToAssetClass(h.kind)] += h.marketValue;
  return result;
}

/** Native `currentAllocation`: holdings only (portfolio cash is not included), as % of their total. */
export function computeActualAllocation(
  holdings: ReadonlyArray<{ kind: string; marketValue: number }>,
): Allocation {
  const values = sumByAssetClass(holdings);
  const total = holdings.reduce((sum, h) => sum + h.marketValue, 0);
  if (!(total > 0)) return values;
  for (const { key } of ASSET_CLASSES) values[key] = (values[key] / total) * 100;
  return values;
}

/**
 * Native aggregate target across portfolios: each portfolio's target weighted by its share of the
 * total value of ALL portfolios (portfolios without a plan pull the aggregate toward zero).
 */
export function aggregateTarget(
  portfolios: ReadonlyArray<{ totalValue: number; target: Partial<Record<string, number>> }>,
): Allocation {
  const result = emptyAllocation();
  const total = portfolios.reduce((sum, p) => sum + Math.max(0, p.totalValue), 0);
  if (!(total > 0)) return result;
  for (const p of portfolios) {
    if (!(p.totalValue > 0)) continue;
    const weight = p.totalValue / total;
    for (const { key } of ASSET_CLASSES) result[key] += (p.target[key] ?? 0) * weight;
  }
  return result;
}

export function buildAllocationGap(
  target: Partial<Record<string, number>>,
  actual: Allocation,
): AllocationGap {
  const hasTarget = sumAllocation(target as Record<string, number>) >= 0.01;
  const rows = ASSET_CLASSES.map(({ key }): GapRow => {
    const actualPct = actual[key] ?? 0;
    if (!hasTarget) return { key, targetPct: null, actualPct, deltaPp: null, tone: "neutral" };
    const targetPct = target[key] ?? 0;
    const deltaPp = actualPct - targetPct;
    const tone: GapTone =
      Math.abs(deltaPp) < GAP_NEUTRAL_PP ? "neutral" : deltaPp > 0 ? "over" : "under";
    return { key, targetPct, actualPct, deltaPp, tone };
  });
  return { rows, hasTarget };
}
