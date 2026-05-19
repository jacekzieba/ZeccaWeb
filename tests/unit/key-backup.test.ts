import { describe, expect, it } from "vitest";
import {
  decryptBytes,
  decryptJsonPayload,
  encryptBytesWithNonce,
  encryptJsonPayloadWithNonce,
  importAesGcmKey,
  toArrayBuffer,
} from "@/sync/encryption/aes-gcm";
import { base64ToBytes, bytesToBase64 } from "@/sync/encryption/base64";
import { unlockUserDataKey } from "@/sync/encryption/key-backup";
import swiftFixture from "../fixtures/crypto/aes-gcm-swift.transaction.json";

async function deriveTestKeyEncryptionKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
) {
  const passphraseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: toArrayBuffer(salt),
      iterations,
    },
    passphraseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

describe("encrypted key backups", () => {
  it("unlocks a user data key from a PBKDF2/AES-GCM backup", async () => {
    const passphrase = "correct horse battery staple";
    const salt = Uint8Array.from(Array.from({ length: 16 }, (_, index) => index));
    const backupNonce = Uint8Array.from(
      Array.from({ length: 12 }, (_, index) => index + 40),
    );
    const recordNonce = Uint8Array.from(
      Array.from({ length: 12 }, (_, index) => index + 80),
    );
    const userDataKeyBytes = Uint8Array.from(
      Array.from({ length: 32 }, (_, index) => 255 - index),
    );
    const keyEncryptionKey = await deriveTestKeyEncryptionKey(
      passphrase,
      salt,
      1000,
    );
    const encryptedBackup = await encryptBytesWithNonce(
      keyEncryptionKey,
      userDataKeyBytes,
      backupNonce,
    );

    const unlockedKey = await unlockUserDataKey(
      {
        encrypted_user_data_key: encryptedBackup.encryptedPayload,
        nonce: encryptedBackup.nonce,
        salt: bytesToBase64(salt),
        kdf: "PBKDF2-SHA256",
        kdf_iterations: 1000,
      },
      passphrase,
    );
    const controlKey = await importAesGcmKey(userDataKeyBytes);
    const payload = { ok: true, source: "key-backup-test" };
    const encryptedPayload = await encryptJsonPayloadWithNonce(
      controlKey,
      payload,
      recordNonce,
    );

    await expect(
      decryptJsonPayload<typeof payload>(
        unlockedKey,
        encryptedPayload.encryptedPayload,
        encryptedPayload.nonce,
      ),
    ).resolves.toEqual(payload);
    await expect(
      decryptBytes(
        keyEncryptionKey,
        encryptedBackup.encryptedPayload,
        encryptedBackup.nonce,
      ),
    ).resolves.toEqual(userDataKeyBytes);
    expect(base64ToBytes(encryptedBackup.nonce)).toHaveLength(12);
  });

  it("unlocks a Swift CryptoKit generated key backup", async () => {
    const backup = swiftFixture.keyBackup;
    const unlockedKey = await unlockUserDataKey(
      {
        encrypted_user_data_key: backup.encrypted_user_data_key,
        nonce: backup.nonce,
        salt: backup.salt,
        kdf: backup.kdf,
        kdf_iterations: backup.kdf_iterations,
      },
      backup.passphrase,
    );

    const payload = { ok: true, source: "swift-key-backup-test" };
    const encryptedPayload = await encryptJsonPayloadWithNonce(
      unlockedKey,
      payload,
      Uint8Array.from(Array.from({ length: 12 }, (_, index) => index + 100)),
    );

    await expect(
      decryptJsonPayload<typeof payload>(
        unlockedKey,
        encryptedPayload.encryptedPayload,
        encryptedPayload.nonce,
      ),
    ).resolves.toEqual(payload);
  });
});
