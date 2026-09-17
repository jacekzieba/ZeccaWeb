"use client";

import { useId, useState } from "react";
import { createBrowserSupabaseClientOrNull } from "@/supabase/client";
import { authRedirectBase } from "@/lib/auth-redirect";
import { COLORS } from "@/lib/design-tokens";
import { v2Mix } from "@/lib/v2-design";
import { OAuthButtons, type OAuthStatus } from "@/features/auth/oauth-buttons";
import { setPendingAuthPassword } from "@/features/auth/pending-auth-password";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [oauthStatus, setOauthStatus] = useState<OAuthStatus>("idle");
  const emailId = useId();
  const passwordId = useId();

  const isLoading = status === "loading" || oauthStatus !== "idle";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setErrorMessage(null);

    const supabase = createBrowserSupabaseClientOrNull();

    if (!supabase) {
      setStatus("error");
      setErrorMessage("Brak konfiguracji Supabase w .env.local.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    // Hand the password off across the reload so SyncUnlockPanel can try it
    // as the encryption key before ever asking the user for anything extra.
    setPendingAuthPassword(password);
    window.location.assign("/dashboard");
  }

  async function handleOAuth(provider: "google" | "apple") {
    const supabase = createBrowserSupabaseClientOrNull();
    if (!supabase) return;

    setOauthStatus(provider === "google" ? "loading-google" : "loading-apple");

    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${authRedirectBase()}/auth/callback`,
      },
    });
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
    boxShadow: `inset 0 1px 2px ${v2Mix(COLORS.text, 0.04)}`,
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <OAuthButtons oauthStatus={oauthStatus} onSelect={handleOAuth} disabled={isLoading} />

      {/* Email/password form */}
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
            autoComplete="current-password"
            required
            placeholder="••••••••"
          />
        </div>

        {status === "error" && (
          <div style={{ fontSize: 12, color: COLORS.loss }}>
            {errorMessage ?? "Nie udało się zalogować. Sprawdź dane i konfigurację Supabase."}
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
            boxShadow:
              isLoading
                ? "none"
                : `0 3px 10px ${v2Mix(COLORS.text, 0.22)}, inset 0 0.5px 0 ${v2Mix(COLORS.text, 0.1)}`,
            transition: "background .15s",
            fontFamily: "inherit",
          }}
        >
          {status === "loading" ? "Logowanie…" : "Zaloguj się"}
        </button>
      </form>
    </div>
  );
}
