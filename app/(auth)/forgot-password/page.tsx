import Link from "next/link";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";
import { COLORS, SURFACES } from "@/lib/design-tokens";
import { AuthBrand, authTitleStyle } from "@/features/auth/auth-brand";

export default function ForgotPasswordPage() {
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
            Reset hasła
          </h1>
          <p style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 6, lineHeight: 1.5 }}>
            Podaj adres e-mail konta, a wyślemy link do ustawienia nowego hasła logowania.
            Uwaga: to samo hasło odblokowuje Twoje zaszyfrowane dane, a reset przez link nie zna starego hasła — możesz więc stracić dostęp do już zsynchronizowanych danych, chyba że masz osobną frazę (passphrase).
          </p>
        </div>

        <ForgotPasswordForm />

        <p style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 24, textAlign: "center" }}>
          Pamiętasz hasło?{" "}
          <Link href="/login" style={{ color: COLORS.text, fontWeight: 600 }}>
            Zaloguj się
          </Link>
        </p>
      </section>
    </main>
  );
}
