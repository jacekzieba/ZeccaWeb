import type { BrowserSupabaseClient } from "@/supabase/client";
import { encryptedRecordSchema } from "@/sync/envelopes/envelope";
import {
  decryptEncryptedRecords,
  type DecryptedRecord,
  type EncryptedRecord,
} from "./encrypted-records";
import { fetchAllPages } from "./paged-fetch";
import { ENCRYPTED_RECORD_COLUMNS } from "./supabase-sync-store";

/**
 * Pobieranie rekordów z kursorem po czasie serwera (ADR-0010 w repo natywnym,
 * `SyncPullPolicy.swift`). Po pełnym pobraniu pytamy tylko o wiersze
 * z `server_updated_at` od kursora — razem z tombstone'ami, bo usunięcie też
 * jest zmianą. Zakładka obejmuje transakcje zapisu, które zaczęły się przed
 * kursorem, a skończyły po nim; ponowne zastosowanie wiersza nic nie zmienia.
 *
 * Stan żyje tylko w karcie (klucz: CryptoKey użytkownika), więc przeładowanie
 * zaczyna od pełnego pobrania. Natywny robi pełne co 7 dni; tu co 30 min, bo
 * twarde usunięcie z innego urządzenia („zacznij od nowa”) i czystka
 * tombstone'ów nie zostawiają wiersza, który dałoby się pobrać przyrostowo.
 */
const CURSOR_OVERLAP_MS = 10 * 60_000;
const FULL_PULL_INTERVAL_MS = 30 * 60_000;
const SERVER_TIME_COLUMNS = `${ENCRYPTED_RECORD_COLUMNS}, server_updated_at`;

type Entry = { record: DecryptedRecord; serverUpdatedAt: number | null };

type PullState = {
  entries: Map<string, Entry>;
  /** Ta sama tablica, dopóki nic się nie zmieniło — ekrany i cache migawki
   * rozpoznają brak zmian po tożsamości. */
  records: DecryptedRecord[];
  cursor: number | null;
  lastFullPullAt: number;
  /** Serwer bez kolumny `server_updated_at` (np. lokalny Supabase bez
   * migracji 20260928): zostają same pełne pobrania. */
  serverTime: boolean;
};

const states = new WeakMap<CryptoKey, PullState>();

export async function pullDecryptedRecords(
  supabase: BrowserSupabaseClient,
  userDataKey: CryptoKey,
): Promise<DecryptedRecord[]> {
  const now = Date.now();
  let state = states.get(userDataKey);
  if (!state) {
    state = { entries: new Map(), records: [], cursor: null, lastFullPullAt: -Infinity, serverTime: true };
    states.set(userDataKey, state);
  }
  const sinceFullPull = now - state.lastFullPullAt;
  const incremental =
    state.serverTime && state.cursor != null && sinceFullPull >= 0 && sinceFullPull < FULL_PULL_INTERVAL_MS;
  return incremental
    ? pullIncremental(supabase, userDataKey, state, state.cursor! - CURSOR_OVERLAP_MS)
    : pullFull(supabase, userDataKey, state, now);
}

async function pullFull(
  supabase: BrowserSupabaseClient,
  userDataKey: CryptoKey,
  state: PullState,
  now: number,
) {
  let rows: EncryptedRecord[];
  try {
    rows = await fetchRows(supabase, null, state.serverTime);
  } catch (error) {
    if (!state.serverTime || !isMissingServerTime(error)) throw error;
    state.serverTime = false;
    rows = await fetchRows(supabase, null, false);
  }
  const records = await decryptEncryptedRecords(userDataKey, rows);
  state.entries = new Map(
    records.map((record, index) => [entryKey(record.envelope.type, record.id), {
      record,
      serverUpdatedAt: serverTime(rows[index]),
    }]),
  );
  state.records = records;
  state.cursor = newestServerTime(rows, state.cursor);
  state.lastFullPullAt = now;
  return records;
}

async function pullIncremental(
  supabase: BrowserSupabaseClient,
  userDataKey: CryptoKey,
  state: PullState,
  since: number,
) {
  const rows = await fetchRows(supabase, since, true);
  const changed = rows.filter((row) => isNewer(row, state.entries.get(rowKey(row)), Boolean(row.deleted_at)));
  const live = changed.filter((row) => !row.deleted_at);
  const decrypted = await decryptEncryptedRecords(userDataKey, live);

  let applied = false;
  // Ponowne sprawdzenie po await: równoległe odświeżenie mogło już zastosować nowszą wersję.
  for (const row of changed.filter((row) => row.deleted_at)) {
    if (isNewer(row, state.entries.get(rowKey(row)), true)) {
      state.entries.delete(rowKey(row));
      applied = true;
    }
  }
  live.forEach((row, index) => {
    const key = rowKey(row);
    if (!isNewer(row, state.entries.get(key), false)) return;
    // Usuń i wstaw: zmieniony rekord trafia na koniec, jak w pełnym pobraniu (order by updated_at).
    state.entries.delete(key);
    state.entries.set(key, { record: decrypted[index], serverUpdatedAt: serverTime(row) });
    applied = true;
  });

  if (applied) state.records = [...state.entries.values()].map((entry) => entry.record);
  state.cursor = newestServerTime(rows, state.cursor);
  return state.records;
}

/** Tombstone liczy się tylko dla znanego rekordu; żywy wiersz — gdy rekordu nie ma albo jest nowszy. */
function isNewer(row: EncryptedRecord, entry: Entry | undefined, tombstone: boolean) {
  if (!entry) return !tombstone;
  return (serverTime(row) ?? Infinity) > (entry.serverUpdatedAt ?? -Infinity);
}

async function fetchRows(
  supabase: BrowserSupabaseClient,
  since: number | null,
  withServerTime: boolean,
): Promise<EncryptedRecord[]> {
  const columns = withServerTime ? SERVER_TIME_COLUMNS : ENCRYPTED_RECORD_COLUMNS;
  const rows = await fetchAllPages((from, to) => {
    const query = supabase.from("encrypted_records").select(columns);
    return since == null
      ? query
          .is("deleted_at", null)
          .order("updated_at", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to)
      : query
          .gte("server_updated_at" as never, new Date(since).toISOString())
          .order("server_updated_at" as never, { ascending: true })
          .order("id", { ascending: true })
          .range(from, to);
  });
  return rows.map((row) => encryptedRecordSchema.parse(row));
}

function isMissingServerTime(error: unknown) {
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
  return code === "42703" || (typeof message === "string" && message.includes("server_updated_at"));
}

function serverTime(row: EncryptedRecord): number | null {
  return row.server_updated_at ? Date.parse(row.server_updated_at) : null;
}

function newestServerTime(rows: EncryptedRecord[], current: number | null) {
  return rows.reduce<number | null>((newest, row) => {
    const time = serverTime(row);
    return time != null && (newest == null || time > newest) ? time : newest;
  }, current);
}

function entryKey(recordType: string, logicalId: string) {
  return `${recordType}:${logicalId.toLowerCase()}`;
}

function rowKey(row: EncryptedRecord) {
  return entryKey(row.record_type, row.logical_id ?? row.id);
}
