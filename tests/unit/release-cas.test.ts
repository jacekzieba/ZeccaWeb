import { describe, it, expect } from "vitest";
import type { BrowserSupabaseClient } from "@/supabase/client";
import { upsertEncryptedRecord, restoreEncryptedRecord, softDeleteEncryptedRecord } from "@/sync/records/supabase-sync-store";

const payload = { id: "11111111-1111-4111-8111-111111111111", user_id: "22222222-2222-4222-8222-222222222222", record_type: "account", encrypted_payload: "new-ciphertext", nonce: "new-nonce", payload_version: 1, schema_version: 1, device_id: "web", updated_at: "2026-10-31T09:00:00.000Z" };
const version = "2026-10-30T12:00:00.123456+00:00";

// Stateful PostgREST boundary: another client has already advanced the version.
// A conditional update touches no rows; an unconditional one destroys its ciphertext.
function concurrentServer() {
  let ciphertext = "other-client-ciphertext";
  let insertCount = 0;
  let updateCount = 0;
  const filters = new Map<string, unknown>();
  const chain = {
    update() { updateCount += 1; return chain; },
    eq(key: string, value: unknown) { filters.set(key, value); return chain; },
    select() { return chain; },
    then(resolve: (value: unknown) => unknown) {
      const conditional = filters.get("updated_at") === version;
      if (!conditional) ciphertext = "new-ciphertext";
      return Promise.resolve({ data: conditional ? [] : [{ id: payload.id }], error: null }).then(resolve);
    },
    insert() { insertCount += 1; return Promise.resolve({ data: null, error: { code: "23505", message: "duplicate logical identity" } }); },
  };
  return { client: { from: () => chain } as unknown as BrowserSupabaseClient, state: () => ({ ciphertext, insertCount, updateCount }) };
}

describe("W07 compare-and-swap at the PostgREST boundary", () => {
  it("rejects an update based on an obsolete version without overwriting", async () => {
    const server = concurrentServer();
    await expect(upsertEncryptedRecord(server.client, payload, version)).rejects.toThrow();
    expect(server.state()).toEqual({ ciphertext: "other-client-ciphertext", insertCount: 0, updateCount: 1 });
  });
  it("never falls back from an insert collision to an unconditional update", async () => {
    const server = concurrentServer();
    await expect(upsertEncryptedRecord(server.client, payload, null)).rejects.toThrow();
    expect(server.state()).toEqual({ ciphertext: "other-client-ciphertext", insertCount: 1, updateCount: 0 });
  });
  it.each([restoreEncryptedRecord, softDeleteEncryptedRecord])("rejects a stale restore/delete", async (mutate) => {
    const server = concurrentServer();
    await expect(mutate(server.client, payload, version)).rejects.toThrow();
    expect(server.state().ciphertext).toBe("other-client-ciphertext");
  });
});
