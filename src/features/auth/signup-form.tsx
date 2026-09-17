"use client";

import { useId, useState } from "react";
import { createBrowserSupabaseClientOrNull } from "@/supabase/client";
import { authRedirectBase } from "@/lib/auth-redirect";
import { COLORS } from "@/lib/design-tokens";
import { v2Mix } from "@/lib/v2-design";
import { OAuthButtons, type OAuthStatus } from "@/features/auth/oauth-buttons";
import { setPendingAuthPassword } from "@/features/auth/pending-auth-password";
import { MIN_PASSWORD_LENGTH, passwordRequirementError } from "@/features/auth/password-requirements";

type Status = "idle" | "loading" | "error" | "confirm-sent";

function friendlySignupError(message: string): string {
  if (/already registered|already exists/i.test(message)) {
    return "Konto z tym adresem e-mail już istnieje. Spróbuj się zalogować.";
  }
  if (/password/i.test(message) && /character|letter|digit|symbol/i.test(message)) {
    return "Hasło musi zawierać małą literę, wielką literę i cyfrę.";
  }
  return "Nie udało się utworzyć konta. Spróbuj ponownie.";
}

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [oauthStatus, setOauthStatus] = useState<OAuthStatus>("idle");
  const emailId = useId();
  const passwordId = useId();
  const confirmId = useId();

  const isLoading = status === "loading" || oauthStatus !== "idle";

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

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${authRedirectBase()}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(friendlySignupError(error.message));
      return;
    }

    // Email confirmation OFF → a session is returned immediately, go straight in.
    // The password becomes this account's encryption passphrase too (see
    // SyncUnlockPanel) — hand it off across the reload so the user is never
    // asked for a second secret.
    if (data.session) {
      setPendingAuthPassword(password);
      window.location.assign("/dashboard");
      return;
    }

    // Email confirmation ON → user must click the link in their inbox, then
    // log in — the login form hands off the password the same way.
    setStatus("confirm-sent");
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

  if (status === "confirm-sent") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          style={{
            padding: "14px 16px",
            borderRadius: "var(--r-xl)",
            background: COLORS.surfaceAlt,
            border: `0.5px solid ${COLORS.border}`,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>
            Sprawdź swoją skrzynkę
          </div>
          <p style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.5 }}>
            Wysłaliśmy link potwierdzający na <strong>{email.trim()}</strong>. Kliknij go,
            aby aktywować konto, a następnie zaloguj się swoim hasłem.
          </p>
        </div>
        <a
          href="/login"
          style={{
            textAlign: "center",
            padding: "11px 16px",
            borderRadius: "var(--r-xl)",
            border: `0.5px solid ${COLORS.border}`,
            background: COLORS.surface,
            color: COLORS.text,
            fontSize: 13,
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <OAuthButtons oauthStatus={oauthStatus} onSelect={handleOAuth} disabled={isLoading} />

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
          <div style={{ fontSize: 11, color: COLORS.subtle, marginTop: 5 }}>
            Min. 8 znaków, w tym mała litera, wielka litera i cyfra.
          </div>
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
            borderRadius: "var(--r-xl)",
            border: "none",
            background: isLoading ? COLORS.surfaceAlt : COLORS.text,
            color: isLoading ? COLORS.textMuted : COLORS.white,
            fontSize: 13,
            fontWeight: 600,
            cursor: isLoading ? "not-allowed" : "pointer",
            boxShadow: isLoading ? "none" : `0 3px 10px ${v2Mix(COLORS.text, 0.22)}, inset 0 0.5px 0 ${v2Mix(COLORS.text, 0.1)}`,
            transition: "background .15s",
            fontFamily: "inherit",
          }}
        >
          {isLoading ? "Tworzenie konta…" : "Utwórz konto"}
        </button>
      </form>
    </div>
  );
}
