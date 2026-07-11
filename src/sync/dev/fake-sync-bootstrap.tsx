"use client";

import { useEffect } from "react";
import { buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";
import { buildFakeSyncRecords, createFakeUserDataKey } from "@/sync/dev/fake-sync";
import { buildCertificationRecords } from "@/sync/dev/certification-scenario";
import { useSyncStore } from "@/sync/store/sync-store";
import { isFakeSyncEnabled, publicEnv } from "@/lib/env";
import type { BrowserSupabaseClient } from "@/supabase/client";

export function FakeSyncBootstrap() {
  const setCredentials = useSyncStore((state) => state.setCredentials);
  const setSync = useSyncStore((state) => state.setSync);

  useEffect(() => {
    if (!isFakeSyncEnabled()) {
      return;
    }

    let cancelled = false;

    async function seedFakeSync() {
      const records =
        publicEnv.NEXT_PUBLIC_FAKE_SYNC_DATASET === "certification"
          ? buildCertificationRecords()
          : buildFakeSyncRecords();
      const snapshot = buildInvestorDataSnapshot(records, {
        asOf: new Date("2026-06-15T12:00:00.000Z"),
        historyGranularity: "daily",
        useLatestTransactionFxRate: true,
        useMarketQuotes: true,
      });
      const userDataKey = await createFakeUserDataKey();

      if (cancelled) {
        return;
      }

      setCredentials(userDataKey, {} as BrowserSupabaseClient);
      setSync(records, snapshot);
    }

    void seedFakeSync();

    return () => {
      cancelled = true;
    };
  }, [setCredentials, setSync]);

  return null;
}
