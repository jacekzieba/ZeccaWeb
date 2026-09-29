import { beforeEach, describe, expect, it } from "vitest";
import {
  fetchActiveEncryptedRecords,
  fetchEncryptedKeyBackup,
  registerWebDevice,
  restoreEncryptedRecord,
} from "@/sync/records/supabase-sync-store";
import type { BrowserSupabaseClient } from "@/supabase/client";

type QueryResult<T> = {
  data: T;
  error: Error | null;
};

class QueryBuilder<T> {
  upserts: unknown[] = [];

  constructor(private readonly result: QueryResult<T>) {}

  select() {
    return this;
  }

  maybeSingle() {
    return Promise.resolve(this.result);
  }

  is() {
    return this;
  }

  ranges: [number, number][] = [];

  order() {
    return this;
  }

  range(from: number, to: number) {
    this.ranges.push([from, to]);
    const data = Array.isArray(this.result.data) ? this.result.data.slice(from, to + 1) : this.result.data;
    return Promise.resolve({ data, error: this.result.error });
  }

  upsert(payload: unknown) {
    this.upserts.push(payload);
    return Promise.resolve({ error: this.result.error });
  }
}

function createSupabaseMock<T>(result: QueryResult<T>) {
  const builders: QueryBuilder<T>[] = [];
  return {
    builders,
    from() {
      const builder = new QueryBuilder(result);
      builders.push(builder);
      return builder;
    },
  };
}

function asSupabaseClient<T>(result: QueryResult<T>) {
  return createSupabaseMock(result) as unknown as BrowserSupabaseClient;
}

describe("supabase sync store", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    const localStorageMock = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    };

    Object.defineProperty(globalThis, "localStorage", {
      value: localStorageMock,
      configurable: true,
    });
  });

  it("fetches an encrypted key backup without domain payload fields", async () => {
    const backup = {
      encrypted_user_data_key: "ciphertext",
      nonce: "nonce",
      salt: "salt",
      kdf: "PBKDF2-SHA256",
      kdf_iterations: 1000,
    };

    await expect(
      fetchEncryptedKeyBackup(asSupabaseClient({ data: backup, error: null })),
    ).resolves.toEqual(backup);
  });

  it("validates active encrypted records from Supabase", async () => {
    const record = {
      id: "b8805a78-b5a5-4fe7-a83f-716117184d25",
      user_id: "11111111-1111-4111-8111-111111111111",
      record_type: "transaction",
      encrypted_payload: "ciphertext",
      nonce: "nonce",
      payload_version: 1,
      schema_version: 1,
      device_id: "web",
      created_at: "2026-05-15T00:00:00.000Z",
      updated_at: "2026-05-15T00:00:00.000Z",
      deleted_at: null,
    };

    await expect(
      fetchActiveEncryptedRecords(asSupabaseClient({ data: [record], error: null })),
    ).resolves.toEqual([record]);
  });

  it("accepts Postgres timestamptz strings returned by Supabase", async () => {
    const record = {
      id: "b8805a78-b5a5-4fe7-a83f-716117184d25",
      user_id: "11111111-1111-4111-8111-111111111111",
      record_type: "transaction",
      encrypted_payload: "ciphertext",
      nonce: "nonce",
      payload_version: 1,
      schema_version: 1,
      device_id: "web",
      created_at: "2026-05-07 17:01:31.761561+00",
      updated_at: "2026-05-07 16:43:36.55+00",
      deleted_at: null,
    };

    await expect(
      fetchActiveEncryptedRecords(asSupabaseClient({ data: [record], error: null })),
    ).resolves.toEqual([record]);
  });

  it("pages past the 1000-row PostgREST cap (SYNC-004)", async () => {
    const records = Array.from({ length: 2_500 }, (_, index) => ({
      id: `b8805a78-b5a5-4fe7-a83f-${String(index).padStart(12, "0")}`,
      user_id: "11111111-1111-4111-8111-111111111111",
      record_type: "transaction",
      encrypted_payload: "ciphertext",
      nonce: "nonce",
      payload_version: 1,
      schema_version: 1,
      device_id: "web",
      created_at: "2026-05-15T00:00:00.000Z",
      updated_at: "2026-05-15T00:00:00.000Z",
      deleted_at: null,
    }));
    const mock = createSupabaseMock({ data: records, error: null });

    const fetched = await fetchActiveEncryptedRecords(mock as unknown as BrowserSupabaseClient);

    expect(fetched).toHaveLength(2_500);
    expect(mock.builders.flatMap((builder) => builder.ranges)).toEqual([[0, 999], [1_000, 1_999], [2_000, 2_999]]);
  });

  it("upserts a web device heartbeat compatible with macOS user_devices", async () => {
    const mock = createSupabaseMock({ data: null, error: null });

    const payload = await registerWebDevice(
      mock as unknown as BrowserSupabaseClient,
      "11111111-1111-4111-8111-111111111111",
    );

    expect(payload).toMatchObject({
      user_id: "11111111-1111-4111-8111-111111111111",
      device_name: "Web Browser",
      platform: "web",
    });
    expect(payload.device_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(mock.builders[0]?.upserts).toEqual([[payload]]);
  });
});

describe("restoreEncryptedRecord", () => {
  function restoreClient(rows: unknown[] | null, error: Error | null = null) {
    const chain = {
      update: () => chain,
      eq: () => chain,
      select: () => Promise.resolve({ data: rows, error }),
    };
    return { from: () => chain } as unknown as BrowserSupabaseClient;
  }

  const payload = { id: "r1", user_id: "u1", record_type: "transaction", updated_at: "2026-09-24T10:00:00Z" };

  it("przechodzi, gdy wiersz został przywrócony", async () => {
    await expect(restoreEncryptedRecord(restoreClient([{ id: "r1" }]), payload)).resolves.toBeUndefined();
  });

  it("zgłasza błąd, gdy żaden wiersz się nie zmienił (UI nie może udawać przywrócenia)", async () => {
    await expect(restoreEncryptedRecord(restoreClient([]), payload)).rejects.toThrow(/Nie udało się przywrócić/);
  });
});
