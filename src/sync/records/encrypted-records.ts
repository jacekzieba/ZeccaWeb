import { z, ZodError } from "zod";
import { decryptJsonPayload } from "@/sync/encryption/aes-gcm";
import { bytesToBase64, utf8ToBytes } from "@/sync/encryption/base64";
import {
  encryptedRecordSchema,
  parsePayloadEnvelope,
  type PayloadEnvelope,
} from "@/sync/envelopes/envelope";

export type EncryptedRecord = z.infer<typeof encryptedRecordSchema>;

export type DecryptedRecord<TPayload = unknown> = {
  /** Tożsamość logiczna rekordu (= id z payloadu). Dla wierszy legacy równa id wiersza. */
  id: string;
  /** Klucz główny wiersza; różni się od `id` tylko u rekordów tenant-scoped.
   * Brak u rekordów zbudowanych lokalnie (fake-sync, testy). */
  storageId?: string;
  deviceId: string | null;
  updatedAt: string;
  deletedAt: string | null;
  envelope: PayloadEnvelope<TPayload>;
};

/** Klient tenant-scoped zapisuje wiersz pod id będącym hashem, a tożsamość
 * logiczna siedzi w `logical_id`. AAD v2 wiąże szyfrogram z tożsamością logiczną. */
function logicalRecordId(record: EncryptedRecord): string {
  return record.logical_id ?? record.id;
}

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
    id: logicalRecordId(record),
    storageId: record.id,
    deviceId: record.device_id,
    updatedAt: record.updated_at,
    deletedAt: record.deleted_at,
    envelope: { ...envelope, payload: lowercaseUuids(envelope.payload) as typeof envelope.payload },
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Klient natywny serializuje UUID wielkimi literami, web małymi. Powiązania
 * (portfolioID, instrumentID, id) są porównywane jako teksty, więc bez
 * ujednolicenia transakcja z iOS nie trafia do portfela utworzonego na webie.
 */
export function lowercaseUuids(value: unknown): unknown {
  if (typeof value === "string") {
    return UUID_PATTERN.test(value) ? value.toLowerCase() : value;
  }
  if (Array.isArray(value)) return value.map(lowercaseUuids);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, lowercaseUuids(item)]),
    );
  }
  return value;
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
        id: logicalRecordId(record),
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

/** Klucz użytkownika jest poprawny, ale część rekordów nie daje się odszyfrować
 * (np. zapisał je inny klucz albo klient z innym sposobem adresowania). Odróżniamy
 * to od błędnego hasła, które kończy się tym samym błędem AES-GCM. */
export class RecordDecryptionError extends Error {
  constructor(
    /** Typ pierwszego nieczytelnego rekordu (zachowane dla zgodności). */
    readonly recordType: string,
    readonly summary: {
      failed: number;
      total: number;
      byType: Record<string, number>;
      devices: string[];
      /** Skąd błąd: AES-GCM (zły klucz / AAD) albo kształt koperty (schemat). Bez wartości danych. */
      causes?: string[];
    } = {
      failed: 1,
      total: 1,
      byType: { [recordType]: 1 },
      devices: [],
    },
    options?: { cause?: unknown },
  ) {
    const types = Object.entries(summary.byType)
      .map(([type, count]) => `${type}×${count}`)
      .join(", ");
    const devices = summary.devices.length > 0 ? ` Urządzenia: ${summary.devices.join(", ")}.` : "";
    const causes = summary.causes && summary.causes.length > 0 ? ` Przyczyna: ${summary.causes.join("; ")}.` : "";
    super(
      `Klucz jest poprawny, ale nie udało się odszyfrować ${summary.failed} z ${summary.total} rekordów ` +
        `(${types}).${devices}${causes} Odśwież stronę lub zaktualizuj aplikację web do najnowszej wersji.`,
      options,
    );
    this.name = "RecordDecryptionError";
  }
}

export async function decryptEncryptedRecords(
  userDataKey: CryptoKey,
  encryptedRecords: unknown[],
) {
  const settled = await Promise.allSettled(
    encryptedRecords.map((record) => decryptEncryptedRecord(userDataKey, record)),
  );

  const failures: { record: unknown; reason: unknown }[] = [];
  const decrypted: DecryptedRecord[] = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") decrypted.push(result.value);
    else failures.push({ record: encryptedRecords[index], reason: result.reason });
  });

  if (failures.length === 0) return decrypted;

  const byType: Record<string, number> = {};
  const devices = new Set<string>();
  const causes = new Set<string>();
  for (const { record, reason } of failures) {
    causes.add(describeDecryptionCause(reason));
    const entry = (record ?? {}) as { record_type?: unknown; device_id?: unknown };
    const type = typeof entry.record_type === "string" ? entry.record_type : "nieznany";
    byType[type] = (byType[type] ?? 0) + 1;
    if (typeof entry.device_id === "string") devices.add(entry.device_id.slice(0, 8));
  }
  const firstType = Object.keys(byType)[0] ?? "nieznany";
  throw new RecordDecryptionError(
    firstType,
    {
      failed: failures.length,
      total: encryptedRecords.length,
      byType,
      devices: [...devices],
      causes: [...causes].slice(0, 4),
    },
    { cause: failures[0].reason },
  );
}

/** Krótki opis przyczyny bez wartości z danych: nazwa błędu, a dla schematu ścieżki pól. */
function describeDecryptionCause(reason: unknown): string {
  if (reason instanceof ZodError) {
    const paths = reason.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join(".") || "(root)"}:${issue.code}`);
    return `schemat koperty (${paths.join(", ")})`;
  }
  if (reason instanceof DOMException) {
    return reason.name === "OperationError" ? "AES-GCM: klucz albo dane uwierzytelniane (AAD) się nie zgadzają" : reason.name;
  }
  if (reason instanceof Error) {
    return reason.message.slice(0, 120);
  }
  return "nieznana";
}
