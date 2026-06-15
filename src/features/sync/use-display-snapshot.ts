"use client";

import { useMemo } from "react";
import type { InvestorDataSnapshot } from "@/domain/models/investor-data";
import { buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";
import { useProfile } from "@/features/profile/profile-store";
import { useSyncStore } from "@/sync/store/sync-store";

/**
 * The dashboard snapshot rebuilt in the user's chosen display currency.
 *
 * Decrypted records stay in the browser; this recomputes the PLN snapshot and
 * converts every monetary field into `profile.displayCurrency` using the NBP
 * rates already loaded into the store. When the currency is PLN (the default)
 * the result is byte-identical to the native computation, so nothing changes
 * for users who never switch currency.
 *
 * Falls back to the bootstrap store snapshot before records have decrypted.
 */
export function useDisplaySnapshot(): InvestorDataSnapshot | null {
  const records = useSyncStore((s) => s.records);
  const marketFxRates = useSyncStore((s) => s.marketFxRates);
  const storeSnapshot = useSyncStore((s) => s.snapshot);
  const { displayCurrency } = useProfile();

  return useMemo(() => {
    if (!records) return storeSnapshot;
    return buildInvestorDataSnapshot(records, {
      fxRates: marketFxRates,
      historyGranularity: "daily",
      useMarketQuotes: true,
      displayCurrency,
    });
  }, [records, marketFxRates, displayCurrency, storeSnapshot]);
}
