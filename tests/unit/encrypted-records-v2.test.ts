import { describe, expect, it } from "vitest";
import { importAesGcmKey } from "@/sync/encryption/aes-gcm";
import { base64ToBytes } from "@/sync/encryption/base64";
import { decryptEncryptedRecord } from "@/sync/records/encrypted-records";
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

  it("odrzuca rekord v2 przeniesiony pod inne ID (AAD)", async () => {
    const key = await importAesGcmKey(base64ToBytes(swiftV2.keyBase64));
    const moved = { ...swiftV2.record, id: "00000000-0000-4000-8000-000000000001" };
    await expect(decryptEncryptedRecord(key, moved)).rejects.toThrow();
  });

  it("odrzuca nieznaną wersję szyfrogramu zamiast dekodować ją jako base64", async () => {
    const key = await importAesGcmKey(base64ToBytes(swiftV2.keyBase64));
    const future = { ...swiftV2.record, encrypted_payload: swiftV2.record.encrypted_payload.replace(/^v2\./, "v3.") };
    await expect(decryptEncryptedRecord(key, future)).rejects.toThrow(/v3/);
  });
});
