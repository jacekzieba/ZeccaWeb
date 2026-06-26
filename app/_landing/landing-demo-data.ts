import type { InvestorDataSnapshot } from "@/domain/models/investor-data";
import { buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";
import { buildFakeSyncRecords } from "@/sync/dev/fake-sync";

export const LANDING_DEMO_AS_OF = "2026-06-15T12:00:00.000Z";

/** Public, deterministic data for the landing preview. It never reads user state
 * and deliberately avoids live market data, sync, or API calls. */
export function buildLandingDemoSnapshot(): InvestorDataSnapshot {
  return buildInvestorDataSnapshot(buildFakeSyncRecords(), {
    asOf: new Date(LANDING_DEMO_AS_OF),
    historyGranularity: "daily",
    useLatestTransactionFxRate: true,
    useMarketQuotes: false,
    displayCurrency: "PLN",
  });
}
