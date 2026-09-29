import { describe, expect, it } from "vitest";
import {
  SYNC_PROTOCOL,
  SyncProtocolTooOldError,
  assertSyncProtocolSupported,
  syncProtocolHeaders,
} from "@/sync/records/sync-protocol";
import type { BrowserSupabaseClient } from "@/supabase/client";

// ADR-0010: klient wysyła protokół w nagłówku, a przy minimum wyższym niż własne
// zatrzymuje synchronizację. Serwer bez tabeli sync_protocol = brak bramki.
const client = (result: { data: unknown; error: unknown }) =>
  ({
    from: () => ({
      select: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve(result) }) }),
    }),
  }) as unknown as BrowserSupabaseClient;

describe("protokół synchronizacji", () => {
  it("wysyła protokół 2 w nagłówku", () => {
    expect(SYNC_PROTOCOL).toBe(2);
    expect(syncProtocolHeaders).toEqual({ "x-zecca-sync-protocol": "2" });
  });

  it("przepuszcza minimum ≤ własnego protokołu i serwer bez tabeli", async () => {
    await expect(assertSyncProtocolSupported(client({ data: { min_client_protocol: 2 }, error: null }))).resolves.toBeUndefined();
    await expect(assertSyncProtocolSupported(client({ data: null, error: { code: "PGRST205" } }))).resolves.toBeUndefined();
  });

  it("zatrzymuje nieaktualną kartę", async () => {
    await expect(assertSyncProtocolSupported(client({ data: { min_client_protocol: 3 }, error: null }))).rejects.toBeInstanceOf(
      SyncProtocolTooOldError,
    );
  });
});
