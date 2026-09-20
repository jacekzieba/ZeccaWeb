import { ResetPasswordForm } from "@/features/auth/reset-password-form";
import { COLORS, SURFACES } from "@/lib/design-tokens";
import { AuthBrand, authTitleStyle } from "@/features/auth/auth-brand";

export default function ResetPasswordPage() {
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
            Nowe hasło
          </h1>
          <p style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 6, lineHeight: 1.5 }}>
            Ustaw nowe hasło logowania do konta.
          </p>
        </div>

        <ResetPasswordForm />
      </section>
    </main>
  );
}
