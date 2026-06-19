"use client";

import Link from "next/link";
import { COLORS } from "@/lib/design-tokens";

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
          © {new Date().getFullYear()} Zecca. Wszelkie prawa zastrzeżone.
        </div>

        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <Link
            href="/privacy-policy"
            style={{
              fontSize: 12,
              color: COLORS.textMuted,
              textDecoration: "none",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = COLORS.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = COLORS.textMuted;
            }}
          >
            Polityka prywatności
          </Link>
          <Link
            href="/faq"
            style={{
              fontSize: 12,
              color: COLORS.textMuted,
              textDecoration: "none",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = COLORS.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = COLORS.textMuted;
            }}
          >
            FAQ
          </Link>
        </div>
      </div>
    </footer>
  );
}
