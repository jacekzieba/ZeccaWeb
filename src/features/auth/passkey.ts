/**
 * Passkey (WebAuthn) jako dodatkowy sposób odblokowania blokady ekranu.
 *
 * Poświadczenie jest lokalne dla tej przeglądarki: nie ma serwera ani weryfikacji
 * podpisu, więc to nadal blokada widoku, nie granica bezpieczeństwa. Wartość
 * względem PIN-u: odblokowanie wymaga weryfikacji użytkownika przez urządzenie
 * (biometria albo PIN systemu) — sprawdzamy bit UV w danych uwierzytelniających.
 */

const PASSKEY_KEY = "investor-app-lock-passkey";
const TIMEOUT_MS = 60_000;

function toBase64Url(buffer: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer as ArrayBuffer;
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length));
}

/** UV (user verified) is bit 2 of the flags byte that follows the 32-byte rpIdHash. */
export function userVerifiedFlag(authenticatorData: ArrayBuffer): boolean {
  const data = new Uint8Array(authenticatorData);
  return data.length >= 33 && (data[32] & 0x04) !== 0;
}

export function isPasskeySupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (globalThis as { PublicKeyCredential?: unknown }).PublicKeyCredential !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.credentials)
  );
}

export function getStoredPasskeyId(): string | null {
  try {
    return localStorage.getItem(PASSKEY_KEY);
  } catch {
    return null;
  }
}

export function removePasskey() {
  try {
    localStorage.removeItem(PASSKEY_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Creates a platform credential and remembers its id. Throws if the user cancels. */
export async function registerPasskey(): Promise<void> {
  const credential = (await navigator.credentials.create({
    publicKey: {
      rp: { name: "Zecca" },
      user: { id: randomBytes(16), name: "zecca-app-lock", displayName: "Blokada Zecca" },
      challenge: randomBytes(32),
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "discouraged",
      },
      timeout: TIMEOUT_MS,
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error("passkey-not-created");
  localStorage.setItem(PASSKEY_KEY, toBase64Url(credential.rawId));
}

/** True only when the device confirmed the stored credential with user verification. */
export async function verifyPasskey(): Promise<boolean> {
  const storedId = getStoredPasskeyId();
  if (!storedId || !isPasskeySupported()) return false;
  try {
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        allowCredentials: [{ type: "public-key", id: fromBase64Url(storedId) }],
        userVerification: "required",
        timeout: TIMEOUT_MS,
      },
    })) as PublicKeyCredential | null;
    if (!assertion || toBase64Url(assertion.rawId) !== storedId) return false;
    const response = assertion.response as AuthenticatorAssertionResponse;
    return userVerifiedFlag(response.authenticatorData);
  } catch {
    return false;
  }
}
