import { describe, expect, it } from "vitest";
import { LIGHT, DARK, RADIUS, SPACE, TOKEN_NAMES } from "@/design/tokens";

describe("tokeny", () => {
  it("oba motywy mają dokładnie ten sam zestaw kluczy", () => {
    expect(Object.keys(LIGHT).sort()).toEqual(Object.keys(DARK).sort());
    expect(Object.keys(LIGHT).sort()).toEqual([...TOKEN_NAMES].sort());
  });

  it("motyw jasny ma zatwierdzone wartości", () => {
    expect(LIGHT).toEqual({
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
    });
  });

  it("motyw ciemny ma zatwierdzone wartości", () => {
    expect(DARK).toEqual({
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
    expect(Object.keys(V2)).toHaveLength(19);
  });

  // `gold` był drugim aliasem --asset-bonds. Trzy pliki nazywały go AMBER,
  // przez co „bursztynowe" elementy świeciły kolorem klasy aktywu, a wykresy
  // składu rysowały dwa wycinki tym samym kolorem. Alias bez własnej wartości
  // wraca jako pomyłka, więc bramka pilnuje, żeby nie wrócił.
  it("V2 nie ma aliasu gold", () => {
    expect(V2).not.toHaveProperty("gold");
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
