const STORAGE_KEY = "zecca:pending-auth-password";

/**
 * One-shot hand-off of the just-typed auth password across the full page
 * reload that follows sign-up/sign-in/reset (window.location.assign, not
 * client-side routing — a plain in-memory variable wouldn't survive that).
 * sessionStorage is cleared on read and never written anywhere else; it
 * exists only so SyncUnlockPanel can try deriving the encryption key from
 * the password the user already typed, instead of asking for it again as a
 * separate "passphrase" step. Same trust boundary the app already accepts
 * for the trusted-browser key cache (src/sync/encryption/key-cache.ts).
 */
export function setPendingAuthPassword(password: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, password);
  } catch {
    // sessionStorage unavailable (private mode, etc.) — the unlock panel
    // just falls back to asking the user directly.
  }
}

export function peekPendingAuthPassword(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearPendingAuthPassword() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up if storage isn't available.
  }
}
