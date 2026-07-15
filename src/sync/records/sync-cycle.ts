import {
  flushPendingSyncOperations,
  refreshSyncStore,
} from "@/sync/records/record-writer";
import type { BrowserSupabaseClient } from "@/supabase/client";

let activeSyncCycle: Promise<SyncCycleResult> | null = null;

export type SyncCycleResult = Awaited<ReturnType<typeof refreshSyncStore>> & {
  pending: Awaited<ReturnType<typeof flushPendingSyncOperations>>;
};

/**
 * Runs one complete sync cycle per browser tab. Manual and background refreshes
 * share this seam so they cannot race while draining the same pending queue.
 */
export function runSyncCycle(
  supabase: BrowserSupabaseClient,
  userDataKey: CryptoKey,
): Promise<SyncCycleResult> {
  if (activeSyncCycle) {
    return activeSyncCycle;
  }

  activeSyncCycle = (async () => {
    try {
      const pending = await flushPendingSyncOperations(supabase);
      const refreshed = await refreshSyncStore(supabase, userDataKey);
      return { ...refreshed, pending };
    } finally {
      activeSyncCycle = null;
    }
  })();

  return activeSyncCycle;
}
