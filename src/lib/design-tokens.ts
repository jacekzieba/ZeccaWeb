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
  gold: token("assetBonds"),
  crypto: token("assetCrypto"),
  other: token("assetDeposit"),
  plum: token("assetCrypto"),
  white: token("onAccent"),
  overlay: "rgba(11,26,20,0.42)",
  subtle: token("inkFaint"),
  muted: token("inkMuted"),
  lineSoft: token("line"),
  lineSofter: token("line2"),
  accentSoft: "color-mix(in srgb, var(--accent) 10%, transparent)",
  textSoft: "color-mix(in srgb, var(--ink) 5%, transparent)",
  textSofter: "color-mix(in srgb, var(--ink) 3%, transparent)",
} as const;

export const CHART_COLORS = {
  portfolio: COLORS.accent,
  comparison: COLORS.equity,
  benchmark: COLORS.forest,
  contribution: COLORS.bonds,
  positive: COLORS.profit,
  negative: COLORS.loss,
  cash: COLORS.cash,
  neutral: COLORS.neutral,
  crypto: COLORS.crypto,
  other: COLORS.other,
  categorical: [
    COLORS.accent,
    COLORS.equity,
    COLORS.forest,
    COLORS.bonds,
    COLORS.cash,
    COLORS.neutral,
    "#8A96A3",
    COLORS.other,
    "#7A8B84",
  ],
} as const;

export const TYPOGRAPHY = {
  system: "var(--font-text)",
  serif: "var(--font-display)",
  mono: "var(--font-code)",
} as const;

export const SHADOWS = {
  card: "0 1px 0 rgba(22,29,24,0.03), 0 6px 20px rgba(22,29,24,0.05)",
  cardStrong: "inset 0 1px 0 rgba(255,255,255,0.75), 0 14px 36px rgba(22,29,24,0.08)",
  button: "0 3px 10px rgba(22,29,24,0.22), inset 0 0.5px 0 rgba(255,255,255,0.16)",
  tooltip: "0 8px 22px rgba(0,0,0,0.22)",
} as const;

export const SURFACES = {
  glassCard: {
    background: COLORS.surface,
    borderRadius: 16,
    border: `0.5px solid ${COLORS.border}`,
    boxShadow: SHADOWS.card,
  } satisfies CSSProperties,
  glassPanel: {
    background: "rgba(247,248,244,0.70)",
    backdropFilter: "blur(38px) saturate(175%)",
    WebkitBackdropFilter: "blur(38px) saturate(175%)",
    border: "0.5px solid rgba(255,255,255,0.75)",
    boxShadow: SHADOWS.cardStrong,
  } satisfies CSSProperties,
} as const;
