import { afterEach, describe, expect, it, vi } from "vitest";
import { refreshSyncStore } from "@/sync/records/record-writer";
import { encryptJsonPayloadV2 } from "@/sync/encryption/aes-gcm";
import { recordAdditionalData } from "@/sync/records/encrypted-records";
import type { BrowserSupabaseClient } from "@/supabase/client";

// Pobieranie przyrostowe (M-14, ADR-0010 w repo natywnym): po pełnym pobraniu
// web pyta tylko o wiersze z `server_updated_at` od kursora (minus 10 min
// zakładki), z tombstone'ami, a co 30 min robi pełne pobranie kontrolne.

const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const IKE = "11111111-1111-4111-8111-111111111111";
const IKZE = "22222222-2222-4222-8222-222222222222";
const T0 = Date.parse("2026-10-19T08:00:00.000Z");

type Row = Record<string, unknown> & { server_updated_at?: string; deleted_at: string | null };
type Query = { table: string; select: string; live: boolean; since: string | null };

function fakeServer({ serverTime = true }: { serverTime?: boolean } = {}) {
  const rows: Row[] = [];
  const queries: Query[] = [];
  const client = {
    from(table: string) {
      const query: Query = { table, select: "", live: false, since: null };
      const builder = {
        select(columns: string) {
          query.select = columns;
          return builder;
        },
        limit: () => builder,
        maybeSingle: async () => ({ data: null, error: null }),
        is(column: string, value: unknown) {
          if (column === "deleted_at" && value === null) query.live = true;
          return builder;
        },
        gte(column: string, value: string) {
          if (column === "server_updated_at") query.since = value;
          return builder;
        },
        order: () => builder,
        async range(from: number, to: number) {
          queries.push(query);
          if (!serverTime && (query.select.includes("server_updated_at") || query.since)) {
            return {
              data: null,
              error: { code: "42703", message: "column encrypted_records.server_updated_at does not exist" },
            };
          }
          const matching = rows
            .filter((row) => !query.live || row.deleted_at === null)
            .filter((row) => !query.since || Date.parse(row.server_updated_at!) >= Date.parse(query.since))
            .map((row) => {
              if (serverTime) return row;
              const copy = { ...row };
              delete copy.server_updated_at;
              return copy;
            });
          return { data: matching.slice(from, to + 1), error: null };
        },
      };
      return builder;
    },
  } as unknown as BrowserSupabaseClient;

  return {
    client,
    queries: () => queries.filter((query) => query.table === "encrypted_records"),
    async put(key: CryptoKey, id: string, name: string, serverAt: number, deleted = false) {
      const { encryptedPayload, nonce } = await encryptJsonPayloadV2(
        key,
        { recordType: "account", id, name, baseCurrency: "PLN" },
        recordAdditionalData({ userId: OWNER, id, recordType: "account", schemaVersion: 1, deleted: false }),
      );
      const at = new Date(serverAt).toISOString();
      const index = rows.findIndex((row) => row.id === id);
      const row: Row = {
        id,
        logical_id: id,
        user_id: OWNER,
        record_type: "account",
        encrypted_payload: encryptedPayload,
        nonce,
        payload_version: 1,
        schema_version: 1,
        device_id: "ios",
        created_at: at,
        updated_at: at,
        deleted_at: deleted ? at : null,
        server_updated_at: at,
      };
      if (index >= 0) rows[index] = row;
      else rows.push(row);
    },
  };
}

async function newKey() {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

function names(records: Awaited<ReturnType<typeof refreshSyncStore>>["records"]) {
  return records.map((record) => (record.envelope.payload as { name: string }).name).sort();
}

afterEach(() => {
  vi.useRealTimers();
});

describe("refreshSyncStore — pobieranie przyrostowe", () => {
  it("po pełnym pobraniu pyta tylko od kursora minus 10 min, razem z tombstone'ami", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    const key = await newKey();
    const server = fakeServer();
    await server.put(key, IKE, "IKE", T0 - 60 * 60_000);

    const first = await refreshSyncStore(server.client, key);
    expect(names(first.records)).toEqual(["IKE"]);
    expect(server.queries()[0]).toMatchObject({ live: true, since: null });

    vi.setSystemTime(T0 + 60_000);
    await server.put(key, IKZE, "IKZE", T0 + 30_000);
    const second = await refreshSyncStore(server.client, key);

    expect(names(second.records)).toEqual(["IKE", "IKZE"]);
    const incremental = server.queries()[1];
    expect(incremental.live).toBe(false);
    expect(Date.parse(incremental.since!)).toBe(T0 - 60 * 60_000 - 10 * 60_000);
  });

  it("tombstone usuwa rekord, a zmieniona wersja go zastępuje", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    const key = await newKey();
    const server = fakeServer();
    await server.put(key, IKE, "IKE", T0 - 60_000);
    await server.put(key, IKZE, "IKZE", T0 - 60_000);
    await refreshSyncStore(server.client, key);

    vi.setSystemTime(T0 + 60_000);
    await server.put(key, IKE, "IKE emerytura", T0 + 10_000);
    await server.put(key, IKZE, "IKZE", T0 + 20_000, true);
    const next = await refreshSyncStore(server.client, key);

    expect(names(next.records)).toEqual(["IKE emerytura"]);
  });

  it("bez zmian na serwerze zwraca te same rekordy i migawkę (wiersze z zakładki to nie zmiana)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    const key = await newKey();
    const server = fakeServer();
    await server.put(key, IKE, "IKE", T0 - 60_000); // w zakładce — wraca przy każdym pobraniu

    const first = await refreshSyncStore(server.client, key);
    vi.setSystemTime(T0 + 60_000);
    const second = await refreshSyncStore(server.client, key);

    expect(server.queries()[1].since).not.toBeNull();
    expect(second.records).toBe(first.records);
    expect(second.snapshot).toBe(first.snapshot);
  });

  it("dwa równoległe odświeżenia (zapis z formularza i cykl w tle) stosują zmianę raz", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    const key = await newKey();
    const server = fakeServer();
    await server.put(key, IKE, "IKE", T0 - 60_000);
    await refreshSyncStore(server.client, key);

    vi.setSystemTime(T0 + 60_000);
    await server.put(key, IKZE, "IKZE", T0 + 30_000);
    const [a, b] = await Promise.all([refreshSyncStore(server.client, key), refreshSyncStore(server.client, key)]);

    expect(names(a.records)).toEqual(["IKE", "IKZE"]);
    expect(b.records).toBe(a.records);
  });

  it("po 30 minutach robi pełne pobranie kontrolne", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    const key = await newKey();
    const server = fakeServer();
    await server.put(key, IKE, "IKE", T0 - 60_000);
    await refreshSyncStore(server.client, key);

    vi.setSystemTime(T0 + 29 * 60_000);
    await refreshSyncStore(server.client, key);
    vi.setSystemTime(T0 + 30 * 60_000);
    await refreshSyncStore(server.client, key);

    expect(server.queries().map((query) => query.since === null)).toEqual([true, false, true]);
  });

  it("pełne pobranie wykrywa rekord usunięty twardo na innym urządzeniu", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    const key = await newKey();
    const server = fakeServer();
    await server.put(key, IKE, "IKE", T0 - 60_000);
    await server.put(key, IKZE, "IKZE", T0 - 60_000);
    await refreshSyncStore(server.client, key);

    // „Zacznij od nowa” albo czystka tombstone'ów: wiersza po prostu nie ma.
    const fresh = fakeServer();
    await fresh.put(key, IKE, "IKE", T0 - 60_000);
    vi.setSystemTime(T0 + 30 * 60_000);
    const next = await refreshSyncStore(fresh.client, key);

    expect(names(next.records)).toEqual(["IKE"]);
  });

  it("serwer bez kolumny server_updated_at: zawsze pełne pobranie, bez błędu", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    const key = await newKey();
    const server = fakeServer({ serverTime: false });
    await server.put(key, IKE, "IKE", T0 - 60_000);

    const first = await refreshSyncStore(server.client, key);
    vi.setSystemTime(T0 + 60_000);
    await server.put(key, IKZE, "IKZE", T0 + 30_000);
    const second = await refreshSyncStore(server.client, key);

    expect(names(first.records)).toEqual(["IKE"]);
    expect(names(second.records)).toEqual(["IKE", "IKZE"]);
    expect(server.queries().every((query) => query.since === null)).toBe(true);
  });
});
