"use client";

import { useEffect, useId, useState } from "react";
import { createBrowserSupabaseClientOrNull } from "@/supabase/client";
import { COLORS, SHADOWS } from "@/lib/design-tokens";

type Status = "checking" | "idle" | "loading" | "error" | "no-session" | "done";

const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<Status>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
      setStatus(data.user ? "idle" : "no-session");
    });
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setStatus("error");
      setErrorMessage(`Hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków.`);
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

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    setStatus("done");
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: `0.5px solid ${COLORS.border}`,
    background: COLORS.surface,
    fontSize: 14,
    color: COLORS.text,
    outline: "none",
    boxShadow: "inset 0 1px 2px rgba(28,49,68,0.04)",
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
    borderRadius: 12,
    background: COLORS.surfaceAlt,
    border: `0.5px solid ${COLORS.border}`,
  };

  const linkBtnStyle: React.CSSProperties = {
    textAlign: "center",
    padding: "11px 16px",
    borderRadius: 10,
    border: `0.5px solid ${COLORS.border}`,
    background: COLORS.surface,
    color: COLORS.text,
    fontSize: 14,
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
          <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>
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
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={panelStyle}>
          <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>
            Hasło zmienione
          </div>
          <p style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.5 }}>
            Możesz teraz przejść do aplikacji. Hasło szyfrujące (passphrase) pozostaje bez
            zmian — dane odblokujesz tak jak dotychczas.
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
          borderRadius: 10,
          border: "none",
          background: isLoading ? COLORS.surfaceAlt : COLORS.text,
          color: isLoading ? COLORS.textMuted : COLORS.white,
          fontSize: 14,
          fontWeight: 600,
          cursor: isLoading ? "not-allowed" : "pointer",
          boxShadow: isLoading ? "none" : SHADOWS.button,
          transition: "background .15s",
          fontFamily: "inherit",
        }}
      >
        {isLoading ? "Zapisywanie…" : "Ustaw nowe hasło"}
      </button>
    </form>
  );
}
