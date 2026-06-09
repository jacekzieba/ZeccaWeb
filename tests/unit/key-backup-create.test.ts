import { describe, expect, it } from "vitest";
import {
  createEncryptedKeyBackup,
  DEFAULT_KDF_ITERATIONS,
  generateUserDataKeyBytes,
  unlockUserDataKey,
} from "@/sync/encryption/key-backup";
import { encryptJsonPayload, decryptJsonPayload } from "@/sync/encryption/aes-gcm";
import { importAesGcmKey } from "@/sync/encryption/aes-gcm";

describe("createEncryptedKeyBackup", () => {
  it("produces a backup with native-parity KDF fields", async () => {
    const backup = await createEncryptedKeyBackup({
      rawUserDataKey: generateUserDataKeyBytes(),
      passphrase: "correct horse battery staple",
    });

    expect(backup.kdf).toBe("pbkdf2-sha256");
    expect(backup.kdf_iterations).toBe(DEFAULT_KDF_ITERATIONS);
    expect(backup.salt).toBeTruthy();
    expect(backup.nonce).toBeTruthy();
    expect(backup.encrypted_user_data_key).toBeTruthy();
  });

  it("round-trips: a created backup unlocks to the same key", async () => {
    const rawUserDataKey = generateUserDataKeyBytes();
    const passphrase = "s3cure-passphrase";

    const backup = await createEncryptedKeyBackup({ rawUserDataKey, passphrase });
    const unlockedKey = await unlockUserDataKey(backup, passphrase);

    // Encrypt with the original raw key, decrypt with the unlocked key → must match.
    const originalKey = await importAesGcmKey(rawUserDataKey);
    const { encryptedPayload, nonce } = await encryptJsonPayload(originalKey, { hello: "world" });
    const decrypted = await decryptJsonPayload<{ hello: string }>(unlockedKey, encryptedPayload, nonce);

    expect(decrypted.hello).toBe("world");
  });

  it("rejects a wrong passphrase on unlock", async () => {
    const backup = await createEncryptedKeyBackup({
      rawUserDataKey: generateUserDataKeyBytes(),
      passphrase: "right-passphrase",
    });

    await expect(unlockUserDataKey(backup, "wrong-passphrase")).rejects.toBeTruthy();
  });

  it("rejects a user data key that is not 256 bits", async () => {
    await expect(
      createEncryptedKeyBackup({ rawUserDataKey: new Uint8Array(16), passphrase: "x" }),
    ).rejects.toThrow(/256 bits/);
  });

  it("uses a fast iteration count when overridden (test ergonomics)", async () => {
    const backup = await createEncryptedKeyBackup({
      rawUserDataKey: generateUserDataKeyBytes(),
      passphrase: "p",
      iterations: 1000,
    });
    expect(backup.kdf_iterations).toBe(1000);
  });
});
