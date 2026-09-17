"use client";

import { COLORS } from "@/lib/design-tokens";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

export type OAuthStatus = "idle" | "loading-google" | "loading-apple";

/** Shared "Continue with Google/Apple" buttons + separator, used on both the
 * login and signup screens so the two forms don't drift out of sync. */
export function OAuthButtons({
  oauthStatus,
  onSelect,
  disabled,
}: {
  oauthStatus: OAuthStatus;
  onSelect: (provider: "google" | "apple") => void;
  disabled: boolean;
}) {
  const oauthBtnBase: React.CSSProperties = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "10px 16px",
    borderRadius: "var(--r-xl)",
    border: `0.5px solid ${COLORS.border}`,
    fontSize: 13,
    fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit",
    transition: "background .15s",
    opacity: disabled ? 0.6 : 1,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect("google")}
        style={{
          ...oauthBtnBase,
          background: oauthStatus === "loading-google" ? COLORS.surfaceAlt : COLORS.surface,
          color: COLORS.text,
        }}
      >
        <GoogleIcon />
        {oauthStatus === "loading-google" ? "Przekierowywanie…" : "Kontynuuj z Google"}
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect("apple")}
        style={{
          ...oauthBtnBase,
          background: oauthStatus === "loading-apple" ? COLORS.accent : COLORS.text,
          color: COLORS.white,
          border: "none",
        }}
      >
        <AppleIcon />
        {oauthStatus === "loading-apple" ? "Przekierowywanie…" : "Kontynuuj z Apple"}
      </button>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: COLORS.subtle,
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: ".06em",
          textTransform: "uppercase",
        }}
      >
        <div style={{ flex: 1, height: "0.5px", background: COLORS.border }} />
        lub
        <div style={{ flex: 1, height: "0.5px", background: COLORS.border }} />
      </div>
    </div>
  );
}
