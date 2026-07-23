import Link from "next/link";
import { COLORS, SHADOWS, SURFACES } from "@/lib/design-tokens";

export default function NotFound() {
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
        <div style={{ fontSize: 40, fontWeight: 800, color: COLORS.subtle, letterSpacing: "-0.02em" }}>
          404
        </div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: COLORS.text,
            letterSpacing: "-0.01em",
            marginTop: 8,
          }}
        >
          Nie znaleziono strony
        </h1>
        <p style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 8, lineHeight: 1.5 }}>
          Strona, której szukasz, nie istnieje lub została przeniesiona.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            marginTop: 20,
            padding: "11px 16px",
            borderRadius: 10,
            border: "none",
            background: COLORS.text,
            color: COLORS.white,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
            boxShadow: SHADOWS.button,
          }}
        >
          Wróć na stronę główną
        </Link>
      </section>
    </main>
  );
}
