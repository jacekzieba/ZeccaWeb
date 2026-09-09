"use client";

import { COLORS, SHADOWS, SURFACES } from "@/lib/design-tokens";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        display: "grid",
        placeItems: "center",
        padding: "24px 16px",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 420,
          ...SURFACES.glassPanel,
          borderRadius: 18,
          boxShadow: SHADOWS.cardStrong,
          padding: "36px 32px",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 21, fontWeight: 700, color: COLORS.text, letterSpacing: "-0.01em" }}>
          Coś poszło nie tak
        </h1>
        <p style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 8, lineHeight: 1.5 }}>
          Wystąpił nieoczekiwany błąd aplikacji. Twoje dane są bezpieczne — odszyfrowane
          informacje nie opuszczają przeglądarki.
        </p>
        {error.digest && (
          <p style={{ fontSize: 11, color: COLORS.subtle, marginTop: 8 }}>
            Kod błędu: {error.digest}
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "11px 16px",
              borderRadius: 10,
              border: "none",
              background: COLORS.text,
              color: COLORS.white,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: SHADOWS.button,
              fontFamily: "inherit",
            }}
          >
            Spróbuj ponownie
          </button>
          <a
            href="/dashboard"
            style={{
              padding: "11px 16px",
              borderRadius: 10,
              border: `0.5px solid ${COLORS.border}`,
              background: COLORS.surface,
              color: COLORS.text,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Wróć do dashboardu
          </a>
        </div>
      </section>
    </main>
  );
}
