import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPendingSyncOperations,
  deleteRecord,
  forcePendingSyncOperation,
  getPendingSyncOperations,
  removePendingSyncOperation,
  saveRecord,
  SyncConflictError,
} from "@/sync/records/record-writer";
import type { BrowserSupabaseClient } from "@/supabase/client";

/**
 * Faza 2.5 (web) — golden parity for the Supabase conflict strategy.
 *
 * InvestorWeb is a FULL SYNC PEER (decision: peer, not secondary client). Native
 * resolves conflicts on PULL against a local store (`InvestorRepository.applyRemoteX`,
 * see `SyncConflictResolutionTests.swift`). Web has no offline local store — reads are
 * always authoritative re-fetches — so the same last-write-wins-with-conflict-detection
 * strategy lives on the WRITE path (`record-writer.assertNoConflict`, optimistic
 * concurrency via `baseUpdatedAt`). This suite pins web's behaviour against native's
 * four branches so the two platforms cannot silently diverge.
 *
 * Native branch → web equivalent:
 *  1. local dirty AND remote newer        → CONFLICT, no overwrite (SyncConflictError, not queued)
 *  2. local newer than remote             → local wins (matching baseUpdatedAt uploads)
 *  3. remote has deletedAt                → local treated deleted (write over deleted = conflict)
 *  4. remote newer, local synced          → remote wins (authoritative re-fetch; fresh create conflicts)
 * Resolution:
 *  · use-local  → forcePendingSyncOperation (override)
 *  · use-remote → discard pending op + re-fetch
 */

const userId = "11111111-1111-4111-8111-111111111111";
const recordId = "22222222-2222-4222-8222-222222222222";

type Metadata = {
  id: string;
  record_type: string;
  updated_at: string;
  deleted_at: string | null;
} | null;

function createSupabaseStore(metadata: Metadata, errors: { upsert?: Error | null; update?: Error | null } = {}) {
  const store = {
    metadata,
    upsertError: errors.upsert ?? null,
    updateError: errors.update ?? null,
    upserts: [] as unknown[],
    updates: [] as unknown[],
  };

  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: userId } } })) },
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle: vi.fn(async () => ({ data: store.metadata, error: null })),
        upsert: vi.fn(async (payload: unknown) => {
          store.upserts.push(payload);
          return { error: store.upsertError };
        }),
        update: vi.fn((payload: unknown) => {
          store.updates.push(payload);
          const builder = { error: store.updateError, eq: vi.fn(() => builder) };
          return builder;
        }),
      };
    },
  } as unknown as BrowserSupabaseClient;

  return { client, store };
}

async function testKey() {
  return crypto.subtle.importKey("raw", new Uint8Array(32), { name: "AES-GCM" }, false, ["encrypt"]);
}

function transactionPayload() {
  return {
    id: recordId,
    recordType: "transaction",
    transactionType: "cashDeposit",
    grossAmount: 1000,
    currency: "PLN",
  };
}

describe("sync conflict resolution (web peer parity)", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    const localStorageMock = {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => void storage.set(key, value)),
      removeItem: vi.fn((key: string) => void storage.delete(key)),
      clear: vi.fn(() => storage.clear()),
    };
    Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, configurable: true });
    Object.defineProperty(window, "localStorage", { value: localStorageMock, configurable: true });
    clearPendingSyncOperations();
    localStorage.clear();
  });

  // Branch 1 — testLocalDirtyAndRemoteNewer_recordsConflictWithoutOverwrite
  it("branch 1: local edit over a remotely-moved record is a conflict, not an overwrite", async () => {
    const { client, store } = createSupabaseStore({
      id: recordId,
      record_type: "transaction",
      updated_at: "2030-01-01T00:00:00.000Z", // remote moved ahead
      deleted_at: null,
    });

    await expect(
      saveRecord(client, await testKey(), "transaction", transactionPayload(), {
        baseUpdatedAt: "2026-05-02T00:00:00.000Z", // stale base
      }),
    ).rejects.toBeInstanceOf(SyncConflictError);

    // No silent overwrite, and the change is surfaced — not buried in the queue.
    expect(store.upserts).toHaveLength(0);
    expect(getPendingSyncOperations()).toHaveLength(0);
  });

  // Branch 2 — testLocalNewerThanRemote_localWins
  it("branch 2: editing with a matching base uploads the local change (local wins)", async () => {
    const { client, store } = createSupabaseStore({
      id: recordId,
      record_type: "transaction",
      updated_at: "2026-05-02T00:00:00.000Z", // matches base → no concurrent change
      deleted_at: null,
    });

    const result = await saveRecord(client, await testKey(), "transaction", transactionPayload(), {
      baseUpdatedAt: "2026-05-02T00:00:00.000Z",
    });

    expect(result.queued).toBe(false);
    expect(store.upserts).toHaveLength(1);
    expect(getPendingSyncOperations()).toHaveLength(0);
  });

  // Branch 3 — testRemoteDeletion_marksLocalDeleted
  it("branch 3: editing a remotely-deleted record is a conflict (no resurrection)", async () => {
    const { client, store } = createSupabaseStore({
      id: recordId,
      record_type: "transaction",
      updated_at: "2030-01-01T00:00:00.000Z",
      deleted_at: "2030-01-01T00:00:00.000Z", // remote tombstone
    });

    await expect(
      saveRecord(client, await testKey(), "transaction", transactionPayload(), {
        baseUpdatedAt: "2026-05-02T00:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(SyncConflictError);

    expect(store.upserts).toHaveLength(0);
  });

  // Branch 4 — testRemoteNewerOnSyncedLocalWins (remote authoritative)
  it("branch 4: creating a record that already exists remotely is a conflict (remote wins)", async () => {
    const { client, store } = createSupabaseStore({
      id: recordId,
      record_type: "transaction",
      updated_at: "2030-01-01T00:00:00.000Z",
      deleted_at: null,
    });

    // No baseUpdatedAt → this is a "create", but remote already has the row.
    await expect(
      saveRecord(client, await testKey(), "transaction", transactionPayload(), {
        baseUpdatedAt: null,
      }),
    ).rejects.toBeInstanceOf(SyncConflictError);

    expect(store.upserts).toHaveLength(0);
  });

  // Resolution: use-local — testResolveConflictUsingLocal_keepsLocalValue
  it("resolve using local: a queued change can be force-applied to override remote", async () => {
    const { client, store } = createSupabaseStore(
      { id: recordId, record_type: "transaction", updated_at: "2026-05-02T00:00:00.000Z", deleted_at: null },
      { upsert: new Error("offline") },
    );

    const result = await saveRecord(client, await testKey(), "transaction", transactionPayload(), {
      baseUpdatedAt: "2026-05-02T00:00:00.000Z",
    });
    expect(result.queued).toBe(true);

    const op = getPendingSyncOperations()[0];
    expect(op).toBeTruthy();

    store.upsertError = null;
    const forced = await forcePendingSyncOperation(client, op!.operationId);

    expect(forced.forced).toBe(true);
    expect(getPendingSyncOperations()).toHaveLength(0);
    expect(store.upserts.length).toBeGreaterThanOrEqual(1);
  });

  // Resolution: use-remote — testResolveConflictUsingRemote_appliesRemoteValue
  it("resolve using remote: discarding the queued op leaves remote authoritative", async () => {
    const { client } = createSupabaseStore(
      { id: recordId, record_type: "transaction", updated_at: "2026-05-02T00:00:00.000Z", deleted_at: null },
      { update: new Error("offline") },
    );

    const result = await deleteRecord(client, "transaction", recordId, {
      baseUpdatedAt: "2026-05-02T00:00:00.000Z",
    });
    expect(result.queued).toBe(true);

    const op = getPendingSyncOperations()[0];
    expect(op).toBeTruthy();

    // User chooses remote → drop the local pending change; next re-fetch wins.
    removePendingSyncOperation(op!.operationId);
    expect(getPendingSyncOperations()).toHaveLength(0);
  });
});
