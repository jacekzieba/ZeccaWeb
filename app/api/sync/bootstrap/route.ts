import { NextResponse } from "next/server";
import { encryptedRecordSchema } from "@/sync/envelopes/envelope";
import { createServerSupabaseClient } from "@/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: userError?.message ?? "Unauthenticated" },
      { status: 401 },
    );
  }

  const [keyBackupResult, recordsResult] = await Promise.all([
    supabase
      .from("encrypted_key_backups")
      .select("encrypted_user_data_key, nonce, salt, kdf, kdf_iterations")
      .maybeSingle(),
    supabase
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
      .order("updated_at", { ascending: true }),
  ]);

  if (keyBackupResult.error) {
    return NextResponse.json(
      { error: keyBackupResult.error.message },
      { status: 500 },
    );
  }

  if (recordsResult.error) {
    return NextResponse.json(
      { error: recordsResult.error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    keyBackup: keyBackupResult.data,
    encryptedRecords: (recordsResult.data ?? []).map((record) =>
      encryptedRecordSchema.parse(record),
    ),
  });
}
