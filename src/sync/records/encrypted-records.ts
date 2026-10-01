import { z } from "zod";
import { decryptJsonPayload } from "@/sync/encryption/aes-gcm";
import { bytesToBase64, utf8ToBytes } from "@/sync/encryption/base64";
import {
  encryptedRecordSchema,
  parsePayloadEnvelope,
  type PayloadEnvelope,
} from "@/sync/envelopes/envelope";

export type EncryptedRecord = z.infer<typeof encryptedRecordSchema>;

export type DecryptedRecord<TPayload = unknown> = {
  id: string;
  deviceId: string | null;
  updatedAt: string;
  deletedAt: string | null;
  envelope: PayloadEnvelope<TPayload>;
};

export async function decryptEncryptedRecord(
  userDataKey: CryptoKey,
  encryptedRecordInput: unknown,
): Promise<DecryptedRecord> {
  const record = encryptedRecordSchema.parse(encryptedRecordInput);
  const { ciphertext, additionalData } = versionedCiphertext(record);
  const decryptedPayload = await decryptJsonPayload(
    userDataKey,
    ciphertext,
    record.nonce,
    additionalData,
  );
  const envelope = parsePayloadEnvelope(decryptedPayload, {
    payloadVersion: record.payload_version,
    schemaVersion: record.schema_version,
  });

  if (envelope.type !== record.record_type) {
    throw new Error(
      `Encrypted record type mismatch: metadata=${record.record_type}, envelope=${envelope.type}`,
    );
  }

  if (envelope.payloadVersion !== record.payload_version) {
    throw new Error(
      `Payload version mismatch: metadata=${record.payload_version}, envelope=${envelope.payloadVersion}`,
    );
  }

  if (envelope.schemaVersion !== record.schema_version) {
    throw new Error(
      `Schema version mismatch: metadata=${record.schema_version}, envelope=${envelope.schemaVersion}`,
    );
  }

  return {
    id: record.id,
    deviceId: record.device_id,
    updatedAt: record.updated_at,
    deletedAt: record.deleted_at,
    envelope,
  };
}

/**
 * iOS zapisuje rekordy jako „v2.<base64>” z AAD wiążącym szyfrogram z kontem,
 * ID, typem, schematem i flagą usunięcia — kanoniczny tekst musi być bajt
 * w bajt taki jak w EncryptionService.authenticatedData (Swift). Rekordy bez
 * prefiksu to starszy format bez AAD.
 */
export function recordAdditionalData(context: {
  userId: string;
  id: string;
  recordType: string;
  schemaVersion: number;
  deleted: boolean;
}): Uint8Array {
  const canonical =
    "zecca:aes-gcm:aad:v2\n" +
    `owner=${context.userId.toLowerCase()}\n` +
    `logical=${context.id.toLowerCase()}\n` +
    `type=${bytesToBase64(utf8ToBytes(context.recordType))}\n` +
    `schema=${context.schemaVersion}\n` +
    `deleted=${context.deleted ? 1 : 0}`;
  return utf8ToBytes(canonical);
}

function versionedCiphertext(record: EncryptedRecord): { ciphertext: string; additionalData?: Uint8Array } {
  const payload = record.encrypted_payload;
  if (payload.startsWith("v2.")) {
    return {
      ciphertext: payload.slice(3),
      additionalData: recordAdditionalData({
        userId: record.user_id,
        id: record.id,
        recordType: record.record_type,
        schemaVersion: record.schema_version,
        deleted: Boolean(record.deleted_at),
      }),
    };
  }
  const version = /^v(\d+)\./.exec(payload);
  if (version) {
    throw new Error(`Nieobsługiwana wersja szyfrogramu: v${version[1]}. Zaktualizuj Zecca.`);
  }
  return { ciphertext: payload };
}

export async function decryptEncryptedRecords(
  userDataKey: CryptoKey,
  encryptedRecords: unknown[],
) {
  return Promise.all(
    encryptedRecords.map((record) =>
      decryptEncryptedRecord(userDataKey, record),
    ),
  );
}
