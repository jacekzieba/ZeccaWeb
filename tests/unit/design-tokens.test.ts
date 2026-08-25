import { describe, expect, it } from "vitest";
import { LIGHT, DARK, RADIUS, SPACE, TOKEN_NAMES } from "@/design/tokens";

describe("tokeny", () => {
  it("oba motywy mają dokładnie ten sam zestaw kluczy", () => {
    expect(Object.keys(LIGHT).sort()).toEqual(Object.keys(DARK).sort());
    expect(Object.keys(LIGHT).sort()).toEqual([...TOKEN_NAMES].sort());
  });

  it("motyw jasny ma zatwierdzone wartości", () => {
    expect(LIGHT).toEqual({
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
      rail: "rgba(18,59,43,0.22)",
      up: "#1E7A55",
      down: "#AE1F14",
      assetEquity: "#20507E",
      assetBonds: "#8F6B24",
      assetDeposit: "#7A6E63",
      assetCash: "#4A5A68",
      assetCrypto: "#8A6FD0",
    });
  });

  it("motyw ciemny ma zatwierdzone wartości", () => {
    expect(DARK).toEqual({
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
      rail: "rgba(159,191,174,0.16)",
      up: "#35A87A",
      down: "#D9463A",
      assetEquity: "#3E7FB8",
      assetBonds: "#C9A24F",
      assetDeposit: "#B0A294",
      assetCash: "#8FA6B8",
      assetCrypto: "#B6A2E4",
    });
  });

  it("jest pięć klas aktywów, nie cztery", () => {
    const classes = TOKEN_NAMES.filter((n) => n.startsWith("asset"));
    expect(classes).toHaveLength(5);
  });

  it("nie ma tokenu ostrzeżenia — stan niesie słowo i glif", () => {
    expect(TOKEN_NAMES).not.toContain("warning");
  });

  it("skala promieni ma sześć stopni, a odstępów dziewięć", () => {
    expect(Object.keys(RADIUS)).toHaveLength(6);
    expect(SPACE).toEqual([4, 8, 12, 16, 24, 32, 48, 64, 96]);
  });
});

import { readFileSync } from "node:fs";
import { cssVarName } from "@/design/tokens";

describe("tokens.css", () => {
  const css = readFileSync("src/design/tokens.css", "utf8");

  it("deklaruje każdy token w :root", () => {
    for (const name of TOKEN_NAMES) {
      expect(css).toContain(`${cssVarName(name)}: ${LIGHT[name]}`);
    }
  });

  it("nadpisuje każdy token w [data-theme='dark']", () => {
    const dark = css.slice(css.indexOf('[data-theme="dark"]'));
    for (const name of TOKEN_NAMES) {
      expect(dark).toContain(`${cssVarName(name)}: ${DARK[name]}`);
    }
  });

  it("nie deklaruje żadnego cienia", () => {
    expect(css).not.toMatch(/box-shadow|--shadow/);
  });
});

import { COLORS } from "@/lib/design-tokens";
import { V2, v2Mix } from "@/lib/v2-design";

describe("warstwa zgodnosci", () => {
  it("COLORS nie zawiera już literałów hex", () => {
    for (const [key, value] of Object.entries(COLORS)) {
      expect(value, `COLORS.${key}`).not.toMatch(/^#[0-9a-f]{3,8}$/i);
    }
  });

  it("V2 nie zawiera już literałów hex", () => {
    for (const [key, value] of Object.entries(V2)) {
      expect(value, `V2.${key}`).not.toMatch(/^#[0-9a-f]{3,8}$/i);
    }
  });

  it("klucze obu warstw zostały nietknięte", () => {
    expect(Object.keys(COLORS)).toHaveLength(28);
    expect(Object.keys(V2)).toHaveLength(20);
  });

  it("v2Glass zniknął — system nie ma cieni", async () => {
    const mod = await import("@/lib/v2-design");
    expect(mod).not.toHaveProperty("v2Glass");
  });
});

describe("v2Mix", () => {
  it("wywołane z tokenem V2 nie produkuje NaN", () => {
    expect(v2Mix(V2.ink, 0.32)).not.toContain("NaN");
  });

  it("zwraca poprawną składnię color-mix dla wejścia var()", () => {
    expect(v2Mix("var(--ink)", 0.32)).toBe(
      "color-mix(in srgb, var(--ink) 32%, transparent)"
    );
  });

  it("nadal działa dla literału hex (zgodność wsteczna)", () => {
    expect(v2Mix("#161D18", 0.07)).toBe(
      "color-mix(in srgb, #161D18 7%, transparent)"
    );
  });
});

import { readdirSync } from "node:fs";
import { join } from "node:path";

describe("brak lokalnych kopii mieszania kolorow", () => {
  it("pliki importujące COLORS lub V2 nie parsują koloru jako hex", () => {
    const roots = ["src/features", "src/components", "src/lib"];
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          files.push(full);
        }
      }
    };
    for (const root of roots) walk(root);

    const offenders = files.filter((file) => {
      const content = readFileSync(file, "utf8");
      const parsesHex = content.includes("parseInt(") && /,\s*16\s*\)/.test(content);
      if (!parsesHex) return false;
      return (
        /import\s*\{[^}]*\bCOLORS\b[^}]*\}\s*from\s*["'][^"']*design-tokens["']/.test(content) ||
        /import\s*\{[^}]*\bV2\b[^}]*\}\s*from\s*["'][^"']*v2-design["']/.test(content)
      );
    });

    expect(offenders, `lokalne parsowanie hexa mimo importu COLORS/V2: ${offenders.join(", ")}`).toEqual([]);
  });
});
