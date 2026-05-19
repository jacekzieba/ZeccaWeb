import { describe, expect, it } from "vitest";
import {
  fetchActiveEncryptedRecords,
  fetchEncryptedKeyBackup,
} from "@/sync/records/supabase-sync-store";
import type { BrowserSupabaseClient } from "@/supabase/client";

type QueryResult<T> = {
  data: T;
  error: Error | null;
};

class QueryBuilder<T> {
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

  order() {
    return Promise.resolve(this.result);
  }
}

function createSupabaseMock<T>(result: QueryResult<T>) {
  return {
    from() {
      return new QueryBuilder(result);
    },
  };
}

function asSupabaseClient<T>(result: QueryResult<T>) {
  return createSupabaseMock(result) as unknown as BrowserSupabaseClient;
}

describe("supabase sync store", () => {
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
});
