"use client";

import { useEffect } from "react";
import { buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";
import { buildFakeSyncRecords, createFakeUserDataKey } from "@/sync/dev/fake-sync";
import {
  ASOF,
  CPI,
  FX,
  buildCertificationRecords,
} from "@/sync/dev/certification-scenario";
import { useSyncStore } from "@/sync/store/sync-store";
import { isFakeSyncEnabled, publicEnv } from "@/lib/env";
import type { BrowserSupabaseClient } from "@/supabase/client";

export function FakeSyncBootstrap() {
  const setCredentials = useSyncStore((state) => state.setCredentials);
  const setSync = useSyncStore((state) => state.setSync);
  const setMarketFxRates = useSyncStore((state) => state.setMarketFxRates);
  const setMarketCpi = useSyncStore((state) => state.setMarketCpi);
  const setMarketMetricsCpi = useSyncStore((state) => state.setMarketMetricsCpi);

  useEffect(() => {
    if (!isFakeSyncEnabled()) {
      return;
    }

    let cancelled = false;

    async function seedFakeSync() {
      const certification = publicEnv.NEXT_PUBLIC_FAKE_SYNC_DATASET === "certification";
      const records = certification ? buildCertificationRecords() : buildFakeSyncRecords();
      const snapshot = buildInvestorDataSnapshot(records, {
        asOf: certification ? ASOF : new Date("2026-06-15T12:00:00.000Z"),
        fxRates: certification ? FX : undefined,
        cpi: certification ? CPI : undefined,
        historyGranularity: "daily",
        useLatestTransactionFxRate: true,
        useMarketQuotes: true,
      });
      const userDataKey = await createFakeUserDataKey();

      if (cancelled) {
        return;
      }

      setCredentials(userDataKey, {} as BrowserSupabaseClient);
      if (certification) {
        setMarketFxRates(FX);
        setMarketCpi(CPI);
        setMarketMetricsCpi(CPI);
      }
      setSync(records, snapshot);
    }

    void seedFakeSync();

    return () => {
      cancelled = true;
    };
  }, [setCredentials, setMarketCpi, setMarketFxRates, setMarketMetricsCpi, setSync]);

  return null;
}
