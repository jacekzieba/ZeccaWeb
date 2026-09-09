/** Jedyne miejsce, w którym żyją wartości designu. Wszystko inne aliasuje stąd. */

export const TOKEN_NAMES = [
  "ground", "surface", "surface2", "line", "line2",
  "ink", "inkMuted", "inkFaint",
  "accent", "onAccent", "rail",
  "up", "down",
  "assetEquity", "assetBonds", "assetDeposit", "assetCash", "assetCrypto",
] as const;

export type TokenName = (typeof TOKEN_NAMES)[number];
export type ThemeTokens = Record<TokenName, string>;

export const LIGHT: ThemeTokens = {
  ground: "#FAF8F4",
  surface: "#FFFFFF",
  surface2: "#F2EFE9",
  line: "rgba(26,23,18,0.14)",
  line2: "rgba(26,23,18,0.07)",
  ink: "#1A1712",
  inkMuted: "#5E574C",
  inkFaint: "#8C857A",
  accent: "#A9682A",
  onAccent: "#FFF8EF",
  rail: "rgba(26,23,18,0.22)",
  up: "#1E7A55",
  down: "#AE1F14",
  assetEquity: "#2F6B55",
  assetBonds: "#8F6B24",
  assetDeposit: "#7A6E63",
  assetCash: "#4A5A68",
  assetCrypto: "#6E52B0",
};

export const DARK: ThemeTokens = {
  ground: "#020A0B",
  surface: "#06110F",
  surface2: "#0B1917",
  line: "rgba(198,232,222,0.11)",
  line2: "rgba(198,232,222,0.06)",
  ink: "#ECEFEC",
  inkMuted: "#9FB0AA",
  inkFaint: "#80958E",
  accent: "#F0A43C",
  onAccent: "#160C02",
  rail: "rgba(198,232,222,0.22)",
  up: "#4FC79A",
  down: "#E2685A",
  assetEquity: "#63A594",
  assetBonds: "#C9A24F",
  assetDeposit: "#8A9E97",
  assetCash: "#5C7E93",
  assetCrypto: "#B6A2E4",
};

export const RADIUS = {
  xs: "2px",
  sm: "3px",
  md: "4px",
  lg: "8px",
  xl: "12px",
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
