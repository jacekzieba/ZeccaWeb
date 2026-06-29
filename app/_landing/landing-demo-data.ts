import type { InvestorDataSnapshot } from "@/domain/models/investor-data";
import { buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";
import { buildFakeSyncRecords } from "@/sync/dev/fake-sync";

export const LANDING_DEMO_AS_OF = "2026-06-15T12:00:00.000Z";
const LANDING_PREVIEW_ALLOCATION_LABELS = ["Akcje / ETF", "Kryptowaluty", "Gotówka"];

function normalizeAllocationPercentages<T extends { percent: number }>(slices: T[]): T[] {
  const total = slices.reduce((sum, slice) => sum + slice.percent, 0);
  if (total <= 0) return slices;

  const targetTenths = 1000;
  const normalized = slices.map((slice, index) => {
    const rawTenths = (slice.percent / total) * targetTenths;
    const baseTenths = Math.floor(rawTenths);
    return {
      slice,
      index,
      baseTenths,
      remainder: rawTenths - baseTenths,
    };
  });

  let remainingTenths = targetTenths - normalized.reduce((sum, item) => sum + item.baseTenths, 0);
  const byRemainder = [...normalized].sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const item of byRemainder) {
    if (remainingTenths <= 0) break;
    item.baseTenths += 1;
    remainingTenths -= 1;
  }

  return normalized
    .sort((a, b) => a.index - b.index)
    .map(({ slice, baseTenths }) => ({ ...slice, percent: baseTenths / 10 }));
}

/** Public, deterministic data for the landing preview. It never reads user state
 * and deliberately avoids live market data, sync, or API calls. */
export function buildLandingDemoSnapshot(): InvestorDataSnapshot {
  const snapshot = buildInvestorDataSnapshot(buildFakeSyncRecords(), {
    asOf: new Date(LANDING_DEMO_AS_OF),
    historyGranularity: "daily",
    useLatestTransactionFxRate: true,
    useMarketQuotes: false,
    displayCurrency: "PLN",
  });

  const featuredAllocation = LANDING_PREVIEW_ALLOCATION_LABELS
    .map((label) => snapshot.allocation.find((slice) => slice.label === label))
    .filter((slice): slice is NonNullable<typeof slice> => Boolean(slice));

  return {
    ...snapshot,
    allocation: featuredAllocation.length === 3
      ? normalizeAllocationPercentages(featuredAllocation)
      : snapshot.allocation.slice(0, 3),
  };
}
