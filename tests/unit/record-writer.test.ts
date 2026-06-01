import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPendingSyncOperations,
  deleteRecord,
  flushPendingSyncOperations,
  forcePendingSyncOperation,
  getPendingSyncOperations,
  saveRecord,
  SyncConflictError,
} from "@/sync/records/record-writer";
import type { BrowserSupabaseClient } from "@/supabase/client";

const userId = "11111111-1111-4111-8111-111111111111";
const recordId = "22222222-2222-4222-8222-222222222222";

type StoreOptions = {
  metadata?: {
    id: string;
    record_type: string;
    updated_at: string;
    deleted_at: string | null;
  } | null;
  upsertError?: Error | null;
  updateError?: Error | null;
};

function createSupabaseStore(options: StoreOptions = {}) {
  const store = {
    metadata: options.metadata ?? null,
    upsertError: options.upsertError ?? null,
    updateError: options.updateError ?? null,
    upserts: [] as unknown[],
    updates: [] as unknown[],
  };

  const client = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: userId } },
      })),
    },
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle: vi.fn(async () => ({
          data: store.metadata,
          error: null,
        })),
        upsert: vi.fn(async (payload: unknown) => {
          store.upserts.push(payload);
          return { error: store.upsertError };
        }),
        update: vi.fn((payload: unknown) => {
          store.updates.push(payload);
          const updateBuilder = {
            error: store.updateError,
            eq: vi.fn(() => updateBuilder),
          };
          return updateBuilder;
        }),
      };
    },
  } as unknown as BrowserSupabaseClient;

  return { client, store };
}

async function testKey() {
  return crypto.subtle.importKey(
    "raw",
    new Uint8Array(32),
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
}

describe("record writer", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    const localStorageMock = {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        storage.delete(key);
      }),
      clear: vi.fn(() => {
        storage.clear();
      }),
    };

    Object.defineProperty(globalThis, "localStorage", {
      value: localStorageMock,
      configurable: true,
    });
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      configurable: true,
    });

    clearPendingSyncOperations();
    localStorage.clear();
  });

  it("queues failed writes and flushes them later", async () => {
    const { client, store } = createSupabaseStore({
      metadata: null,
      upsertError: new Error("offline"),
    });

    const result = await saveRecord(client, await testKey(), "account", {
      id: recordId,
      recordType: "account",
      name: "IKE",
      baseCurrency: "PLN",
    });

    expect(result.queued).toBe(true);
    expect(getPendingSyncOperations()).toHaveLength(1);

    store.upsertError = null;
    const flushResult = await flushPendingSyncOperations(client);

    expect(flushResult.sent).toBe(1);
    expect(flushResult.remaining).toHaveLength(0);
    expect(getPendingSyncOperations()).toHaveLength(0);
    expect(store.upserts).toHaveLength(2);
  });

  it("throws conflicts without hiding them in the pending queue", async () => {
    const { client } = createSupabaseStore({
      metadata: {
        id: recordId,
        record_type: "account",
        updated_at: "2026-05-17T10:00:00.000Z",
        deleted_at: null,
      },
    });

    await expect(
      saveRecord(
        client,
        await testKey(),
        "account",
        {
          id: recordId,
          recordType: "account",
          name: "IKE",
          baseCurrency: "PLN",
        },
        { baseUpdatedAt: "2026-05-17T09:00:00.000Z" },
      ),
    ).rejects.toBeInstanceOf(SyncConflictError);

    expect(getPendingSyncOperations()).toHaveLength(0);
  });

  it("can force a queued write after the user chooses to override", async () => {
    const { client, store } = createSupabaseStore({
      metadata: null,
      upsertError: new Error("offline"),
    });

    await saveRecord(client, await testKey(), "asset", {
      id: recordId,
      recordType: "asset",
      kind: "stock",
      symbol: "AAPL",
      name: "Apple",
      currency: "USD",
    });

    const operationId = getPendingSyncOperations()[0]?.operationId;
    expect(operationId).toBeTruthy();

    store.upsertError = null;
    const result = await forcePendingSyncOperation(client, operationId!);

    expect(result.forced).toBe(true);
    expect(getPendingSyncOperations()).toHaveLength(0);
  });

  it("soft-deletes a record when the remote version still matches", async () => {
    const { client, store } = createSupabaseStore({
      metadata: {
        id: recordId,
        record_type: "asset",
        updated_at: "2026-05-17T10:00:00.000Z",
        deleted_at: null,
      },
    });

    const result = await deleteRecord(client, "asset", recordId, {
      baseUpdatedAt: "2026-05-17T10:00:00.000Z",
    });

    expect(result.queued).toBe(false);
    expect(store.updates).toHaveLength(1);
    expect(store.updates[0]).toMatchObject({
      deleted_at: expect.any(String),
      updated_at: expect.any(String),
    });
    expect(getPendingSyncOperations()).toHaveLength(0);
  });

  it("rejects stale soft-deletes as conflicts", async () => {
    const { client, store } = createSupabaseStore({
      metadata: {
        id: recordId,
        record_type: "asset",
        updated_at: "2026-05-17T10:30:00.000Z",
        deleted_at: null,
      },
    });

    await expect(
      deleteRecord(client, "asset", recordId, {
        baseUpdatedAt: "2026-05-17T10:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(SyncConflictError);

    expect(store.updates).toHaveLength(0);
    expect(getPendingSyncOperations()).toHaveLength(0);
  });

  it("queues failed soft-deletes and flushes them later", async () => {
    const { client, store } = createSupabaseStore({
      metadata: {
        id: recordId,
        record_type: "asset",
        updated_at: "2026-05-17T10:00:00.000Z",
        deleted_at: null,
      },
      updateError: new Error("offline"),
    });

    const result = await deleteRecord(client, "asset", recordId, {
      baseUpdatedAt: "2026-05-17T10:00:00.000Z",
    });

    expect(result.queued).toBe(true);
    expect(getPendingSyncOperations()).toHaveLength(1);

    store.updateError = null;
    const flushResult = await flushPendingSyncOperations(client);

    expect(flushResult.sent).toBe(1);
    expect(flushResult.remaining).toHaveLength(0);
    expect(getPendingSyncOperations()).toHaveLength(0);
    expect(store.updates).toHaveLength(2);
  });

  it("can force a queued soft-delete after the user chooses to override", async () => {
    const { client, store } = createSupabaseStore({
      metadata: {
        id: recordId,
        record_type: "asset",
        updated_at: "2026-05-17T10:00:00.000Z",
        deleted_at: null,
      },
      updateError: new Error("offline"),
    });

    await deleteRecord(client, "asset", recordId, {
      baseUpdatedAt: "2026-05-17T10:00:00.000Z",
    });

    const operationId = getPendingSyncOperations()[0]?.operationId;
    expect(operationId).toBeTruthy();

    store.updateError = null;
    const result = await forcePendingSyncOperation(client, operationId!);

    expect(result.forced).toBe(true);
    expect(getPendingSyncOperations()).toHaveLength(0);
    expect(store.updates).toHaveLength(2);
  });
});
