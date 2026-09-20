import Link from "next/link";
import { SignupForm } from "@/features/auth/signup-form";
import { COLORS, SURFACES } from "@/lib/design-tokens";
import { AuthBrand, authTitleStyle } from "@/features/auth/auth-brand";

export default function RegisterPage() {
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
        }}
      >
        {/* Brand */}
        <div style={{ marginBottom: 28 }}>
          <AuthBrand />
          <h1 style={authTitleStyle}>
            Załóż konto
          </h1>
          <p style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 6, lineHeight: 1.5 }}>
            Twoje dane są szyfrowane tym samym hasłem lokalnie, w przeglądarce —
            nigdy nie opuszczają jej w formie jawnej.
          </p>
        </div>

        <SignupForm />

        <p style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 24, textAlign: "center" }}>
          Masz już konto?{" "}
          <Link href="/login" style={{ color: COLORS.text, fontWeight: 600 }}>
            Zaloguj się
          </Link>
        </p>
      </section>
    </main>
  );
}
