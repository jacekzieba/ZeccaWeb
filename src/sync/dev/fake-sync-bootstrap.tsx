"use client";

import { useEffect } from "react";
import { buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";
import { buildFakeSyncRecords, fakeUserDataKeyPromise } from "@/sync/dev/fake-sync";
import { useSyncStore } from "@/sync/store/sync-store";
import { isFakeSyncEnabled } from "@/lib/env";
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
      const records = buildFakeSyncRecords();
      const snapshot = buildInvestorDataSnapshot(records);
      const userDataKey = await fakeUserDataKeyPromise;

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
