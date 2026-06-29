"use client";

import { useEffect, useRef } from "react";
import {
  flushPendingSyncOperations,
  refreshSyncStore,
  SYNC_MUTATION_EVENT,
} from "@/sync/records/record-writer";
import { useSyncStore } from "@/sync/store/sync-store";
import type { BrowserSupabaseClient } from "@/supabase/client";
import { isFakeSyncEnabled } from "@/lib/env";

const MUTATION_SYNC_DEBOUNCE_MS = 600;
const PASSIVE_SYNC_INTERVAL_MS = 60_000;
const RETRY_SYNC_DELAY_MS = 15_000;

export function BackgroundSyncBootstrap() {
  const supabase = useSyncStore((state) => state.supabase);
  const userDataKey = useSyncStore((state) => state.userDataKey);
  const setSync = useSyncStore((state) => state.setSync);
  const timerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const rerunAfterFlightRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!supabase || !userDataKey || isFakeSyncEnabled()) {
      return;
    }

    const activeSupabase = supabase;
    const activeUserDataKey = userDataKey;
    let cancelled = false;
    let realtimeChannel: ReturnType<BrowserSupabaseClient["channel"]> | null = null;

    async function runSync() {
      if (cancelled) return;
      if (inFlightRef.current) {
        rerunAfterFlightRef.current = true;
        return;
      }

      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return;
      }

      inFlightRef.current = true;
      rerunAfterFlightRef.current = false;

      try {
        await flushPendingSyncOperations(activeSupabase);
        const { records, snapshot } = await refreshSyncStore(
          activeSupabase,
          activeUserDataKey,
        );
        if (!cancelled) {
          setSync(records, snapshot);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("Background sync failed", error);
          scheduleSync(RETRY_SYNC_DELAY_MS);
        }
      } finally {
        inFlightRef.current = false;
        if (!cancelled && rerunAfterFlightRef.current) {
          scheduleSync(MUTATION_SYNC_DEBOUNCE_MS);
        }
      }
    }

    function scheduleSync(delayMs = MUTATION_SYNC_DEBOUNCE_MS) {
      if (cancelled) return;
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void runSync();
      }, delayMs);
    }

    function scheduleVisibleSync() {
      if (document.visibilityState === "visible") {
        scheduleSync(0);
      }
    }

    const onMutation = () => scheduleSync(MUTATION_SYNC_DEBOUNCE_MS);
    const onOnline = () => scheduleSync(0);
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        scheduleSync(0);
      }
    }, PASSIVE_SYNC_INTERVAL_MS);

    window.addEventListener(SYNC_MUTATION_EVENT, onMutation);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", scheduleVisibleSync);

    void activeSupabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id;
      if (cancelled || !userId) {
        return;
      }

      realtimeChannel = activeSupabase
        .channel("background-sync:encrypted-records")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "encrypted_records",
            filter: `user_id=eq.${userId}`,
          },
          () => scheduleSync(MUTATION_SYNC_DEBOUNCE_MS),
        )
        .subscribe();
    }).catch((error) => {
      console.warn("Background sync realtime setup failed", error);
    });

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      window.removeEventListener(SYNC_MUTATION_EVENT, onMutation);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", scheduleVisibleSync);
      if (realtimeChannel) {
        void activeSupabase.removeChannel(realtimeChannel);
      }
    };
  }, [setSync, supabase, userDataKey]);

  return null;
}
