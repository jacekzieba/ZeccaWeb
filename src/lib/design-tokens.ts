import type { CSSProperties } from "react";

export const COLORS = {
  bg: "#E4E6E2",
  surface: "#F7F8F4",
  surfaceAlt: "#ECEEE7",
  border: "rgba(22,29,24,0.13)",
  text: "#161D18",
  textMuted: "#4A544E",
  green: "#214A35",
  profit: "#23814F",
  loss: "#A84432",
  cash: "#56677D",
  bonds: "#8C6F30",
  equity: "#34699A",
  forest: "#214A35",
  accent: "#214A35",
  neutral: "#A0ADB8",
  gold: "#A2772E",
  crypto: "#7E5AA5",
  other: "#8E7A64",
  plum: "#9A6B83",
  white: "#F4F2E6",
  overlay: "rgba(22,29,24,0.42)",
  subtle: "#717870",
  muted: "#4A544E",
  lineSoft: "rgba(22,29,24,0.13)",
  lineSofter: "rgba(22,29,24,0.07)",
  accentSoft: "rgba(33,74,53,0.10)",
  textSoft: "rgba(22,29,24,0.05)",
  textSofter: "rgba(22,29,24,0.03)",
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
  system:
    "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', system-ui, sans-serif",
  serif: "'Newsreader', Georgia, 'Times New Roman', serif",
  mono: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
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
