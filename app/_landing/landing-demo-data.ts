import type { InvestorDataSnapshot } from "@/domain/models/investor-data";
import { buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";
import { buildFakeSyncRecords } from "@/sync/dev/fake-sync";

export const LANDING_DEMO_AS_OF = "2026-06-15T12:00:00.000Z";
const LANDING_PREVIEW_ALLOCATION_LABELS = ["Akcje / ETF", "Kryptowaluty", "Gotówka"];

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
      ? featuredAllocation
      : snapshot.allocation.slice(0, 3),
  };
}
