import type { InvestorDataSnapshot } from "@/domain/models/investor-data";
import { buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";
import { buildFakeSyncRecords } from "@/sync/dev/fake-sync";

export const LANDING_DEMO_AS_OF = "2026-06-15T12:00:00.000Z";
const LANDING_PREVIEW_ALLOCATION_LABELS = ["Akcje / ETF", "Kryptowaluty", "Gotówka"];

function gaussian(value: number, center: number, width: number) {
  return Math.exp(-Math.pow((value - center) / width, 2));
}

function shapeLandingValuationSeries(
  valuationSeries: InvestorDataSnapshot["valuationSeries"],
  netInvestedSeries: InvestorDataSnapshot["netInvestedSeries"],
) {
  const length = Math.min(valuationSeries.length, netInvestedSeries.length);
  if (length < 3) return valuationSeries;

  const initialGain = valuationSeries[0].value - netInvestedSeries[0].value;
  const finalGain = valuationSeries[length - 1].value - netInvestedSeries[length - 1].value;
  const deviations = valuationSeries.slice(0, length).map((point, index) => {
    const progress = index / (length - 1);
    const cycles =
      Math.sin(index * 0.045 + 0.6) * 0.016 +
      Math.sin(index * 0.13 + 1.4) * 0.013 +
      Math.sin(index * 0.37 + 0.2) * 0.008 +
      Math.sin(index * 0.83 + 2.4) * 0.004;
    const drawdowns =
      gaussian(progress, 0.38, 0.055) * -0.028 +
      gaussian(progress, 0.74, 0.035) * -0.018;
    return point.value * (cycles + drawdowns);
  });
  const firstDeviation = deviations[0];
  const lastDeviation = deviations[length - 1];

  return valuationSeries.map((point, index) => {
    if (index >= length) return point;
    if (index === 0 || index === length - 1) return point;

    const progress = index / (length - 1);
    const growthProgress = progress * 0.22 + Math.pow(progress, 1.18) * 0.78;
    const invested = netInvestedSeries[index].value;
    const gain = initialGain + (finalGain - initialGain) * growthProgress;
    const anchoredDeviation =
      deviations[index] - firstDeviation * (1 - progress) - lastDeviation * progress;
    const value = Math.max(invested * 0.94, invested + gain + anchoredDeviation);

    return { ...point, value: Math.round(value * 100) / 100 };
  });
}

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
  const valuationSeries = shapeLandingValuationSeries(
    snapshot.valuationSeries,
    snapshot.netInvestedSeries,
  );

  return {
    ...snapshot,
    valuationSeries,
    allocation: featuredAllocation.length === 3
      ? normalizeAllocationPercentages(featuredAllocation)
      : snapshot.allocation.slice(0, 3),
  };
}
