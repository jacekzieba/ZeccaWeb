"use client";

import { useEffect, useId, useState } from "react";
import { createBrowserSupabaseClientOrNull } from "@/supabase/client";
import { COLORS } from "@/lib/design-tokens";
import { setPendingAuthPassword } from "@/features/auth/pending-auth-password";
import { deriveAuthSecret } from "@/features/auth/auth-secret";
import { MIN_PASSWORD_LENGTH, passwordRequirementError } from "@/features/auth/password-requirements";
import {
  createEncryptedKeyBackup,
  generateUserDataKeyBytes,
} from "@/sync/encryption/key-backup";
import {
  deleteAllEncryptedRecords,
  fetchEncryptedKeyBackup,
  upsertEncryptedKeyBackup,
} from "@/sync/records/supabase-sync-store";

type Status = "checking" | "idle" | "loading" | "error" | "no-session" | "done";
type ResetStartFreshStatus = "idle" | "checking" | "needed" | "confirming" | "resetting" | "resetDone" | "notNeeded" | "unknown";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<Status>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [startFresh, setStartFresh] = useState<ResetStartFreshStatus>("idle");
  const [startFreshError, setStartFreshError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const passwordId = useId();
  const confirmId = useId();

  const isLoading = status === "loading";

  useEffect(() => {
    const supabase = createBrowserSupabaseClientOrNull();
    if (!supabase) {
      setStatus("no-session");
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setEmail(data.user?.email ?? null);
      setStatus(data.user ? "idle" : "no-session");
    });
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const requirementError = passwordRequirementError(password);
    if (requirementError) {
      setStatus("error");
      setErrorMessage(requirementError);
      return;
    }
    if (password !== confirm) {
      setStatus("error");
      setErrorMessage("Hasło i potwierdzenie różnią się.");
      return;
    }

    setStatus("loading");

    const supabase = createBrowserSupabaseClientOrNull();
    if (!supabase) {
      setStatus("error");
      setErrorMessage("Brak konfiguracji Supabase w .env.local.");
      return;
    }

    if (!email) {
      setStatus("error");
      setErrorMessage("Brak adresu e-mail konta — otwórz link resetujący ponownie.");
      return;
    }
    const { error } = await supabase.auth.updateUser({
      password: await deriveAuthSecret(email, password),
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    // The password IS the encryption passphrase now (see SyncUnlockPanel) —
    // hand it off so the *next* backup (fresh or pre-existing) unlocks
    // without asking again.
    setPendingAuthPassword(password);
    setStatus("done");

    // A backup made under the OLD password can't be unwrapped anymore — we
    // never had the old password to re-encrypt it, unlike an in-app "change
    // password" flow would. Find out whether that applies here so we can
    // tell the user plainly instead of silently locking them out.
    setStartFresh("checking");
    try {
      const existingBackup = await fetchEncryptedKeyBackup(supabase);
      setStartFresh(existingBackup ? "needed" : "notNeeded");
    } catch {
      // Couldn't tell whether a backup exists — don't claim either way.
      setStartFresh("unknown");
    }
  }

  async function handleStartFresh() {
    if (startFresh === "resetting" || !userId) return;

    const supabase = createBrowserSupabaseClientOrNull();
    if (!supabase) return;

    setStartFresh("resetting");
    setStartFreshError(null);

    try {
      // Najpierw rekordy, potem backup: rekordy zaszyfrowane starym kluczem
      // obok nowego backupu blokują każde odblokowanie na stałe. Jeśli
      // usuwanie się nie uda, stary backup zostaje i nadal pasuje do danych.
      await deleteAllEncryptedRecords(supabase, userId);
      const rawUserDataKey = generateUserDataKeyBytes();
      const backup = await createEncryptedKeyBackup({ rawUserDataKey, passphrase: password });
      await upsertEncryptedKeyBackup(supabase, userId, backup);
      setStartFresh("resetDone");
    } catch (error) {
      setStartFreshError(
        error instanceof Error ? error.message : "Nie udało się zresetować zaszyfrowanych danych.",
      );
      setStartFresh("needed");
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "var(--r-xl)",
    border: `0.5px solid ${COLORS.border}`,
    background: COLORS.surface,
    fontSize: 13,
    color: COLORS.text,
    outline: "none",
    fontFamily: "inherit",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: COLORS.subtle,
    textTransform: "uppercase",
    letterSpacing: ".08em",
    marginBottom: 6,
  };

  const panelStyle: React.CSSProperties = {
    padding: "14px 16px",
    borderRadius: "var(--r-xl)",
    background: COLORS.surfaceAlt,
    border: `0.5px solid ${COLORS.border}`,
  };

  const linkBtnStyle: React.CSSProperties = {
    textAlign: "center",
    padding: "11px 16px",
    borderRadius: "var(--r-xl)",
    border: `0.5px solid ${COLORS.border}`,
    background: COLORS.surface,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: 600,
    textDecoration: "none",
  };

  if (status === "checking") {
    return (
      <p style={{ fontSize: 13, color: COLORS.textMuted, textAlign: "center" }}>
        Sprawdzanie linku resetującego…
      </p>
    );
  }

  if (status === "no-session") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={panelStyle}>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>
            Link wygasł lub jest nieprawidłowy
          </div>
          <p style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.5 }}>
            Otwórz link z maila w tej samej przeglądarce, w której poprosiłeś o reset, albo
            poproś o nowy link.
          </p>
        </div>
        <a href="/forgot-password" style={linkBtnStyle}>
          Wyślij nowy link
        </a>
      </div>
    );
  }

  if (status === "done") {
    if (startFresh === "checking") {
      return (
        <p style={{ fontSize: 13, color: COLORS.textMuted, textAlign: "center" }}>
          Hasło zmienione. Sprawdzanie zaszyfrowanych danych…
        </p>
      );
    }

    if (startFresh === "needed" || startFresh === "confirming" || startFresh === "resetting") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={panelStyle}>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>
              Hasło zmienione — teraz odblokuj swoje dane
            </div>
            <p style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.5 }}>
              Twoje zsynchronizowane dane mogą być jeszcze chronione <em>starym hasłem</em> albo
              osobną frazą synchronizacji. Reset przez e-mail ich nie zna, ale dane nadal
              odzyskasz:
            </p>
            <ul style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.5, margin: "8px 0 0", paddingLeft: 18 }}>
              <li>
                Pamiętasz stare hasło lub frazę? Przejdź do aplikacji i, gdy poprosi o hasło do
                danych, wpisz je ten jeden raz. Dane się odblokują, a od tej pory będzie je
                chronić nowe hasło.
              </li>
              <li style={{ marginTop: 6 }}>
                Masz Zecca z tymi danymi na iPhonie, iPadzie lub Macu? Zaloguj się tam nowym
                hasłem — aplikacja sama przepnie dane na nowe hasło. Potem odblokujesz je tu
                nowym hasłem.
              </li>
            </ul>
            <p style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.5, marginTop: 8 }}>
              Dopiero gdy żadna z tych dróg nie jest możliwa, możesz zacząć od nowa — stracisz
              wtedy dostęp do poprzednio zsynchronizowanych danych.
            </p>
          </div>
          <a href="/dashboard" style={linkBtnStyle}>
            Przejdź do aplikacji i odblokuj dane
          </a>
          {startFreshError && (
            <div style={{ fontSize: 12, color: COLORS.loss }}>{startFreshError}</div>
          )}
          {startFresh === "needed" ? (
            <button
              type="button"
              onClick={() => setStartFresh("confirming")}
              style={{
                ...linkBtnStyle,
                border: "none",
                background: "transparent",
                color: COLORS.loss,
                cursor: "pointer",
              }}
            >
              Nie mam starego hasła ani urządzenia z danymi — zacznij od nowa
            </button>
          ) : (
            <div style={{ ...panelStyle, display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.5 }}>
                Wszystkie zsynchronizowane dane tego konta (portfele, instrumenty, transakcje)
                zostaną trwale usunięte z serwera. Tej operacji nie da się cofnąć. Dane zapisane
                lokalnie w aplikacji na iOS/macOS zostają na urządzeniu.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={handleStartFresh}
                  disabled={startFresh === "resetting"}
                  style={{
                    ...linkBtnStyle,
                    flex: 1,
                    border: "none",
                    background: COLORS.loss,
                    color: COLORS.white,
                    cursor: startFresh === "resetting" ? "not-allowed" : "pointer",
                  }}
                >
                  {startFresh === "resetting" ? "Usuwam…" : "Tak, usuń dane i zacznij od nowa"}
                </button>
                <button
                  type="button"
                  onClick={() => setStartFresh("needed")}
                  disabled={startFresh === "resetting"}
                  style={{ ...linkBtnStyle, flex: 1 }}
                >
                  Anuluj
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={panelStyle}>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>
            Hasło zmienione
          </div>
          <p style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.5 }}>
            {startFresh === "unknown"
              ? "Możesz teraz przejść do aplikacji. Nie udało się sprawdzić stanu zaszyfrowanych danych z tego miejsca — jeśli aplikacja poprosi o frazę (passphrase), wpisz tę, której używałeś dotychczas."
              : "Możesz teraz przejść do aplikacji — Twoje dane odblokują się tym samym hasłem."}
          </p>
        </div>
        <a href="/dashboard" style={linkBtnStyle}>
          Przejdź do aplikacji
        </a>
      </div>
    );
  }

  return (
    <form style={{ display: "flex", flexDirection: "column", gap: 16 }} onSubmit={handleSubmit}>
      <div>
        <label htmlFor={passwordId} style={labelStyle}>Nowe hasło</label>
        <input
          id={passwordId}
          style={inputStyle}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          placeholder="min. 8 znaków"
        />
        <div style={{ fontSize: 11, color: COLORS.subtle, marginTop: 5 }}>
          Min. 8 znaków, w tym mała litera, wielka litera i cyfra.
        </div>
      </div>
      <div>
        <label htmlFor={confirmId} style={labelStyle}>Powtórz nowe hasło</label>
        <input
          id={confirmId}
          style={inputStyle}
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
          placeholder="••••••••"
        />
      </div>

      {status === "error" && (
        <div style={{ fontSize: 12, color: COLORS.loss }}>
          {errorMessage ?? "Nie udało się zmienić hasła. Spróbuj ponownie."}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        style={{
          marginTop: 4,
          padding: "11px 16px",
          borderRadius: "var(--r-xl)",
          border: "none",
          background: isLoading ? COLORS.surfaceAlt : COLORS.text,
          color: isLoading ? COLORS.textMuted : COLORS.white,
          fontSize: 13,
          fontWeight: 600,
          cursor: isLoading ? "not-allowed" : "pointer",
          transition: "background .15s",
          fontFamily: "inherit",
        }}
      >
        {isLoading ? "Zapisywanie…" : "Ustaw nowe hasło"}
      </button>
    </form>
  );
}
