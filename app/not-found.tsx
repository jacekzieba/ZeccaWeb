import Link from "next/link";
import { COLORS, SURFACES } from "@/lib/design-tokens";
import { v2Mix } from "@/lib/v2-design";

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
          borderRadius: "var(--r-xl)",
          padding: "36px 32px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 31, fontWeight: 700, color: COLORS.subtle, letterSpacing: "-0.02em" }}>
          404
        </div>
        <h1
          style={{
            fontSize: 21,
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
            borderRadius: "var(--r-xl)",
            border: "none",
            background: COLORS.text,
            color: COLORS.white,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            boxShadow: `0 3px 10px ${v2Mix(COLORS.text, 0.22)}, inset 0 0.5px 0 ${v2Mix(COLORS.text, 0.1)}`,
          }}
        >
          Wróć na stronę główną
        </Link>
      </section>
    </main>
  );
}
