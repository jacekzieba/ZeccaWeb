/** Jedyne miejsce, w którym żyją wartości designu. Wszystko inne aliasuje stąd. */

export const TOKEN_NAMES = [
  "ground", "surface", "surface2", "line", "line2",
  "ink", "inkMuted", "inkFaint",
  "accent", "onAccent", "guilloche",
  "up", "down",
  "assetEquity", "assetBonds", "assetDeposit", "assetCash", "assetCrypto",
] as const;

export type TokenName = (typeof TOKEN_NAMES)[number];
export type ThemeTokens = Record<TokenName, string>;

export const LIGHT: ThemeTokens = {
  ground: "#FBFCFA",
  surface: "#FFFFFF",
  surface2: "#F1F4F1",
  line: "rgba(18,59,43,0.14)",
  line2: "rgba(18,59,43,0.07)",
  ink: "#123B2B",
  inkMuted: "#55665C",
  inkFaint: "#8A9890",
  accent: "#A0512F",
  onAccent: "#FFF6F2",
  guilloche: "rgba(18,59,43,0.14)",
  up: "#1E7A55",
  down: "#AE1F14",
  assetEquity: "#20507E",
  assetBonds: "#8F6B24",
  assetDeposit: "#7A6E63",
  assetCash: "#4A5A68",
  assetCrypto: "#8A6FD0",
};

export const DARK: ThemeTokens = {
  ground: "#0B1A14",
  surface: "#122A20",
  surface2: "#1A382A",
  line: "rgba(159,191,174,0.16)",
  line2: "rgba(159,191,174,0.08)",
  ink: "#EDF2EE",
  inkMuted: "#8FAE9C",
  inkFaint: "#5E7A6B",
  accent: "#C9765F",
  onAccent: "#190A05",
  guilloche: "rgba(159,191,174,0.09)",
  up: "#35A87A",
  down: "#D9463A",
  assetEquity: "#3E7FB8",
  assetBonds: "#C9A24F",
  assetDeposit: "#B0A294",
  assetCash: "#8FA6B8",
  assetCrypto: "#B6A2E4",
};

export const RADIUS = {
  xs: "4px",
  sm: "10px",
  md: "14px",
  lg: "20px",
  xl: "28px",
  pill: "999px",
} as const;

export const SPACE = [4, 8, 12, 16, 24, 32, 48, 64, 96] as const;

/**
 * Nazwa właściwości CSS dla tokenu.
 * assetEquity -> --asset-equity, surface2 -> --surface-2
 *
 * Cyfra też otwiera nowy człon: bez tego `surface2` dawało `--surface2`,
 * co rozjeżdżało się z konwencją CSS i z konfiguracją Tailwinda.
 */
export function cssVarName(name: TokenName): string {
  return "--" + name.replace(/[A-Z]|\d+/g, (part) => "-" + part.toLowerCase());
}

/** Odwołanie do tokenu w stylach JS: token("ink") -> "var(--ink)" */
export function token(name: TokenName): string {
  return `var(${cssVarName(name)})`;
}
