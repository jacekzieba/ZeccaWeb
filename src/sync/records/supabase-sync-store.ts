import type { BrowserSupabaseClient } from "@/supabase/client";
import type { EncryptedKeyBackup } from "@/sync/encryption/key-backup";
import { encryptedRecordSchema } from "@/sync/envelopes/envelope";
import type { EncryptedRecord } from "./encrypted-records";
import {
  getWebDeviceId,
  getWebDeviceName,
  getWebDevicePlatform,
} from "@/sync/records/web-device";
import { fetchAllPages } from "./paged-fetch";

/** Kolumny `encrypted_records` potrzebne do odszyfrowania. Jedna lista dla wszystkich
 * ścieżek odczytu (klient i trasa serwerowa bootstrap) — dwie osobne listy rozjechały
 * się już raz: bez `logical_id` rekordy tenant-scoped miały zły AAD. */
export const ENCRYPTED_RECORD_COLUMNS = [
  "id",
  "logical_id",
  "user_id",
  "record_type",
  "encrypted_payload",
  "nonce",
  "payload_version",
  "schema_version",
  "device_id",
  "created_at",
  "updated_at",
  "deleted_at",
].join(", ");

export type UpsertPayload = {
  id: string;
  user_id: string;
  record_type: string;
  encrypted_payload: string;
  nonce: string;
  payload_version: number;
  schema_version: number;
  device_id: string;
  updated_at: string;
  deleted_at?: string | null;
};

export type EncryptedRecordMetadata = {
  id: string;
  record_type: string;
  updated_at: string;
  deleted_at: string | null;
};

export type UserDevicePayload = {
  user_id: string;
  device_id: string;
  device_name: string;
  platform: string;
  last_seen_at: string;
};

export async function registerWebDevice(
  supabase: BrowserSupabaseClient,
  userId: string,
): Promise<UserDevicePayload> {
  const payload: UserDevicePayload = {
    user_id: userId,
    device_id: getWebDeviceId(),
    device_name: getWebDeviceName(),
    platform: getWebDevicePlatform(),
    last_seen_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("user_devices")
    .upsert([payload] as never[], { onConflict: "user_id,device_id" });

  if (error) throw error;

  return payload;
}

export async function fetchEncryptedKeyBackup(
  supabase: BrowserSupabaseClient,
): Promise<EncryptedKeyBackup | null> {
  const { data, error } = await supabase
    .from("encrypted_key_backups")
    .select("encrypted_user_data_key, nonce, salt, kdf, kdf_iterations")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

function keyBackupRow(userId: string, backup: EncryptedKeyBackup) {
  return {
    user_id: userId,
    encrypted_user_data_key: backup.encrypted_user_data_key,
    salt: backup.salt,
    nonce: backup.nonce,
    kdf: backup.kdf,
    kdf_iterations: backup.kdf_iterations,
    updated_at: new Date().toISOString(),
  };
}

/** Zamienia backup tego samego klucza (zmiana hasła) albo celowo zastępuje
 * klucz („zacznij od nowa”). Pierwszy backup konta: `insertEncryptedKeyBackup`. */
export async function upsertEncryptedKeyBackup(
  supabase: BrowserSupabaseClient,
  userId: string,
  backup: EncryptedKeyBackup,
): Promise<void> {
  const { error } = await supabase
    .from("encrypted_key_backups")
    .upsert([keyBackupRow(userId, backup)] as never[], { onConflict: "user_id" });

  if (error) throw error;
}

/** Pierwszy backup nowo wygenerowanego klucza. Celowo insert, nie upsert: gdy
 * inne urządzenie zdążyło zapisać własny backup, nadpisanie go nowym kluczem
 * odcięłoby wszystkie rekordy zaszyfrowane tamtym. Wtedy serwer zwraca 23505. */
export async function insertEncryptedKeyBackup(
  supabase: BrowserSupabaseClient,
  userId: string,
  backup: EncryptedKeyBackup,
): Promise<void> {
  const { error } = await supabase
    .from("encrypted_key_backups")
    .insert([keyBackupRow(userId, backup)] as never[]);

  if (error) throw error;
}

export async function fetchActiveEncryptedRecords(
  supabase: BrowserSupabaseClient,
): Promise<EncryptedRecord[]> {
  const rows = await fetchAllPages((from, to) =>
    supabase
      .from("encrypted_records")
      .select(
        ENCRYPTED_RECORD_COLUMNS,
      )
      .is("deleted_at", null)
      .order("updated_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );

  return rows.map((record) => encryptedRecordSchema.parse(record));
}

export async function fetchEncryptedRecordMetadata(
  supabase: BrowserSupabaseClient,
  recordType: string,
  id: string,
): Promise<EncryptedRecordMetadata | null> {
  const { data, error } = await supabase
    .from("encrypted_records")
    .select("id, record_type, updated_at, deleted_at")
    .eq("logical_id", id)
    .eq("record_type", recordType)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as EncryptedRecordMetadata | null;
}

/** Zapis odrzucony, bo wersja rekordu na serwerze nie jest już tą, na której
 * opierała się zmiana (inny klient zdążył zapisać). Nic nie zostało nadpisane. */
export class StaleRecordVersionError extends Error {
  constructor(message = "Rekord zmienił się na innym urządzeniu. Odśwież dane i ponów zmianę.") {
    super(message);
    this.name = "StaleRecordVersionError";
  }
}

/**
 * Zapis rekordu adresowany tożsamością logiczną (user_id, record_type, logical_id).
 *
 * `upsert … onConflict: "id"` nie wystarcza: wiersz zapisany przez klienta
 * tenant-scoped ma `id` będące hashem, więc zapis pod `id` logicznym albo
 * wstawiłby duplikat, albo przekluczył wiersz. Dlatego aktualizacja po
 * logical_id (bez ruszania `id`), a wstawienie z `id = logical_id` — tak jak
 * robią klienci legacy.
 *
 * Zapis jest warunkowy (compare-and-swap): `expectedVersion` to `updated_at`
 * rekordu, na którym oparto zmianę. Aktualizacja filtruje po nim, więc gdy inny
 * klient zdążył zapisać, zmienia 0 wierszy i rzucamy `StaleRecordVersionError`
 * zamiast po cichu nadpisać. `null` oznacza „rekordu jeszcze nie ma" — wtedy
 * tylko insert, a kolizja 23505 jest konfliktem, nie powodem do aktualizacji.
 */
export async function upsertEncryptedRecord(
  supabase: BrowserSupabaseClient,
  payload: UpsertPayload,
  expectedVersion: string | null,
): Promise<void> {
  const { id, user_id, record_type, ...changes } = payload;

  if (expectedVersion === null) {
    const { error } = await supabase
      .from("encrypted_records")
      .insert([{ ...payload, logical_id: id }] as never[]);
    if (!error) return;
    if ((error as { code?: string }).code === "23505") throw new StaleRecordVersionError();
    throw error;
  }

  const definedChanges = Object.fromEntries(
    Object.entries(changes).filter(([, value]) => value !== undefined),
  );
  const { data, error } = await supabase
    .from("encrypted_records")
    .update(definedChanges as never)
    .eq("user_id", user_id)
    .eq("record_type", record_type)
    .eq("logical_id", id)
    .eq("updated_at", expectedVersion)
    .select("id");
  if (error) throw error;
  if (!Array.isArray(data) || data.length === 0) throw new StaleRecordVersionError();
}

/** Cofnięcie miękkiego usunięcia — czyści `deleted_at`.
 *
 * Usuwanie nigdy nie kasowało szyfrogramu: `softDeleteEncryptedRecord` stawia
 * wyłącznie znacznik, a rekord znika z widoku, bo budowniczy migawki go
 * odfiltrowuje. Przywrócenie to więc ta sama kwerenda z `null` — dane leżą
 * nietknięte przez cały czas.
 */
export async function restoreEncryptedRecord(
  supabase: BrowserSupabaseClient,
  payload: Pick<UpsertPayload, "id" | "user_id" | "record_type" | "updated_at">,
  expectedVersion: string | null,
): Promise<void> {
  if (expectedVersion === null) {
    throw new StaleRecordVersionError("Nie udało się przywrócić rekordu — nie ma go już na serwerze.");
  }
  const { data, error } = await supabase
    .from("encrypted_records")
    .update({
      deleted_at: null,
      updated_at: payload.updated_at,
    } as never)
    .eq("logical_id", payload.id)
    .eq("user_id", payload.user_id)
    .eq("record_type", payload.record_type)
    .eq("updated_at", expectedVersion)
    .select("id");

  if (error) throw error;
  // Zero wierszy (rekord skasowany twardo albo zmieniony przez inny klient) nie
  // jest błędem PostgREST — bez tej kontroli UI pokazałoby przywrócenie, którego nie było.
  if (!data || data.length === 0) {
    throw new StaleRecordVersionError("Nie udało się przywrócić rekordu — zmienił się lub nie ma go już na serwerze.");
  }
}

export async function softDeleteEncryptedRecord(
  supabase: BrowserSupabaseClient,
  payload: Pick<UpsertPayload, "id" | "user_id" | "record_type" | "updated_at">,
  expectedVersion: string | null,
): Promise<void> {
  // Brak rekordu na serwerze: nie ma czego usuwać, więc nic do zrobienia.
  if (expectedVersion === null) return;
  const { data, error } = await supabase
    .from("encrypted_records")
    .update({
      deleted_at: payload.updated_at,
      updated_at: payload.updated_at,
    } as never)
    .eq("logical_id", payload.id)
    .eq("user_id", payload.user_id)
    .eq("record_type", payload.record_type)
    .eq("updated_at", expectedVersion)
    .select("id");

  if (error) throw error;
  if (!Array.isArray(data) || data.length === 0) throw new StaleRecordVersionError();
}

/** Twarde usunięcie wszystkich rekordów konta — wyłącznie dla „zacznij od
 *  nowa" po utracie klucza. Miękkie usunięcie tu nie wystarcza: szyfrogram
 *  starym kluczem zostałby w wierszu, a aplikacja natywna odszyfrowuje także
 *  usunięte wiersze i przerywa sync przy pierwszym, którego nie umie odczytać. */
export async function deleteAllEncryptedRecords(
  supabase: BrowserSupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("encrypted_records")
    .delete()
    .eq("user_id", userId);

  if (error) throw error;
}
