import type { BrowserSupabaseClient } from "@/supabase/client";
import type { EncryptedKeyBackup } from "@/sync/encryption/key-backup";
import { encryptedRecordSchema } from "@/sync/envelopes/envelope";
import type { EncryptedRecord } from "./encrypted-records";

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

export async function refreshEncryptedKeyBackup(
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

export async function fetchActiveEncryptedRecords(
  supabase: BrowserSupabaseClient,
): Promise<EncryptedRecord[]> {
  const { data, error } = await supabase
    .from("encrypted_records")
    .select(
      [
        "id",
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
      ].join(", "),
    )
    .is("deleted_at", null)
    .order("updated_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((record) => encryptedRecordSchema.parse(record));
}

export async function fetchEncryptedRecordMetadata(
  supabase: BrowserSupabaseClient,
  recordType: string,
  id: string,
): Promise<EncryptedRecordMetadata | null> {
  const { data, error } = await supabase
    .from("encrypted_records")
    .select("id, record_type, updated_at, deleted_at")
    .eq("id", id)
    .eq("record_type", recordType)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as EncryptedRecordMetadata | null;
}

export async function upsertEncryptedRecord(
  supabase: BrowserSupabaseClient,
  payload: UpsertPayload,
): Promise<void> {
  const { error } = await supabase
    .from("encrypted_records")
    .upsert([payload] as never[], { onConflict: "id" });

  if (error) throw error;
}

export async function softDeleteEncryptedRecord(
  supabase: BrowserSupabaseClient,
  payload: Pick<UpsertPayload, "id" | "user_id" | "record_type" | "updated_at">,
): Promise<void> {
  const { error } = await supabase
    .from("encrypted_records")
    .update({
      deleted_at: payload.updated_at,
      updated_at: payload.updated_at,
    } as never)
    .eq("id", payload.id)
    .eq("user_id", payload.user_id)
    .eq("record_type", payload.record_type);

  if (error) throw error;
}
