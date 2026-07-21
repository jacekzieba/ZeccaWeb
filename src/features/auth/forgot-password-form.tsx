"use client";

import { useId, useState } from "react";
import { createBrowserSupabaseClientOrNull } from "@/supabase/client";
import { authRedirectBase } from "@/lib/auth-redirect";
import { COLORS, SHADOWS } from "@/lib/design-tokens";

type Status = "idle" | "loading" | "error" | "sent";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const emailId = useId();

  const isLoading = status === "loading";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setStatus("loading");

    const supabase = createBrowserSupabaseClientOrNull();
    if (!supabase) {
      setStatus("error");
      setErrorMessage("Brak konfiguracji Supabase w .env.local.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${authRedirectBase()}/auth/callback?next=/reset-password`,
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    setStatus("sent");
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

  if (status === "sent") {
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
            Jeśli konto <strong>{email.trim()}</strong> istnieje, wysłaliśmy na nie link do
            ustawienia nowego hasła. Otwórz go w tej samej przeglądarce.
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
          Wróć do logowania
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

      {status === "error" && (
        <div style={{ fontSize: 12, color: COLORS.loss }}>
          {errorMessage ?? "Nie udało się wysłać linku. Spróbuj ponownie."}
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
        {isLoading ? "Wysyłanie…" : "Wyślij link resetujący"}
      </button>
    </form>
  );
}
