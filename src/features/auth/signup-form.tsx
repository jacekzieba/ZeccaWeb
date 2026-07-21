"use client";

import { useId, useState } from "react";
import { createBrowserSupabaseClientOrNull } from "@/supabase/client";
import { authRedirectBase } from "@/lib/auth-redirect";
import { COLORS, SHADOWS } from "@/lib/design-tokens";

type Status = "idle" | "loading" | "error" | "confirm-sent";

const MIN_PASSWORD_LENGTH = 8;

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const emailId = useId();
  const passwordId = useId();
  const confirmId = useId();

  const isLoading = status === "loading";

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

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${authRedirectBase()}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    // Email confirmation OFF → a session is returned immediately, go straight in.
    if (data.session) {
      window.location.assign("/dashboard");
      return;
    }

    // Email confirmation ON → user must click the link in their inbox.
    setStatus("confirm-sent");
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

  if (status === "confirm-sent") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          style={{
            padding: "14px 16px",
            borderRadius: 12,
            background: COLORS.surfaceAlt,
            border: `0.5px solid ${COLORS.border}`,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>
            Sprawdź swoją skrzynkę
          </div>
          <p style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.5 }}>
            Wysłaliśmy link potwierdzający na <strong>{email.trim()}</strong>. Kliknij go,
            aby aktywować konto, a następnie zaloguj się i ustaw hasło szyfrujące (passphrase).
          </p>
        </div>
        <a
          href="/login"
          style={{
            textAlign: "center",
            padding: "11px 16px",
            borderRadius: 10,
            border: `0.5px solid ${COLORS.border}`,
            background: COLORS.surface,
            color: COLORS.text,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Przejdź do logowania
        </a>
      </div>
    );
  }

  return (
    <form style={{ display: "flex", flexDirection: "column", gap: 16 }} onSubmit={handleSubmit}>
      <div>
        <label htmlFor={emailId} style={labelStyle}>E-mail</label>
        <input
          id={emailId}
          style={inputStyle}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          placeholder="twój@email.com"
        />
      </div>
      <div>
        <label htmlFor={passwordId} style={labelStyle}>Hasło</label>
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
        <label htmlFor={confirmId} style={labelStyle}>Powtórz hasło</label>
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
          {errorMessage ?? "Nie udało się utworzyć konta. Spróbuj ponownie."}
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
        {isLoading ? "Tworzenie konta…" : "Utwórz konto"}
      </button>
    </form>
  );
}
