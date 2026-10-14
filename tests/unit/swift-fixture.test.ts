import { lowercaseUuids } from "@/sync/records/encrypted-records";
import { describe, expect, it } from "vitest";
import fixture from "../fixtures/crypto/aes-gcm-swift.transaction.json";
import { base64ToBytes } from "@/sync/encryption/base64";
import { decryptJsonPayload, importAesGcmKey } from "@/sync/encryption/aes-gcm";
import { decryptEncryptedRecord } from "@/sync/records/encrypted-records";

describe("Swift CryptoKit fixture", () => {
  it("decrypts a native InvestorCore transaction payload", async () => {
    const key = await importAesGcmKey(base64ToBytes(fixture.keyBase64));

    const plaintext = await decryptJsonPayload<typeof fixture.plaintext>(
      key,
      fixture.encryptedPayloadBase64,
      fixture.nonceBase64,
    );
    const record = await decryptEncryptedRecord(key, fixture.record);

    expect(plaintext).toEqual(fixture.plaintext);
    expect(record.envelope).toEqual({
      type: "transaction",
      payloadVersion: 1,
      schemaVersion: 1,
      // UUID są normalizowane do małych liter przy odszyfrowaniu.
      payload: lowercaseUuids(fixture.plaintext),
    });
    const payload = record.envelope.payload as typeof fixture.plaintext;
    expect(payload.recordType).toBe("transaction");
    expect(payload.notes).toBe("Swift fixture");
  });
});
