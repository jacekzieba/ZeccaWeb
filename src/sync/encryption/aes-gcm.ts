import {
  base64ToBytes,
  bytesToBase64,
  bytesToUtf8,
  utf8ToBytes,
} from "./base64";

const AES_GCM_NONCE_BYTES = 12;

export type EncryptedPayload = {
  encryptedPayload: string;
  nonce: string;
};

export function toArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export async function importAesGcmKey(rawKey: Uint8Array) {
  if (rawKey.byteLength !== 32) {
    throw new Error("AES-GCM userDataKey must be exactly 256 bits.");
  }

  return crypto.subtle.importKey("raw", toArrayBuffer(rawKey), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptJsonPayload(
  key: CryptoKey,
  payload: unknown,
): Promise<EncryptedPayload> {
  const nonce = crypto.getRandomValues(new Uint8Array(AES_GCM_NONCE_BYTES));

  return encryptJsonPayloadWithNonce(key, payload, nonce);
}

/** Format v2 jak w iOS: „v2.<base64>” z AAD wiążącym szyfrogram z rekordem. */
export async function encryptJsonPayloadV2(
  key: CryptoKey,
  payload: unknown,
  additionalData: Uint8Array,
): Promise<EncryptedPayload> {
  const nonce = crypto.getRandomValues(new Uint8Array(AES_GCM_NONCE_BYTES));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(nonce), additionalData: toArrayBuffer(additionalData) },
    key,
    toArrayBuffer(utf8ToBytes(JSON.stringify(payload))),
  );
  return {
    encryptedPayload: "v2." + bytesToBase64(new Uint8Array(encrypted)),
    nonce: bytesToBase64(nonce),
  };
}

export async function encryptJsonPayloadWithNonce(
  key: CryptoKey,
  payload: unknown,
  nonce: Uint8Array,
): Promise<EncryptedPayload> {
  return encryptBytesWithNonce(key, utf8ToBytes(JSON.stringify(payload)), nonce);
}

export async function encryptBytesWithNonce(
  key: CryptoKey,
  plaintext: Uint8Array,
  nonce: Uint8Array,
): Promise<EncryptedPayload> {
  if (nonce.byteLength !== AES_GCM_NONCE_BYTES) {
    throw new Error("AES-GCM nonce must be exactly 96 bits.");
  }

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(nonce) },
    key,
    toArrayBuffer(plaintext),
  );

  return {
    encryptedPayload: bytesToBase64(new Uint8Array(encrypted)),
    nonce: bytesToBase64(nonce),
  };
}

export async function decryptBytes(
  key: CryptoKey,
  encryptedPayload: string,
  nonce: string,
  additionalData?: Uint8Array,
): Promise<Uint8Array> {
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(base64ToBytes(nonce)),
      ...(additionalData ? { additionalData: toArrayBuffer(additionalData) } : {}),
    },
    key,
    toArrayBuffer(base64ToBytes(encryptedPayload)),
  );

  return new Uint8Array(decrypted);
}

export async function decryptJsonPayload<T>(
  key: CryptoKey,
  encryptedPayload: string,
  nonce: string,
  additionalData?: Uint8Array,
): Promise<T> {
  const decrypted = await decryptBytes(key, encryptedPayload, nonce, additionalData);

  return JSON.parse(bytesToUtf8(decrypted)) as T;
}
