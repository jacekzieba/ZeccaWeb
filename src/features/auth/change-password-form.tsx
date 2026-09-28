"use client";

import { useEffect, useId, useState } from "react";
import { createBrowserSupabaseClientOrNull } from "@/supabase/client";
import { V2, V2_TYPE } from "@/lib/v2-design";
import { MIN_PASSWORD_LENGTH, passwordRequirementError } from "@/features/auth/password-requirements";
import { deriveAuthSecret, signInWithAccountPassword } from "@/features/auth/auth-secret";
import { rewrapKeyBackup, type EncryptedKeyBackup } from "@/sync/encryption/key-backup";
import { fetchEncryptedKeyBackup, upsertEncryptedKeyBackup } from "@/sync/records/supabase-sync-store";

type Account = { id: string; email: string } | "no-password" | "loading" | "unavailable";
type Status = "idle" | "saving" | "error" | "done" | "done-legacy";

/**
 * Zmiana hasła z poziomu aplikacji. Hasło konta jest zarazem kluczem do
 * backupu klucza danych, więc — w odróżnieniu od resetu e-mailem — tu znamy
 * obecne hasło i możemy backup przepakować bez utraty danych.
 *
 * Kolejność: nowy backup → zmiana hasła w Auth. Gdy Auth odrzuci zmianę,
 * wracamy do starego backupu, więc hasło i backup nigdy się nie rozjeżdżają.
 */
export function ChangePasswordForm() {
  const [account, setAccount] = useState<Account>("loading");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const currentId = useId();
  const nextId = useId();
  const confirmId = useId();

  useEffect(() => {
    const supabase = createBrowserSupabaseClientOrNull();
    if (!supabase) {
      setAccount("unavailable");
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user?.email) {
        setAccount("unavailable");
        return;
      }
      const providers = (user.app_metadata?.providers as string[] | undefined) ?? [];
      setAccount(providers.includes("email") ? { id: user.id, email: user.email } : "no-password");
    });
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (typeof account !== "object" || status === "saving") return;

    const requirementError = passwordRequirementError(next);
    if (requirementError) return fail(requirementError);
    if (next !== confirm) return fail("Nowe hasło i potwierdzenie różnią się.");
    if (next === current) return fail("Nowe hasło musi się różnić od obecnego.");

    const supabase = createBrowserSupabaseClientOrNull();
    if (!supabase) return fail("Brak konfiguracji Supabase.");

    setStatus("saving");
    setError(null);

    const { error: signInError } = await signInWithAccountPassword(supabase, account.email, current);
    if (signInError) return fail("Obecne hasło jest nieprawidłowe.");

    let previousBackup: EncryptedKeyBackup | null;
    let rewrapped: EncryptedKeyBackup | null = null;
    try {
      previousBackup = await fetchEncryptedKeyBackup(supabase);
    } catch {
      return fail("Nie udało się pobrać backupu klucza. Spróbuj ponownie.");
    }
    if (previousBackup) {
      try {
        rewrapped = await rewrapKeyBackup(previousBackup, current, next);
      } catch {
        // Backup chroni osobna, starsza fraza synchronizacji — zostaje bez zmian.
        rewrapped = null;
      }
    }

    try {
      if (rewrapped) await upsertEncryptedKeyBackup(supabase, account.id, rewrapped);
    } catch {
      return fail("Nie udało się zapisać klucza pod nowym hasłem. Hasło się nie zmieniło.");
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: await deriveAuthSecret(account.email, next),
    });
    if (updateError) {
      if (rewrapped && previousBackup) {
        await upsertEncryptedKeyBackup(supabase, account.id, previousBackup).catch(() => undefined);
      }
      return fail(updateError.message);
    }

    setCurrent("");
    setNext("");
    setConfirm("");
    setStatus(previousBackup && !rewrapped ? "done-legacy" : "done");
  }

  function fail(message: string) {
    setStatus("error");
    setError(message);
  }

  const text: React.CSSProperties = { fontFamily: V2_TYPE.ui, fontSize: 12, color: V2.muted, lineHeight: 1.5 };

  if (account === "loading") return null;
  if (account === "unavailable") {
    return <p style={text}>Zmiana hasła jest dostępna po zalogowaniu.</p>;
  }
  if (account === "no-password") {
    return (
      <p style={text}>
        Do tego konta logujesz się przez Google lub Apple — nie ma ono osobnego hasła w Zecca.
      </p>
    );
  }

  const input: React.CSSProperties = {
    width: "100%",
    padding: "9px 11px",
    borderRadius: "var(--r-xl)",
    border: `0.5px solid ${V2.line}`,
    background: V2.card,
    color: V2.ink,
    fontFamily: "inherit",
    fontSize: 13,
  };
  const label: React.CSSProperties = {
    display: "block",
    fontFamily: V2_TYPE.ui,
    fontSize: 12,
    fontWeight: 600,
    color: V2.ink,
    marginBottom: 5,
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 420 }}>
      <p style={text}>
        Hasło odblokowuje też Twoje zaszyfrowane dane. Zmiana tutaj przepakowuje klucz pod nowe hasło,
        więc nic nie tracisz.
      </p>
      <div>
        <label htmlFor={currentId} style={label}>Obecne hasło</label>
        <input id={currentId} type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} style={input} />
      </div>
      <div>
        <label htmlFor={nextId} style={label}>Nowe hasło</label>
        <input id={nextId} type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} value={next} onChange={(e) => setNext(e.target.value)} style={input} />
        <div style={{ ...text, fontSize: 11, marginTop: 4 }}>Min. 8 znaków, w tym mała litera, wielka litera i cyfra.</div>
      </div>
      <div>
        <label htmlFor={confirmId} style={label}>Powtórz nowe hasło</label>
        <input id={confirmId} type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} style={input} />
      </div>
      {status === "error" && error && (
        <div role="alert" style={{ ...text, color: V2.loss }}>{error}</div>
      )}
      {status === "done" && (
        <div role="status" style={{ ...text, color: V2.ink }}>Hasło zmienione. Dane odblokujesz nowym hasłem.</div>
      )}
      {status === "done-legacy" && (
        <div role="status" style={{ ...text, color: V2.ink }}>
          Hasło zmienione. Twoje dane chroni osobna fraza synchronizacji — fraza synchronizacji się nie zmienia.
        </div>
      )}
      <button
        type="submit"
        disabled={status === "saving"}
        style={{
          alignSelf: "flex-start",
          padding: "9px 15px",
          borderRadius: "var(--r-xl)",
          border: "none",
          background: V2.ink,
          color: V2.page,
          fontFamily: V2_TYPE.ui,
          fontSize: 12,
          fontWeight: 600,
          cursor: status === "saving" ? "not-allowed" : "pointer",
          opacity: status === "saving" ? 0.6 : 1,
        }}
      >
        {status === "saving" ? "Zmieniam…" : "Zmień hasło"}
      </button>
    </form>
  );
}
