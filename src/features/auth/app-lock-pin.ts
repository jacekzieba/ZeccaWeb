// Trwały weryfikator PIN-u blokady widoku. Leży w localStorage, więc blokada
// obowiązuje też w nowej karcie i po restarcie przeglądarki. To nadal lekka
// blokada widoku: kto ma dostęp do profilu przeglądarki, może zdjąć ją z poziomu
// DevTools. Weryfikator tylko nie ujawnia PIN-u i nie da się go zgadnąć tanim skrótem.
const VERIFIER_KEY = "investor-app-lock-verifier";
const ITERATIONS = 210_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;

type StoredVerifier = { salt: string; iterations: number; hash: string };

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, HASH_BITS);
  return new Uint8Array(bits);
}

function readVerifier(): StoredVerifier | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(VERIFIER_KEY) ?? "null");
    if (parsed && typeof parsed.salt === "string" && typeof parsed.hash === "string" && Number.isInteger(parsed.iterations)) {
      return parsed;
    }
  } catch { /* uszkodzony wpis traktujemy jak brak */ }
  return null;
}

export function hasPinVerifier(): boolean {
  return readVerifier() !== null;
}

export async function createPinVerifier(pin: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(pin, salt, ITERATIONS);
  const stored: StoredVerifier = { salt: toBase64(salt), iterations: ITERATIONS, hash: toBase64(hash) };
  localStorage.setItem(VERIFIER_KEY, JSON.stringify(stored));
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = readVerifier();
  if (!stored) return false;
  const actual = await derive(pin, fromBase64(stored.salt), stored.iterations);
  const expected = fromBase64(stored.hash);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

export function removePinVerifier(): void {
  try { localStorage.removeItem(VERIFIER_KEY); } catch { /* */ }
}
