import type { BrowserSupabaseClient } from "@/supabase/client";

/** Sync protocol spoken by this client (ADR-0010 in the native repo). The server
 * refuses writes from clients below `sync_protocol.min_client_protocol`. */
export const SYNC_PROTOCOL = 2;
export const SYNC_PROTOCOL_HEADER = "x-zecca-sync-protocol";
export const syncProtocolHeaders: Record<string, string> = {
  [SYNC_PROTOCOL_HEADER]: String(SYNC_PROTOCOL),
};

export class SyncProtocolTooOldError extends Error {
  constructor(readonly minimumProtocol: number) {
    super("Ta wersja Zecca Web jest nieaktualna. Odśwież stronę, aby synchronizować dane.");
    this.name = "SyncProtocolTooOldError";
  }
}

/** Throws when the server needs a newer protocol (a tab opened before a deploy).
 * A server without `sync_protocol` predates the gate: allowed. */
export async function assertSyncProtocolSupported(supabase: BrowserSupabaseClient): Promise<void> {
  const { data, error } = await supabase
    .from("sync_protocol" as never)
    .select("min_client_protocol")
    .limit(1)
    .maybeSingle();
  if (error || !data) return;
  const minimum = Number((data as { min_client_protocol?: unknown }).min_client_protocol);
  if (Number.isFinite(minimum) && minimum > SYNC_PROTOCOL) {
    throw new SyncProtocolTooOldError(minimum);
  }
}
