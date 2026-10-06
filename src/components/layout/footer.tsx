import Link from "next/link";
import { COLORS } from "@/lib/design-tokens";
import { INVESTMENT_DISCLAIMER } from "@/lib/investment-disclaimer";
import { CopyrightYear } from "./copyright-year";
import { AnalyticsConsentReset } from "./analytics-consent-reset";

export function Footer() {
  return (
    <footer
      style={{
        borderTop: `0.5px solid ${COLORS.border}`,
        padding: "24px 16px",
        marginTop: "48px",
      }}
    >
      <div
        style={{
          maxWidth: "1240px",
          marginInline: "auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 12, color: COLORS.textMuted }}>
          © <CopyrightYear /> Zecca. Wszelkie prawa zastrzeżone.
        </div>

        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <Link href="/privacy-policy" className="footer-link" style={{ fontSize: 12 }}>
            Polityka prywatności
          </Link>
          <Link href="/faq" className="footer-link" style={{ fontSize: 12 }}>
            FAQ
          </Link>
          <AnalyticsConsentReset className="footer-link" style={{ fontSize: 12 }}>
            Zmień zgodę na statystyki
          </AnalyticsConsentReset>
        </div>
      </div>
      <p
        style={{
          maxWidth: "1240px",
          marginInline: "auto",
          marginTop: 12,
          fontSize: 12,
          lineHeight: 1.5,
          color: COLORS.textMuted,
        }}
      >
        {INVESTMENT_DISCLAIMER}
      </p>
    </footer>
  );
}
