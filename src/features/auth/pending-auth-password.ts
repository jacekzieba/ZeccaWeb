const STORAGE_KEY = "zecca:pending-auth-password";

/** Long enough to survive the reload into /dashboard and the key-backup fetch;
 *  short enough that a password nobody consumed doesn't sit in storage for the
 *  rest of the tab's life. */
const TTL_MS = 2 * 60 * 1000;

type Entry = { password: string; expiresAt: number };

/**
 * One-shot hand-off of the just-typed auth password across the full page
 * reload that follows sign-up/sign-in/reset (window.location.assign, not
 * client-side routing — a plain in-memory variable wouldn't survive that).
 * sessionStorage is cleared on read, on sign-out and after TTL_MS; it exists
 * only so SyncUnlockPanel can try deriving the encryption key from the
 * password the user already typed, instead of asking for it again as a
 * separate "passphrase" step. Same trust boundary the app already accepts
 * for the trusted-browser key cache (src/sync/encryption/key-cache.ts).
 */
export function setPendingAuthPassword(password: string) {
  try {
    const entry: Entry = { password, expiresAt: Date.now() + TTL_MS };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // sessionStorage unavailable (private mode, etc.) — the unlock panel
    // just falls back to asking the user directly.
  }
}

export function peekPendingAuthPassword(): string | null {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  try {
    const entry = JSON.parse(raw) as Partial<Entry>;
    if (
      typeof entry.password === "string" &&
      typeof entry.expiresAt === "number" &&
      Date.now() <= entry.expiresAt
    ) {
      return entry.password;
    }
  } catch {
    // Malformed entry — treated as absent below.
  }
  clearPendingAuthPassword();
  return null;
}

export function clearPendingAuthPassword() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up if storage isn't available.
  }
}
