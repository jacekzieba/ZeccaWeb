import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPendingSyncOperations,
  deleteRecord,
  flushPendingSyncOperations,
  forcePendingSyncOperation,
  getPendingSyncOperations,
  removePendingSyncOperation,
  restoreRecord,
  saveRecord,
  SyncConflictError,
} from "@/sync/records/record-writer";
import type { BrowserSupabaseClient } from "@/supabase/client";
import { decryptEncryptedRecord } from "@/sync/records/encrypted-records";

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
        // Zapis rekordu: najpierw update po (user_id, record_type, logical_id), a gdy nic
        // nie zmienił — insert z logical_id.
        insert: vi.fn(async (payload: unknown) => {
          store.upserts.push(payload);
          return { error: store.upsertError };
        }),
        update: vi.fn((payload: unknown) => {
          store.updates.push(payload);
          const filters: Record<string, unknown> = {};
          const isRecordWrite =
            typeof payload === "object" && payload !== null && "encrypted_payload" in payload;
          const updateBuilder = {
            error: store.updateError,
            eq: vi.fn((column: string, value: unknown) => {
              filters[column] = value;
              return updateBuilder;
            }),
            // restoreEncryptedRecord / zapis sprawdzają, czy wiersz faktycznie się zmienił.
            select: vi.fn(async () => {
              if (store.updateError) return { data: null, error: store.updateError };
              if (isRecordWrite) {
                if (!store.metadata) return { data: [], error: null };
                if (store.upsertError) return { data: null, error: store.upsertError };
                store.upserts.push([
                  {
                    ...(payload as object),
                    id: filters.logical_id,
                    user_id: filters.user_id,
                    record_type: filters.record_type,
                  },
                ]);
              }
              return { data: [{ id: options.metadata?.id }], error: null };
            }),
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

  it("zapisuje portfel przeniesiony pod nowe ID pod faktyczne ID rekordu", async () => {
    // Portfel startowy po migracji: rekord pod nowym ID, w treści stare ID.
    const payloadId = "00000000-0000-0000-0000-000000000001";
    const liveRecordId = "e6506530-749a-4695-823f-93b9bca19a8a";
    const updatedAt = "2026-10-02T06:47:22.294Z";
    const { client, store } = createSupabaseStore({
      metadata: { id: liveRecordId, record_type: "account", updated_at: updatedAt, deleted_at: null },
    });
    const key = await crypto.subtle.importKey("raw", new Uint8Array(32), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);

    await saveRecord(client, key, "account", { id: payloadId, recordType: "account", name: "Nowa nazwa", baseCurrency: "PLN" }, {
      baseUpdatedAt: updatedAt,
      recordId: liveRecordId,
    });

    const written = store.upserts[0] as Array<Record<string, unknown>>;
    const row = (Array.isArray(written) ? written[0] : written) as Record<string, unknown>;
    expect(row.id).toBe(liveRecordId);
    const decrypted = await decryptEncryptedRecord(key, { ...row, created_at: updatedAt });
    expect((decrypted.envelope.payload as { name: string }).name).toBe("Nowa nazwa");
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

  // Flush trwa przez kilka zapytań sieciowych. Zapis, który w tym czasie
  // nie dojdzie do serwera, trafia do kolejki — flush nie może go potem
  // nadpisać swoją migawką kolejki sprzed sieci.
  function gateFlushOnFirstQuery(client: BrowserSupabaseClient) {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const original = client.from.bind(client);
    const gated = client as unknown as { from: (...args: unknown[]) => unknown };
    gated.from = (...args: unknown[]) => {
      const builder = (original as (...a: unknown[]) => { maybeSingle: () => Promise<unknown> })(...args);
      const maybeSingle = builder.maybeSingle;
      builder.maybeSingle = async () => {
        await gate;
        return maybeSingle();
      };
      return builder;
    };
    return {
      startFlush() {
        const flushing = flushPendingSyncOperations(client);
        gated.from = original as (...args: unknown[]) => unknown;
        return flushing;
      },
      release: () => release(),
    };
  }

  it("nie gubi zmiany zakolejkowanej w trakcie flusha", async () => {
    const otherId = "33333333-3333-4333-8333-333333333333";
    const { client } = createSupabaseStore({ metadata: null, upsertError: new Error("offline") });
    const key = await testKey();
    await saveRecord(client, key, "account", { id: recordId, recordType: "account", name: "IKE", baseCurrency: "PLN" });

    const flush = gateFlushOnFirstQuery(client);
    const flushing = flush.startFlush();
    await saveRecord(client, key, "account", { id: otherId, recordType: "account", name: "IKZE", baseCurrency: "PLN" });
    flush.release();
    await flushing;

    expect(getPendingSyncOperations().map((operation) => operation.id).sort()).toEqual([recordId, otherId]);
  });

  it("nie wskrzesza zmiany odrzuconej przez użytkownika w trakcie flusha", async () => {
    const { client } = createSupabaseStore({ metadata: null, upsertError: new Error("offline") });
    await saveRecord(client, await testKey(), "account", { id: recordId, recordType: "account", name: "IKE", baseCurrency: "PLN" });
    const [queued] = getPendingSyncOperations();

    const flush = gateFlushOnFirstQuery(client);
    const flushing = flush.startFlush();
    removePendingSyncOperation(queued.operationId);
    flush.release();
    await flushing;

    expect(getPendingSyncOperations()).toHaveLength(0);
  });

  it("udany późniejszy zapis tego samego rekordu zastępuje zakolejkowany", async () => {
    const { client, store } = createSupabaseStore({ metadata: null, upsertError: new Error("offline") });
    const key = await testKey();
    await saveRecord(client, key, "account", { id: recordId, recordType: "account", name: "Stara", baseCurrency: "PLN" });
    expect(getPendingSyncOperations()).toHaveLength(1);

    store.upsertError = null;
    await expect(
      saveRecord(client, key, "account", { id: recordId, recordType: "account", name: "Nowa", baseCurrency: "PLN" }),
    ).resolves.toMatchObject({ queued: false });

    // Stara wersja nie może czekać w kolejce na flush albo „Wymuś” — nadpisałaby nowszą.
    expect(getPendingSyncOperations()).toHaveLength(0);
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

  it("writes and soft-deletes income records through the generic encrypted writer", async () => {
    const { client, store } = createSupabaseStore({
      metadata: null,
    });

    const saveResult = await saveRecord(client, await testKey(), "income", {
      id: recordId,
      recordType: "income",
      entryKind: "earning",
      year: 2026,
      month: 5,
      employmentType: "employment",
      enteredAmount: 12_000,
      currency: "PLN",
      fxRateToPLN: 1,
      plnAmount: 12_000,
      source: "Salary",
      burdenCategory: null,
      amountPLN: null,
      note: null,
    });

    expect(saveResult.queued).toBe(false);
    expect(store.upserts).toHaveLength(1);
    expect(store.upserts[0]).toMatchObject([
      {
        id: recordId,
        record_type: "income",
        deleted_at: null,
      },
    ]);

    store.metadata = {
      id: recordId,
      record_type: "income",
      updated_at: "2026-05-17T10:00:00.000Z",
      deleted_at: null,
    };

    const deleteResult = await deleteRecord(client, "income", recordId, {
      baseUpdatedAt: "2026-05-17T10:00:00.000Z",
    });

    expect(deleteResult.queued).toBe(false);
    // [0] = próba aktualizacji przy zapisie (0 wierszy → insert), [1] = soft delete.
    expect(store.updates).toHaveLength(2);
    expect(store.updates[1]).toMatchObject({
      deleted_at: expect.any(String),
      updated_at: expect.any(String),
    });
  });

  it("soft-deletes when the local and remote timestamps differ only in format", async () => {
    // Regression: the local `baseUpdatedAt` reaches the writer via JSON (ISO
    // form, e.g. from /api/sync/bootstrap) while the freshly-fetched remote
    // `updated_at` is PostgREST's Postgres text form. Both describe the same
    // instant, but a raw string comparison treated them as a conflict and
    // silently blocked every web delete/edit of an existing record.
    const { client, store } = createSupabaseStore({
      metadata: {
        id: recordId,
        record_type: "transaction",
        updated_at: "2026-06-07 14:54:08.1+00",
        deleted_at: null,
      },
    });

    const result = await deleteRecord(client, "transaction", recordId, {
      baseUpdatedAt: "2026-06-07T14:54:08.100Z",
    });

    expect(result.queued).toBe(false);
    expect(store.updates).toHaveLength(1);
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

  it("undoing a queued delete restores without a false conflict", async () => {
    // Regression: a queued delete never reached the server, so the remote
    // row still has its ORIGINAL updated_at. Returning the fresh, locally
    // generated timestamp as the undo basis made restoreRecord compare it
    // against that unchanged remote value and reject the undo as "changed
    // on another device" — even though nothing had changed.
    const original = "2026-05-17T10:00:00.000Z";
    const { client, store } = createSupabaseStore({
      metadata: {
        id: recordId,
        record_type: "asset",
        updated_at: original,
        deleted_at: null,
      },
      updateError: new Error("offline"),
    });

    const result = await deleteRecord(client, "asset", recordId, {
      baseUpdatedAt: original,
    });

    expect(result.queued).toBe(true);
    expect(result.updatedAt).toBe(original);
    expect(result.operationId).toBeTruthy();
    expect(getPendingSyncOperations()).toHaveLength(1);

    store.updateError = null;
    removePendingSyncOperation(result.operationId!);
    expect(getPendingSyncOperations()).toHaveLength(0);

    await expect(
      restoreRecord(client, "asset", recordId, { baseUpdatedAt: result.updatedAt! }),
    ).resolves.toMatchObject({ queued: false });

    // The stale queued delete must not survive to be flushed later — it
    // would re-delete a record the user just restored.
    expect(getPendingSyncOperations()).toHaveLength(0);
  });
});
