"use client";

import { useSyncExternalStore } from "react";
import {
  getAnalyticsConsent,
  subscribeAnalyticsConsent,
  type AnalyticsConsent,
} from "@/lib/analytics-consent";

/**
 * Bieżąca decyzja o statystykach użycia. `undefined` przy renderze serwerowym i
 * hydratacji — serwer nie zna localStorage, więc do tego czasu nie pokazujemy
 * ani pytania, ani skryptów analityki.
 */
export function useAnalyticsConsent(): AnalyticsConsent | undefined {
  return useSyncExternalStore<AnalyticsConsent | undefined>(
    subscribeAnalyticsConsent,
    getAnalyticsConsent,
    () => undefined,
  );
}
