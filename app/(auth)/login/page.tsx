import Link from "next/link";
import { LoginForm } from "@/features/auth/login-form";
import { COLORS, SHADOWS, SURFACES } from "@/lib/design-tokens";

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
          borderRadius: 18,
          boxShadow: SHADOWS.cardStrong,
          padding: "36px 32px",
        }}
      >
        {/* Brand */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: COLORS.text,
                color: COLORS.white,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 15,
                fontWeight: 800,
                boxShadow: SHADOWS.button,
              }}
            >
              Z
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>Zecca</div>
              <div
                style={{
                  fontSize: 10,
                  color: COLORS.subtle,
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                }}
              >
                Web · v0.1
              </div>
            </div>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: COLORS.text, letterSpacing: "-0.01em" }}>
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
