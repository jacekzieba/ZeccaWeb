import Link from "next/link";
import { LoginForm } from "@/features/auth/login-form";
import { COLORS, SURFACES } from "@/lib/design-tokens";
import { AuthBrand, authTitleStyle } from "@/features/auth/auth-brand";

export default function LoginPage() {
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
            Logowanie
          </h1>
          <p style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 6, lineHeight: 1.5 }}>
            Po zalogowaniu klucz danych będzie odblokowywany lokalnie w przeglądarce.
          </p>
        </div>

        <LoginForm />

        <p style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 24, textAlign: "center" }}>
          Nie masz konta?{" "}
          <Link href="/register" style={{ color: COLORS.text, fontWeight: 600 }}>
            Załóż konto
          </Link>
        </p>
        <p style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 8, textAlign: "center" }}>
          <Link href="/forgot-password" style={{ color: COLORS.text, fontWeight: 600 }}>
            Nie pamiętasz hasła?
          </Link>
        </p>
      </section>
    </main>
  );
}
