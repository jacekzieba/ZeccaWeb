"use client";

import { useMemo } from "react";
import { useProfile, type DisplayCurrency } from "@/features/profile/profile-store";
import { hasDisplayCurrencyRate } from "@/sync/records/investor-snapshot";
import { useSyncStore } from "@/sync/store/sync-store";

export type EffectiveDisplayCurrency = {
  /** Currency amounts are computed and labelled in. */
  currency: DisplayCurrency;
  /** Currency picked in Settings. */
  requested: DisplayCurrency;
  /** True while `requested` has no rate, so amounts stay in PLN. */
  missingRate: boolean;
};

/**
 * The display currency to compute and label amounts in: the one picked in
 * Settings once a rate for it exists, PLN until then. Without this, PLN figures
 * were labelled USD/EUR before the NBP series loaded or when it failed
 * (DATA-002, parity with native `AppStore.displayCurrency`).
 */
export function useDisplayCurrency(): EffectiveDisplayCurrency {
  const { displayCurrency } = useProfile();
  const records = useSyncStore((s) => s.records);
  const marketFxRates = useSyncStore((s) => s.marketFxRates);

  return useMemo(() => {
    const missingRate =
      displayCurrency !== "PLN" &&
      !hasDisplayCurrencyRate(records, displayCurrency, marketFxRates, new Date());
    return {
      currency: missingRate ? "PLN" : displayCurrency,
      requested: displayCurrency,
      missingRate,
    };
  }, [displayCurrency, records, marketFxRates]);
}
