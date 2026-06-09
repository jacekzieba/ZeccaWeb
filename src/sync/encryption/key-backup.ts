import { base64ToBytes, bytesToBase64 } from "./base64";
import {
  decryptBytes,
  encryptBytesWithNonce,
  importAesGcmKey,
  toArrayBuffer,
} from "./aes-gcm";

const SUPPORTED_KDFS = new Set(["PBKDF2-SHA256", "pbkdf2-sha256", "PBKDF2"]);

/** Default PBKDF2 work factor — kept identical to the native KeyBackupService. */
export const DEFAULT_KDF_ITERATIONS = 600_000;

export type EncryptedKeyBackup = {
  encrypted_user_data_key: string;
  nonce: string;
  salt: string;
  kdf: string;
  kdf_iterations: number;
};

export async function deriveKeyEncryptionKey(
  passphrase: string,
  saltBase64: string,
  iterations: number,
  usages: KeyUsage[] = ["decrypt"],
) {
  if (iterations <= 0) {
    throw new Error("KDF iterations must be positive.");
  }

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
      salt: toArrayBuffer(base64ToBytes(saltBase64)),
      iterations,
    },
    passphraseKey,
    { name: "AES-GCM", length: 256 },
    false,
    usages,
  );
}

/** Generate a fresh 256-bit user data key (CSPRNG). Used to bootstrap a web-only account. */
export function generateUserDataKeyBytes(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

/**
 * Build an encrypted key backup from raw user-data-key bytes and a passphrase.
 * Mirrors the native `KeyBackupService.makeBackup`: 16-byte salt, PBKDF2-SHA256
 * with `DEFAULT_KDF_ITERATIONS`, AES-GCM encryption of the raw key, `pbkdf2-sha256` kdf tag.
 */
export async function createEncryptedKeyBackup(params: {
  rawUserDataKey: Uint8Array;
  passphrase: string;
  iterations?: number;
}): Promise<EncryptedKeyBackup> {
  const { rawUserDataKey, passphrase } = params;
  if (rawUserDataKey.byteLength !== 32) {
    throw new Error("userDataKey must be exactly 256 bits.");
  }
  if (!passphrase) {
    throw new Error("Passphrase is required to create a key backup.");
  }

  const iterations = params.iterations ?? DEFAULT_KDF_ITERATIONS;
  const saltBase64 = bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
  const keyEncryptionKey = await deriveKeyEncryptionKey(
    passphrase,
    saltBase64,
    iterations,
    ["encrypt"],
  );

  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const { encryptedPayload, nonce: nonceBase64 } = await encryptBytesWithNonce(
    keyEncryptionKey,
    rawUserDataKey,
    nonce,
  );

  return {
    encrypted_user_data_key: encryptedPayload,
    nonce: nonceBase64,
    salt: saltBase64,
    kdf: "pbkdf2-sha256",
    kdf_iterations: iterations,
  };
}

export async function unlockUserDataKey(
  backup: EncryptedKeyBackup,
  passphrase: string,
) {
  if (!SUPPORTED_KDFS.has(backup.kdf)) {
    throw new Error(`Unsupported key backup KDF: ${backup.kdf}`);
  }

  const keyEncryptionKey = await deriveKeyEncryptionKey(
    passphrase,
    backup.salt,
    backup.kdf_iterations,
  );

  const userDataKey = await decryptBytes(
    keyEncryptionKey,
    backup.encrypted_user_data_key,
    backup.nonce,
  );

  return importAesGcmKey(userDataKey);
}
