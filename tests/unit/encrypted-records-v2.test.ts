import { describe, expect, it } from "vitest";
import { importAesGcmKey } from "@/sync/encryption/aes-gcm";
import { base64ToBytes } from "@/sync/encryption/base64";
import {
  decryptEncryptedRecord,
  decryptEncryptedRecords,
  RecordDecryptionError,
} from "@/sync/records/encrypted-records";
import swiftV2 from "../fixtures/crypto/aes-gcm-swift-v2.transaction.json";

// iOS od lipca zapisuje rekordy jako „v2.<base64>” z AAD wiążącym szyfrogram
// z właścicielem, ID, typem, schematem i flagą usunięcia (EncryptionService
// .authenticatedData). Fixture wygenerował natywny EncryptionService.
describe("rekordy v2 z aplikacji iOS", () => {
  it("odszyfrowuje rekord zapisany przez iOS w formacie v2", async () => {
    const key = await importAesGcmKey(base64ToBytes(swiftV2.keyBase64));
    const decrypted = await decryptEncryptedRecord(key, swiftV2.record);
    expect(decrypted.envelope.type).toBe("transaction");
    expect(decrypted.id).toBe(swiftV2.record.id);
  });

  it("rekord tenant-scoped: AAD i id to tożsamość logiczna, a id wiersza zostaje jako storageId", async () => {
    const key = await importAesGcmKey(base64ToBytes(swiftV2.keyBase64));
    const tenantRow = {
      ...swiftV2.record,
      id: "5b3f1c0e-8d2a-5c11-9a77-0c1d2e3f4a5b", // id wiersza (hash właściciela + typu + id logicznego)
      logical_id: swiftV2.record.id,
    };
    const decrypted = await decryptEncryptedRecord(key, tenantRow);
    expect(decrypted.id).toBe(swiftV2.record.id);
    expect(decrypted.storageId).toBe(tenantRow.id);
  });

  it("rekord legacy (bez logical_id) ma storageId równe id", async () => {
    const key = await importAesGcmKey(base64ToBytes(swiftV2.keyBase64));
    const decrypted = await decryptEncryptedRecord(key, swiftV2.record);
    expect(decrypted.storageId).toBe(swiftV2.record.id);
  });

  it("odrzuca rekord v2 przeniesiony pod inne ID (AAD)", async () => {
    const key = await importAesGcmKey(base64ToBytes(swiftV2.keyBase64));
    const moved = { ...swiftV2.record, id: "00000000-0000-4000-8000-000000000001" };
    await expect(decryptEncryptedRecord(key, moved)).rejects.toThrow();
  });

  it("błąd odszyfrowania rekordu to osobny błąd z typem rekordu, nie błąd hasła", async () => {
    const key = await importAesGcmKey(base64ToBytes(swiftV2.keyBase64));
    const moved = { ...swiftV2.record, id: "00000000-0000-4000-8000-000000000001" };
    const error = await decryptEncryptedRecords(key, [moved]).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RecordDecryptionError);
    expect((error as RecordDecryptionError).message).toContain("transaction");
    expect((error as RecordDecryptionError).message).toContain("1 z 1");
    expect((error as RecordDecryptionError).message).not.toMatch(/hasło/i);
  });

  it("zbiera wszystkie nieczytelne rekordy: typy i urządzenia, a czytelne nie przeszkadzają", async () => {
    const key = await importAesGcmKey(base64ToBytes(swiftV2.keyBase64));
    const good = swiftV2.record;
    const bad = (type: string, device: string) => ({
      ...swiftV2.record,
      id: "00000000-0000-4000-8000-000000000001",
      record_type: type,
      device_id: device,
    });
    const error = await decryptEncryptedRecords(key, [
      good,
      bad("settings", "b1ad0981-aaaa"),
      bad("asset", "b1ad0981-aaaa"),
      bad("settings", "a47f0468-bbbb"),
    ]).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RecordDecryptionError);
    const failure = error as RecordDecryptionError;
    expect(failure.summary.failed).toBe(3);
    expect(failure.summary.total).toBe(4);
    expect(failure.summary.byType).toEqual({ settings: 2, asset: 1 });
    expect(failure.summary.devices.sort()).toEqual(["a47f0468", "b1ad0981"]);
    expect(failure.message).toContain("3 z 4");
  });

  it("odrzuca nieznaną wersję szyfrogramu zamiast dekodować ją jako base64", async () => {
    const key = await importAesGcmKey(base64ToBytes(swiftV2.keyBase64));
    const future = { ...swiftV2.record, encrypted_payload: swiftV2.record.encrypted_payload.replace(/^v2\./, "v3.") };
    await expect(decryptEncryptedRecord(key, future)).rejects.toThrow(/v3/);
  });
});
