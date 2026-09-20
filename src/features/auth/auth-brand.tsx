import Image from "next/image";
import type { CSSProperties } from "react";
import { COLORS, TYPOGRAPHY } from "@/lib/design-tokens";

/** Nagłówek marki na ekranach logowania: znak stoi wprost na tle, bez kafelka
 * (jak na landingu — .zlanding .mark), a wordmark i tytuł idą Didone, bo
 * spec Skarbca §4 przydziela nagłówkom ten krój. Cztery ekrany auth i bramka
 * odblokowania w app-shell trzymały każdy własną kopię tego bloku. */
export function AuthBrand({ tag = "Web · v0.1" }: { tag?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 20 }}>
      <Image src="/zecca-mark-96.png" alt="" width={26} height={26} style={{ width: 26, height: 26, objectFit: "contain" }} />
      <span style={{ fontFamily: TYPOGRAPHY.serif, fontSize: 20, fontWeight: 400, color: COLORS.text, lineHeight: 1 }}>
        Zecca
      </span>
      <span
        style={{
          fontSize: 10,
          color: COLORS.subtle,
          textTransform: "uppercase",
          letterSpacing: ".08em",
          alignSelf: "flex-end",
          paddingBottom: 2,
        }}
      >
        {tag}
      </span>
    </div>
  );
}

export const authTitleStyle: CSSProperties = {
  fontFamily: TYPOGRAPHY.serif,
  fontSize: "var(--t-8)",
  fontWeight: 500,
  color: COLORS.text,
  letterSpacing: "-0.01em",
  lineHeight: 1.15,
};
