import type { RecordType } from "@/domain/models/investor-data";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";

/** Wraps a payload in the DecryptedRecord envelope used by unit tests. */
export function makeRecord(
  type: RecordType,
  id: string,
  payload: unknown,
  updatedAt = "2026-06-30T10:00:00.000Z",
): DecryptedRecord {
  return {
    id,
    deviceId: "test",
    updatedAt,
    deletedAt: null,
    envelope: { type, payloadVersion: 1, schemaVersion: 1, payload },
  };
}
