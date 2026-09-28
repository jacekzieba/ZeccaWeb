import type { BrowserSupabaseClient } from "@/supabase/client";
import { toArrayBuffer } from "@/sync/encryption/aes-gcm";

/**
 * Hasło konta jest zarazem kluczem do backupu klucza danych, więc nie może
 * trafiać do serwera. Do Supabase Auth wysyłamy tylko jednokierunkowo
 * wyprowadzony sekret:
 *
 *   "Zk1-" + base64url(PBKDF2-SHA256(NFC(hasło), "zecca-auth-v1:" + NFC(lower(trim(email))), 600 000, 32 B))
 *
 * Solą jest e-mail, bo sekret trzeba znać przed zalogowaniem. Backup klucza ma
 * własną, losową sól, więc sekret logowania nie pozwala go odpakować. Prefiks
 * gwarantuje małą i wielką literę oraz cyfrę (polityka haseł Supabase).
 *
 * Kontrakt wspólny z iOS/macOS: Sources/InvestorCore/Services/Auth/AuthSecret.swift
 * (te same wektory testowe w obu repozytoriach).
 */
const AUTH_SECRET_ITERATIONS = 600_000;
const AUTH_SECRET_PREFIX = "Zk1-";
const AUTH_SALT_PREFIX = "zecca-auth-v1:";

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase().normalize("NFC");
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function deriveAuthSecret(email: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(encoder.encode(password.normalize("NFC"))),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: toArrayBuffer(encoder.encode(AUTH_SALT_PREFIX + normalizeAuthEmail(email))),
      iterations: AUTH_SECRET_ITERATIONS,
    },
    passwordKey,
    256,
  );
  return AUTH_SECRET_PREFIX + base64Url(new Uint8Array(bits));
}

type AuthClient = Pick<BrowserSupabaseClient["auth"], "signInWithPassword" | "updateUser">;

/**
 * Logowanie hasłem konta. Najpierw wyprowadzonym sekretem; jeśli konto
 * pochodzi sprzed tej zmiany (w Auth wciąż surowe hasło), jednorazowo
 * logujemy się surowym hasłem i od razu przestawiamy je na sekret. Nieudana
 * migracja nie blokuje logowania — ponowi się przy następnym.
 */
export async function signInWithAccountPassword(
  supabase: { auth: AuthClient },
  email: string,
  password: string,
): Promise<{ error: { message: string } | null }> {
  const normalizedEmail = normalizeAuthEmail(email);
  const secret = await deriveAuthSecret(normalizedEmail, password);

  const first = await supabase.auth.signInWithPassword({ email: normalizedEmail, password: secret });
  if (!first.error) return { error: null };

  const legacy = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
  if (legacy.error) return { error: first.error };

  await supabase.auth.updateUser({ password: secret }).catch(() => undefined);
  return { error: null };
}
