import type { BrowserSupabaseClient } from "@/supabase/client";
import { fetchEncryptedKeyBackup } from "@/sync/records/supabase-sync-store";
import type { EncryptedKeyBackup } from "@/sync/encryption/key-backup";

// Backup klucza zmienia się przy resecie klucza (nowy klucz) i przy zmianie hasła
// (ten sam klucz, nowe opakowanie). Urządzenie odblokowane przed taką zmianą
// zapisałoby szyfrogramy starym kluczem obok rekordów nowego klucza. Dlatego przed
// każdym zapisem porównujemy backup z serwera z tym, przy którym odblokowano klucz.
// Zmiana hasła na innym urządzeniu też zatrzymuje zapis (bezpiecznie): odblokowanie
// nowym hasłem odświeża token.
export class KeyChangedError extends Error {
  constructor() {
    super("Klucz szyfrowania został zmieniony na innym urządzeniu. Odblokuj dane ponownie przed zapisem.");
    this.name = "KeyChangedError";
  }
}

let unlockedToken: string | null = null;

function tokenOf(backup: Pick<EncryptedKeyBackup, "encrypted_user_data_key" | "nonce" | "salt">): string {
  return [backup.encrypted_user_data_key, backup.nonce, backup.salt].join(".");
}

/** Zapamiętuje backup obowiązujący w chwili udanego odszyfrowania danych. */
export async function trackUnlockedKeyBackup(supabase: BrowserSupabaseClient): Promise<void> {
  const backup = await fetchEncryptedKeyBackup(supabase);
  unlockedToken = backup ? tokenOf(backup) : null;
}

/** Po własnym resecie klucza lub zmianie hasła na tym urządzeniu. */
export function adoptKeyBackup(backup: EncryptedKeyBackup): void {
  unlockedToken = tokenOf(backup);
}

export function forgetUnlockedKeyBackup(): void {
  unlockedToken = null;
}

export function currentKeyToken(): string | null {
  return unlockedToken;
}

/** `expected`: token z chwili szyfrowania; bez niego obowiązuje bieżące odblokowanie. */
export async function assertKeyUnchanged(
  supabase: BrowserSupabaseClient,
  expected: string | null | undefined = unlockedToken,
): Promise<void> {
  if (unlockedToken === null) return;
  const backup = await fetchEncryptedKeyBackup(supabase);
  const server = backup ? tokenOf(backup) : null;
  if (server === null || server !== unlockedToken || (expected && expected !== server)) {
    throw new KeyChangedError();
  }
}
