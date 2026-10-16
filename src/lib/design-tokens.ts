import type { CSSProperties } from "react";
import { token } from "@/design/tokens";

export const COLORS = {
  bg: token("ground"),
  surface: token("surface"),
  surfaceAlt: token("surface2"),
  border: token("line"),
  text: token("ink"),
  textMuted: token("inkMuted"),
  green: token("ink"),
  profit: token("up"),
  loss: token("down"),
  cash: token("assetCash"),
  bonds: token("assetBonds"),
  equity: token("assetEquity"),
  forest: token("ink"),
  accent: token("accent"),
  neutral: token("inkFaint"),
  // `gold` był drugim aliasem --asset-bonds; został sam bursztyn akcentu.
  brand: token("accent"),
  crypto: token("assetCrypto"),
  other: token("assetDeposit"),
  plum: token("assetCrypto"),
  white: token("onAccent"),
  overlay: "color-mix(in srgb, var(--ground) 42%, transparent)",
  subtle: token("inkFaint"),
  muted: token("inkMuted"),
  lineSoft: token("line"),
  lineSofter: token("line2"),
  accentSoft: "color-mix(in srgb, var(--accent) 10%, transparent)",
  textSoft: "color-mix(in srgb, var(--ink) 5%, transparent)",
  textSofter: "color-mix(in srgb, var(--ink) 3%, transparent)",
} as const;

export const TYPOGRAPHY = {
  system: "var(--font-text)",
  serif: "var(--font-display)",
  mono: "var(--font-code)",
} as const;

export const SURFACES = {
  glassCard: {
    background: COLORS.surface,
    borderRadius: "var(--r-md)",
    border: `1px solid ${COLORS.border}`,
  } satisfies CSSProperties,
  // Dawniej panel „szklany" z backdrop-filter i cieniem. Nowy system buduje
  // wysokość wartością powierzchni i włosem — nigdy rozmyciem ani cieniem.
  glassPanel: {
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
  } satisfies CSSProperties,
} as const;
