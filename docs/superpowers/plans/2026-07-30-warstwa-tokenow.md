# Warstwa tokenów „Certyfikat" — plan implementacji

> **Dla agentów:** WYMAGANY SUB-SKILL: użyj `superpowers:subagent-driven-development` (zalecane)
> albo `superpowers:executing-plans`, żeby wykonać ten plan zadanie po zadaniu.
> Kroki mają składnię checkboxów (`- [ ]`) do śledzenia postępu.

**Cel:** Jedno źródło tokenów dla całej aplikacji, w dwóch motywach, podpięte pod istniejące
`COLORS` i `V2` tak, że 1015 istniejących wywołań zmienia wygląd bez edycji ani jednego z nich.

**Architektura:** Nowy moduł `src/design/tokens.ts` jest jedynym miejscem, gdzie żyją wartości.
`src/lib/design-tokens.ts` i `src/lib/v2-design.tsx` zostają jako **warstwy zgodności** —
ich klucze przestają być literałami, a stają się aliasami na nowe tokeny. Dzięki temu migracja
wywołań jest późniejsza i opcjonalna, a zmiana wyglądu jest natychmiastowa. Motywy realizuje
CSS przez `data-theme` na `<html>`; TypeScript eksportuje te same wartości do miejsc,
które liczą kolory w JS (wykresy).

**Stack:** Next.js 15 (App Router), TypeScript, Tailwind 3.4, vitest + jsdom, `next/font/google`.

## Global Constraints

- **Motyw domyślny: jasny.** Ciemny wyprowadzony przez nadpisanie `[data-theme="dark"]`.
- **Zero cieni w systemie.** Wysokość buduje wartość powierzchni plus włos, nigdy rozmycie.
- **Jedna skala promieni:** `--r-xs 4px`, `--r-sm 10px`, `--r-md 14px`, `--r-lg 20px`, `--r-xl 28px`, `--r-pill 999px`.
- **Skala odstępów czwórkowa:** 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96. Nic pomiędzy.
- **Kroje:** display `Source Serif 4`, tekst `IBM Plex Sans`, mono `IBM Plex Mono` — mono wyłącznie
  na identyfikatory maszynowe (ISIN, seria obligacji, hash eksportu).
- **Podzbiory fontów muszą zawierać `latin-ext`** — bez tego nie ma `ą ć ę ł ń ó ś ź ż`.
- **Kolor nigdy nie jest jedynym nośnikiem znaczenia.** Zysk i strata niosą glif `▲`/`▼`;
  klasy aktywów niosą kształt markera.
- Wszystkie wartości poniżej są przepisane dosłownie ze specyfikacji
  `docs/superpowers/specs/2026-07-29-design-system-certyfikat-design.md`.

---

## Struktura plików

| plik | odpowiedzialność |
|---|---|
| `src/design/tokens.ts` (nowy) | jedyne źródło wartości; eksport dla JS i lista do wygenerowania CSS |
| `src/design/tokens.css` (nowy) | właściwości CSS w `:root` i `[data-theme="dark"]` |
| `src/lib/design-tokens.ts` (modyfikacja) | warstwa zgodności: `COLORS` aliasuje nowe tokeny |
| `src/lib/v2-design.tsx` (modyfikacja) | warstwa zgodności: `V2` aliasuje; `v2Glass` usunięty |
| `app/layout.tsx` (modyfikacja) | ładowanie krojów przez `next/font/google`, `data-theme` |
| `app/globals.css` (modyfikacja) | import `tokens.css`, usunięcie `--inv-*` i `color-scheme: light` |
| `tailwind.config.ts` (modyfikacja) | kolory czytają ze zmiennych CSS; daisyUI i martwe kolory usunięte |
| `tests/unit/design-tokens.test.ts` (nowy) | kontrakt tokenów i zgodność warstw |
| `tests/unit/no-hardcoded-values.test.ts` (nowy) | test blokujący: brak literałów poza tokenami |

---

### Task 1: Moduł tokenów

**Files:**
- Create: `src/design/tokens.ts`
- Test: `tests/unit/design-tokens.test.ts`

**Interfaces:**
- Consumes: nic
- Produces: `LIGHT: ThemeTokens`, `DARK: ThemeTokens`, `RADIUS`, `SPACE`,
  `type ThemeTokens = Record<TokenName, string>`, `TOKEN_NAMES: readonly TokenName[]`

- [ ] **Step 1: Napisz test, który ma nie przejść**

```ts
// tests/unit/design-tokens.test.ts
import { describe, expect, it } from "vitest";
import { LIGHT, DARK, RADIUS, SPACE, TOKEN_NAMES } from "@/design/tokens";

describe("tokeny", () => {
  it("oba motywy mają dokładnie ten sam zestaw kluczy", () => {
    expect(Object.keys(LIGHT).sort()).toEqual(Object.keys(DARK).sort());
    expect(Object.keys(LIGHT).sort()).toEqual([...TOKEN_NAMES].sort());
  });

  it("motyw jasny ma zatwierdzone wartości", () => {
    expect(LIGHT.ground).toBe("#FBFCFA");
    expect(LIGHT.ink).toBe("#123B2B");
    expect(LIGHT.accent).toBe("#A0512F");
    expect(LIGHT.assetDeposit).toBe("#7A6E63");
  });

  it("motyw ciemny ma zatwierdzone wartości", () => {
    expect(DARK.ground).toBe("#0B1A14");
    expect(DARK.accent).toBe("#C9765F");
    expect(DARK.assetDeposit).toBe("#B0A294");
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
```

- [ ] **Step 2: Uruchom test i potwierdź, że nie przechodzi**

Run: `npx vitest run tests/unit/design-tokens.test.ts`
Expected: FAIL — `Failed to resolve import "@/design/tokens"`

- [ ] **Step 3: Napisz moduł**

```ts
// src/design/tokens.ts

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

/** Nazwa właściwości CSS dla tokenu: assetEquity -> --asset-equity */
export function cssVarName(name: TokenName): string {
  return "--" + name.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
}

/** Odwołanie do tokenu w stylach JS: token("ink") -> "var(--ink)" */
export function token(name: TokenName): string {
  return `var(${cssVarName(name)})`;
}
```

- [ ] **Step 4: Uruchom test i potwierdź, że przechodzi**

Run: `npx vitest run tests/unit/design-tokens.test.ts`
Expected: PASS, 6 testów

- [ ] **Step 5: Commit**

```bash
git add src/design/tokens.ts tests/unit/design-tokens.test.ts
git commit -m "feat(design): modul tokenow jako jedyne zrodlo wartosci"
```

---

### Task 2: Warstwa CSS i przełączanie motywu

**Files:**
- Create: `src/design/tokens.css`
- Modify: `app/globals.css:1-30`
- Modify: `app/layout.tsx`
- Test: `tests/unit/design-tokens.test.ts` (dopisanie)

**Interfaces:**
- Consumes: `TOKEN_NAMES`, `LIGHT`, `DARK`, `cssVarName` z Task 1
- Produces: właściwości CSS `--ground`, `--surface`, … dostępne globalnie; `--r-*` i `--space-*`

- [ ] **Step 1: Dopisz test sprawdzający, że CSS i TS się nie rozjadą**

```ts
// dopisz na końcu tests/unit/design-tokens.test.ts
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
```

- [ ] **Step 2: Uruchom test i potwierdź, że nie przechodzi**

Run: `npx vitest run tests/unit/design-tokens.test.ts`
Expected: FAIL — `ENOENT: no such file or directory, open 'src/design/tokens.css'`

- [ ] **Step 3: Napisz `src/design/tokens.css`**

```css
/* Generowane ręcznie, ale pilnowane testem tests/unit/design-tokens.test.ts.
   Zmieniasz tu — zmień też src/design/tokens.ts, inaczej test padnie. */

:root {
  color-scheme: light dark;

  --ground: #FBFCFA;
  --surface: #FFFFFF;
  --surface-2: #F1F4F1;
  --line: rgba(18,59,43,0.14);
  --line-2: rgba(18,59,43,0.07);
  --ink: #123B2B;
  --ink-muted: #55665C;
  --ink-faint: #8A9890;
  --accent: #A0512F;
  --on-accent: #FFF6F2;
  --guilloche: rgba(18,59,43,0.14);
  --up: #1E7A55;
  --down: #AE1F14;
  --asset-equity: #20507E;
  --asset-bonds: #8F6B24;
  --asset-deposit: #7A6E63;
  --asset-cash: #4A5A68;
  --asset-crypto: #8A6FD0;

  --r-xs: 4px;
  --r-sm: 10px;
  --r-md: 14px;
  --r-lg: 20px;
  --r-xl: 28px;
  --r-pill: 999px;

  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 64px; --space-9: 96px;
}

[data-theme="dark"] {
  --ground: #0B1A14;
  --surface: #122A20;
  --surface-2: #1A382A;
  --line: rgba(159,191,174,0.16);
  --line-2: rgba(159,191,174,0.08);
  --ink: #EDF2EE;
  --ink-muted: #8FAE9C;
  --ink-faint: #5E7A6B;
  --accent: #C9765F;
  --on-accent: #190A05;
  --guilloche: rgba(159,191,174,0.09);
  --up: #35A87A;
  --down: #D9463A;
  --asset-equity: #3E7FB8;
  --asset-bonds: #C9A24F;
  --asset-deposit: #B0A294;
  --asset-cash: #8FA6B8;
  --asset-crypto: #B6A2E4;
}
```

- [ ] **Step 4: Podepnij CSS i usuń martwe deklaracje z `app/globals.css`**

W `app/globals.css` zamień pierwsze 30 linii. Było: `@tailwind` plus blok `:root`
ze zmiennymi `--inv-*` i `color-scheme: light`. Ma być:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html {
  background: var(--ground);
}

body {
  min-height: 100vh;
  background: var(--ground);
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
```

Usuwasz: cały blok `:root { color-scheme: light; --inv-bg … --inv-font-mono }`
oraz `font-family: var(--inv-font-system)` z `body`.

**Nie używaj tu `@import`.** Projekt nie ma `postcss-import` (sprawdzone w `postcss.config.mjs`),
więc reguła `@import` nie zostałaby zinlinowana i przeglądarka próbowałaby pobrać plik ze `src/`,
co się nie powiedzie. Token CSS podpinamy importem modułu w `layout.tsx` — następny krok.

- [ ] **Step 5: Zaimportuj tokeny i ustaw motyw domyślny w `app/layout.tsx`**

Dodaj import obok istniejącego `import "./globals.css";`:

```tsx
import "@/design/tokens.css";
import "./globals.css";
```

Następnie znajdź `<html ...>` i dodaj atrybut:

```tsx
<html lang="pl" data-theme="light">
```

Kolejność importów nie ma znaczenia dla poprawności — właściwości niestandardowe
rozwiązują się w momencie użycia, nie deklaracji.

- [ ] **Step 6: Uruchom testy i build**

Run: `npx vitest run tests/unit/design-tokens.test.ts && npm run typecheck`
Expected: PASS 9 testów, typecheck bez błędów

- [ ] **Step 7: Commit**

```bash
git add src/design/tokens.css app/globals.css app/layout.tsx tests/unit/design-tokens.test.ts
git commit -m "feat(design): warstwa CSS tokenow i jasny motyw domyslny"
```

---

### Task 3: Warstwa zgodności — 1015 wywołań bez edycji

**Files:**
- Modify: `src/lib/design-tokens.ts:3-33` (`COLORS`)
- Modify: `src/lib/v2-design.tsx:4-25` (`V2`), `:41-47` (`v2Glass`)
- Test: `tests/unit/design-tokens.test.ts` (dopisanie)

**Interfaces:**
- Consumes: `token()` z Task 1
- Produces: `COLORS` i `V2` o niezmienionych kluczach, ale wartościach `var(--…)`

**Dlaczego tak:** `COLORS` ma 287 użyć w 30 plikach, `V2` — 728 w 21. Przepięcie wartości
zmienia wygląd całej aplikacji natychmiast, bez dotykania wywołań. Migracja wywołań jest
osobnym, późniejszym planem.

- [ ] **Step 1: Napisz test warstwy zgodności**

```ts
// dopisz na końcu tests/unit/design-tokens.test.ts
import { COLORS } from "@/lib/design-tokens";
import { V2 } from "@/lib/v2-design";

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
```

- [ ] **Step 2: Uruchom test i potwierdź, że nie przechodzi**

Run: `npx vitest run tests/unit/design-tokens.test.ts`
Expected: FAIL — `COLORS.bg` nadal jest `#E4E6E2`

- [ ] **Step 3: Przepnij `COLORS` w `src/lib/design-tokens.ts`**

Zamień cały blok `export const COLORS = { … } as const;` (linie 3–33) na:

```ts
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
```

To jest komplet — `COLORS` ma dokładnie 28 kluczy i wszystkie są wyżej. Moduł nigdy nie miał
osobnego klucza na lokaty; `other` pełnił tę rolę i dlatego mapuje się na `assetDeposit`.

- [ ] **Step 4: Przepnij `V2` i usuń `v2Glass` w `src/lib/v2-design.tsx`**

```ts
import { token } from "@/design/tokens";

export const V2 = {
  page: token("ground"),
  card: token("surface"),
  card2: token("surface2"),
  ink: token("ink"),
  muted: token("inkMuted"),
  subtle: token("inkFaint"),
  line: token("line"),
  line2: token("line2"),
  brand: token("ink"),
  brandDeep: token("ink"),
  onBrand: token("onAccent"),
  gold: token("assetBonds"),
  profit: token("up"),
  loss: token("down"),
  equity: token("assetEquity"),
  bonds: token("assetBonds"),
  deposit: token("assetDeposit"),
  cash: token("assetCash"),
  crypto: token("assetCrypto"),
  spec: "transparent",
} as const;
```

Usuń w całości `export const v2Glass: CSSProperties = { … };` (linie 41–47).
Następnie w `V2Card` usuń gałąź `glass` — zostaje jedna powierzchnia bez cienia:

```tsx
export function V2Card({
  children,
  pad = 22,
  style,
}: {
  children: ReactNode;
  pad?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: V2.card,
        border: `1px solid ${V2.line}`,
        borderRadius: "var(--r-md)",
        padding: pad,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 5: Napraw wywołania `V2Card glass` i importy `v2Glass`**

Run: `grep -rn "glass\|v2Glass" app src --include=*.tsx`
Dla każdego trafienia usuń prop `glass` albo import. Powtarzaj, aż grep nic nie zwróci.

- [ ] **Step 6: Uruchom testy i typecheck**

Run: `npx vitest run tests/unit/design-tokens.test.ts && npm run typecheck && npm run build`
Expected: testy PASS, typecheck czysty, build się powiedzie

- [ ] **Step 7: Commit**

```bash
git add src/lib/design-tokens.ts src/lib/v2-design.tsx tests/unit/design-tokens.test.ts app src
git commit -m "feat(design): przepnij COLORS i V2 na tokeny, usun v2Glass"
```

---

### Task 4: Kroje przez next/font

**Files:**
- Modify: `app/layout.tsx`
- Modify: `src/lib/design-tokens.ts:58-63` (`TYPOGRAPHY`)
- Modify: `src/design/tokens.css`

**Interfaces:**
- Consumes: nic
- Produces: `--font-serif`, `--font-sans`, `--font-mono` jako właściwości CSS

**Kontekst:** `TYPOGRAPHY.serif` deklaruje dziś `'Newsreader'`, którego nikt nie ładuje —
każdy szeryf w aplikacji po cichu spada na Georgię. To zadanie to naprawia.

- [ ] **Step 1: Załaduj kroje w `app/layout.tsx`**

Dodaj na górze pliku, pod istniejącymi importami:

```tsx
import { Source_Serif_4, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";

const serif = Source_Serif_4({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600"],
  variable: "--font-serif",
  display: "swap",
});

const sans = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});
```

Następnie dodaj klasy zmiennych do `<html>`:

```tsx
<html lang="pl" data-theme="light" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
```

- [ ] **Step 2: Ustaw krój tekstu jako domyślny w `src/design/tokens.css`**

Dopisz w bloku `:root`, pod `--space-9`:

```css
  --font-display: var(--font-serif), Georgia, serif;
  --font-text: var(--font-sans), system-ui, sans-serif;
  --font-code: var(--font-mono), ui-monospace, Menlo, monospace;
```

I w `app/globals.css` w regule `body` dodaj `font-family: var(--font-text);`.

- [ ] **Step 3: Przepnij `TYPOGRAPHY` w `src/lib/design-tokens.ts`**

```ts
export const TYPOGRAPHY = {
  system: "var(--font-text)",
  serif: "var(--font-display)",
  mono: "var(--font-code)",
} as const;
```

- [ ] **Step 4: Zweryfikuj w przeglądarce, że kroje faktycznie się wczytały**

Uruchom serwer przez `preview_start` z konfiguracją `investor-web`, wejdź na `/demo`
i wykonaj w konsoli:

```js
document.fonts.ready.then(() => console.log([...new Set([...document.fonts].map(f => f.family))]))
```

Expected: lista zawiera `Source Serif 4`, `IBM Plex Sans`, `IBM Plex Mono`.
Jeśli zawiera tylko fallbacki — `subsets` albo `variable` są źle wpisane.

Sprawdź też diakrytyki: nagłówek „Dzień dobry, Inwestor" musi mieć poprawne `ń`.

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx app/globals.css src/design/tokens.css src/lib/design-tokens.ts
git commit -m "feat(design): zaladuj Source Serif 4, IBM Plex Sans i Mono przez next/font"
```

---

### Task 5: Testy blokujące

**Files:**
- Create: `tests/unit/no-hardcoded-values.test.ts`

**Interfaces:**
- Consumes: nic
- Produces: nic (bramka jakości)

**Zasada:** test startuje ograniczony do katalogów już zmigrowanych i zaciska się
z każdym kolejnym. Lista `MIGRATED` rośnie w kolejnych planach.

- [ ] **Step 1: Napisz test**

```ts
// tests/unit/no-hardcoded-values.test.ts
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Katalogi objęte bramką. Rośnie wraz z migracją. */
const MIGRATED = ["src/design", "src/lib"];

const ALLOWED = new Set(["src/design/tokens.ts", "src/design/tokens.css"]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx|css)$/.test(full) ? [full] : [];
  });
}

const files = MIGRATED.flatMap(walk).filter((f) => !ALLOWED.has(f));

describe("bramka wartosci zahardkodowanych", () => {
  it.each(files)("%s nie zawiera literalu hex", (file) => {
    const hits = readFileSync(file, "utf8").match(/#[0-9a-fA-F]{6}\b/g) ?? [];
    expect(hits, `znaleziono: ${hits.join(", ")}`).toHaveLength(0);
  });

  it.each(files)("%s nie zawiera promienia spoza tokenow", (file) => {
    const src = readFileSync(file, "utf8");
    const hits = [
      ...(src.match(/border-radius:\s*\d+px/g) ?? []),
      ...(src.match(/borderRadius:\s*["']?\d+/g) ?? []),
    ];
    expect(hits, `znaleziono: ${hits.join(", ")}`).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Uruchom test i zobacz, co jeszcze wycieka**

Run: `npx vitest run tests/unit/no-hardcoded-values.test.ts`
Expected: część przypadków FAIL — to jest lista do posprzątania, nie błąd testu.

- [ ] **Step 3: Napraw znalezione wycieki**

Test wypisuje przy każdej porażce konkretne znalezione wartości. Zamiana wygląda tak:

```ts
// przed
const style = { color: "#123B2B", borderRadius: 16 };
// po
import { token } from "@/design/tokens";
const style = { color: token("ink"), borderRadius: "var(--r-md)" };
```

W plikach CSS analogicznie: `color: #123B2B` → `color: var(--ink)`,
`border-radius: 16px` → `border-radius: var(--r-md)`.

Dobór tokenu: dopasuj po roli, nie po podobieństwie wartości — tło strony to `ground`,
tło panelu to `surface`, tekst to `ink`, etykieta to `inkMuted`, oś wykresu to `inkFaint`.
Powtarzaj Step 2 i 3, aż wszystko przechodzi.

- [ ] **Step 4: Potwierdź, że cały zestaw testów przechodzi**

Run: `npm run test`
Expected: wszystkie pliki PASS

- [ ] **Step 5: Commit**

```bash
git add tests/unit/no-hardcoded-values.test.ts src
git commit -m "test(design): bramka na literaly hex i promienie poza tokenami"
```

---

### Task 6: Usunięcie martwych warstw

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `package.json` (usunięcie `daisyui`)
- Modify: `src/lib/design-tokens.ts` (usunięcie `SHADOWS`)

**Interfaces:**
- Consumes: `--*` z Task 2
- Produces: Tailwind czytający ze zmiennych CSS

- [ ] **Step 1: Potwierdź, że martwe warstwy są naprawdę martwe**

Run: `grep -rn "daisy\|btn-primary\|SHADOWS\." app src --include=*.tsx --include=*.ts`
Expected: brak trafień na `SHADOWS.` i klasy daisyUI.
Jeśli są trafienia — usuń je najpierw, zanim ruszysz konfigurację.

- [ ] **Step 2: Przepisz `tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ground: "var(--ground)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        ink: "var(--ink)",
        "ink-muted": "var(--ink-muted)",
        "ink-faint": "var(--ink-faint)",
        accent: "var(--accent)",
        up: "var(--up)",
        down: "var(--down)",
      },
      borderRadius: {
        xs: "var(--r-xs)",
        sm: "var(--r-sm)",
        md: "var(--r-md)",
        lg: "var(--r-lg)",
        xl: "var(--r-xl)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-text)"],
        mono: ["var(--font-code)"],
      },
    },
  },
  plugins: [],
};

export default config;
```

Usuwasz: import i plugin `daisyui`, motyw `investor`, kolory `ink/paper/sand/amber/
amber-dark/profit/loss/bonds/equity/sys-blue`, wszystkie cztery `boxShadow`,
`borderRadius.glass` i `borderRadius.card`.

- [ ] **Step 3: Usuń `SHADOWS` z `src/lib/design-tokens.ts`**

Usuń w całości `export const SHADOWS = { … } as const;` (linie 65–71).

- [ ] **Step 4: Usuń zależność daisyUI**

```bash
npm uninstall daisyui
```

- [ ] **Step 5: Potwierdź, że wszystko się buduje i testy przechodzą**

Run: `npm run typecheck && npm run test && npm run build`
Expected: wszystko zielone

- [ ] **Step 6: Zweryfikuj wizualnie oba motywy**

Uruchom `preview_start` z `investor-web`, wejdź na `/demo`, zrób zrzut ekranu.
Następnie w konsoli `document.documentElement.dataset.theme = "dark"` i drugi zrzut.
Oba motywy muszą się renderować bez artefaktów; żaden element nie może zostać kremowy.

- [ ] **Step 7: Commit**

```bash
git add tailwind.config.ts src/lib/design-tokens.ts package.json package-lock.json
git commit -m "chore(design): usun daisyUI, martwe kolory Tailwinda i cienie"
```

---

## Czego ten plan świadomie NIE obejmuje

Zakres specyfikacji to materiał na trzy plany. Ten jest pierwszy i celowo kończy się
na warstwie wartości. Osobne plany:

**Plan 2 — prymitywy i trasa `/kit`.** Osiemnaście komponentów: dwanaście ze specyfikacji
plus sześć znalezionych w teście na dwusetnym ekranie (`Alert`, `Toggle`, `RadioGroup`,
`Tabs`, `Stepper`, `Disclosure`). Tam też `DataTable` unoszący kolumnę prozy oraz `Stat`
i `Figure` z niezmiennikiem glifu `▲`/`▼`.

**Plan 3 — migracja widoków i landing.** Przepisanie `landing.css` na tokeny, wycięcie sekcji
porównawczej z MyFund, ciemny pas na „polskich realiach", nowy domyślny preset dashboardu
oraz migracja 1015 wywołań `COLORS` i `V2` na bezpośrednie tokeny, feature po featurze,
z zaciskaniem listy `MIGRATED` w teście z Task 5.

**Poza planami, bo czeka na decyzje:** znak firmowy (źródło i wykonawca) oraz wybór trzech
najmocniejszych funkcji na landing.
