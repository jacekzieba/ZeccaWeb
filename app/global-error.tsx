"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { COLORS } from "@/lib/design-tokens";

// Catches React rendering errors that escape the app's error boundaries and
// reports them to Sentry. Replaces the root layout on a fatal error, so it must
// render its own <html>/<body>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pl">
      <body
        style={{
          background: COLORS.bg,
          color: COLORS.text,
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
        }}
      >
        <div style={{ textAlign: "center", padding: 24, maxWidth: 420 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            Coś poszło nie tak
          </h1>
          <p style={{ fontSize: 14, color: COLORS.textMuted, marginBottom: 20 }}>
            Wystąpił nieoczekiwany błąd. Zgłosiliśmy go automatycznie.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              background: COLORS.text,
              color: COLORS.white,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Spróbuj ponownie
          </button>
        </div>
      </body>
    </html>
  );
}
