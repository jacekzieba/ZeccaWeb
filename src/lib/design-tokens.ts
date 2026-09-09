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
    COLORS.crypto,
    COLORS.other,
    COLORS.muted,
  ],
} as const;

export const TYPOGRAPHY = {
  system: "var(--font-text)",
  serif: "var(--font-display)",
  mono: "var(--font-code)",
} as const;

/** Skala stopni pisma — dziesięć kroków, definicja w src/design/tokens.css.
 *
 * Style w tym produkcie są w większości inline, więc obok zmiennych CSS musi
 * istnieć ta sama drabina w TypeScripcie. Wartości są liczbami, bo `fontSize`
 * w stylach inline i tak przyjmuje px.
 */
export const TYPE_SCALE = {
  t1: 10,
  t2: 11,
  t3: 12,
  t4: 13,
  t5: 15,
  t6: 18,
  t7: 21,
  t8: 26,
  t9: 31,
  t10: 52,
} as const;

/** Najbliższy krok skali. Używane przez migrację i przy nowych stylach. */
export function typeStep(px: number): number {
  const kroki = Object.values(TYPE_SCALE);
  return kroki.reduce((a, b) => (Math.abs(b - px) < Math.abs(a - px) ? b : a));
}

// Pozostałość starego systemu — nowy system nie ma cieni. Nie dokładaj tu nowych
// wpisów; ten blok zniknie razem z migracją src/features na tokeny (Plan 3).
export const SHADOWS = {
  card: "0 1px 0 rgba(22,29,24,0.03), 0 6px 20px rgba(22,29,24,0.05)",
  cardStrong: "inset 0 1px 0 rgba(255,255,255,0.75), 0 14px 36px rgba(22,29,24,0.08)",
  button: "0 3px 10px rgba(22,29,24,0.22), inset 0 0.5px 0 rgba(255,255,255,0.16)",
  tooltip: "0 8px 22px rgba(0,0,0,0.22)",
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
