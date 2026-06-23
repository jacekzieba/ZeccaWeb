# Portfolio-view customization + value-vs-deposits horizon — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the dashboard's section-customization (toggle/reorder/resize KPIs & charts) to the portfolio detail page, collapse the customize panel's categories by default, and add a time-horizon selector to the "Wartość konta na tle wpłat" chart.

**Architecture:** Extract the dashboard's inline customization machinery into a reusable, theme-able module under `src/components/customize/` (pure config logic + hook, a collapsible panel, a responsive grid). Refactor the dashboard onto it (existing e2e tests guard behavior), then build the portfolio detail page on the same module with its own registry, blue theme, and a separate localStorage key. Add a self-contained period selector inside `ValueVsDepositsChart`.

**Tech Stack:** Next.js (App Router, client components), React, TypeScript, lucide-react icons, Zustand sync store, Playwright (e2e, fake-sync), Vitest (unit).

## Global Constraints

- Language of all UI copy: **Polish** (match existing strings exactly, e.g. "Dostosuj", "Układ sekcji", "Przywróć domyślne", "Pokaż sekcję …", "Przesuń … wyżej/niżej", "Szerokość sekcji …").
- Dashboard localStorage key stays exactly `zecca.dashboard.sections.v1`; portfolio detail uses `zecca.portfolio-detail.sections.v1`.
- Dashboard grid test ids stay exactly `dashboard-grid` and `dashboard-section-<id>`; KPI/section ids unchanged.
- No backend/snapshot/domain-model changes. Customization is per-browser localStorage UI preference.
- Customize panel categories are **collapsed by default** on every view.
- Value-vs-deposits chart default horizon = **MAX**; options `1M,3M,6M,1Y,2Y,MAX`.
- Preserve existing dashboard behavior: legacy array-only config and legacy sizes carrying a `height` must still normalize; `toggle` must never reach zero visible sections.
- Width preset label copy: `1 → "1 kolumna"`, `2/3/4 → "N kolumny"`, `≥5 → "N kolumn"`.
- Run `npm run lint` and `npx tsc --noEmit` clean before each commit that changes code.

---

### Task 1: Generic section-customization logic + hook

**Files:**
- Create: `src/components/customize/section-customization.ts`
- Test: `tests/unit/section-customization.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces:
  - Types `SectionSize = { width: 1 | 2 | 3 | 4 }`, `SectionCategory = { id: string; label: string; desc: string; icon: LucideIcon }`, `SectionDef<Id extends string> = { id: Id; label: string; desc: string; category: string; icon: LucideIcon; sizePresets: SectionSize[] }`, `SectionRegistry<Id extends string> = { storageKey: string; sections: SectionDef<Id>[]; categories: SectionCategory[]; categoryOrder: string[] }`, `SectionConfig<Id extends string> = { sectionOrder: Id[]; visibleSections: Id[]; sectionSizes: Partial<Record<Id, SectionSize>>; knownSections: Id[] }`.
  - `mixHex(hex: string, pct: number): string`
  - `defaultConfig<Id>(registry): SectionConfig<Id>`
  - `defaultSizes<Id>(registry): Record<Id, SectionSize>`
  - `readConfig<Id>(registry): SectionConfig<Id>`
  - `saveConfig<Id>(registry, config): void`
  - `useSectionCustomization<Id>(registry): { config: SectionConfig<Id>; toggle: (id: Id) => void; move: (id: Id, dir: -1 | 1) => void; resize: (id: Id, size: SectionSize) => void; reset: () => void }`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/section-customization.test.ts
import { describe, expect, it, beforeEach } from "vitest";
import { LayoutDashboard } from "lucide-react";
import {
  defaultConfig,
  readConfig,
  saveConfig,
  mixHex,
  type SectionRegistry,
} from "@/components/customize/section-customization";

type Id = "a" | "b" | "c";

const registry: SectionRegistry<Id> = {
  storageKey: "test.sections.v1",
  categoryOrder: ["g1", "g2"],
  categories: [
    { id: "g1", label: "G1", desc: "", icon: LayoutDashboard },
    { id: "g2", label: "G2", desc: "", icon: LayoutDashboard },
  ],
  sections: [
    { id: "a", label: "A", desc: "", category: "g1", icon: LayoutDashboard, sizePresets: [{ width: 1 }, { width: 2 }] },
    { id: "b", label: "B", desc: "", category: "g1", icon: LayoutDashboard, sizePresets: [{ width: 4 }, { width: 2 }] },
    { id: "c", label: "C", desc: "", category: "g2", icon: LayoutDashboard, sizePresets: [{ width: 3 }] },
  ],
};

beforeEach(() => window.localStorage.clear());

describe("section-customization", () => {
  it("defaultConfig exposes every section, ordered, with first-preset sizes", () => {
    const cfg = defaultConfig(registry);
    expect(cfg.sectionOrder).toEqual(["a", "b", "c"]);
    expect(cfg.visibleSections).toEqual(["a", "b", "c"]);
    expect(cfg.sectionSizes).toEqual({ a: { width: 1 }, b: { width: 4 }, c: { width: 3 } });
    expect(cfg.knownSections).toEqual(["a", "b", "c"]);
  });

  it("readConfig returns defaults when storage is empty", () => {
    expect(readConfig(registry)).toEqual(defaultConfig(registry));
  });

  it("readConfig drops unknown ids and back-fills missing ones in order", () => {
    window.localStorage.setItem(registry.storageKey, JSON.stringify({
      sectionOrder: ["c", "zzz", "a"],
      visibleSections: ["c", "a"],
      sectionSizes: {},
      knownSections: ["a", "b", "c"],
    }));
    const cfg = readConfig(registry);
    expect(cfg.sectionOrder).toEqual(["c", "a", "b"]);
    expect(cfg.visibleSections).toEqual(["c", "a"]);
  });

  it("readConfig coerces an out-of-preset size to the section default", () => {
    window.localStorage.setItem(registry.storageKey, JSON.stringify({
      sectionOrder: ["a", "b", "c"],
      visibleSections: ["a", "b", "c"],
      sectionSizes: { a: { width: 4, height: 3 }, b: { width: 2 } },
      knownSections: ["a", "b", "c"],
    }));
    const cfg = readConfig(registry);
    expect(cfg.sectionSizes.a).toEqual({ width: 1 }); // 4 not a preset for "a" -> default; height stripped
    expect(cfg.sectionSizes.b).toEqual({ width: 2 }); // 2 is a valid preset for "b"
  });

  it("readConfig accepts the legacy array-only shape as visibleSections", () => {
    window.localStorage.setItem(registry.storageKey, JSON.stringify(["a", "b"]));
    const cfg = readConfig(registry);
    expect(cfg.visibleSections).toEqual(["a", "b"]);
    expect(cfg.sectionOrder).toEqual(["a", "b", "c"]);
  });

  it("readConfig surfaces sections shipped after the saved config exactly once", () => {
    window.localStorage.setItem(registry.storageKey, JSON.stringify({
      sectionOrder: ["a", "b"],
      visibleSections: ["a"],
      sectionSizes: {},
      knownSections: ["a", "b"], // "c" shipped later
    }));
    const cfg = readConfig(registry);
    expect(cfg.visibleSections).toContain("c");
  });

  it("saveConfig round-trips through readConfig", () => {
    const cfg = { ...defaultConfig(registry), visibleSections: ["a", "c"] as Id[] };
    saveConfig(registry, cfg);
    expect(readConfig(registry).visibleSections).toEqual(["a", "c"]);
  });

  it("mixHex turns a hex + alpha into rgba", () => {
    expect(mixHex("#161D18", 0.05)).toBe("rgba(22,29,24,0.05)");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/section-customization.test.ts`
Expected: FAIL — module `@/components/customize/section-customization` not found.

- [ ] **Step 3: Implement the module**

```ts
// src/components/customize/section-customization.ts
"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";

export type SectionSize = { width: 1 | 2 | 3 | 4 };
export type SectionCategory = { id: string; label: string; desc: string; icon: LucideIcon };
export type SectionDef<Id extends string> = {
  id: Id;
  label: string;
  desc: string;
  category: string;
  icon: LucideIcon;
  sizePresets: SectionSize[];
};
export type SectionRegistry<Id extends string> = {
  storageKey: string;
  sections: SectionDef<Id>[];
  categories: SectionCategory[];
  categoryOrder: string[];
};
export type SectionConfig<Id extends string> = {
  sectionOrder: Id[];
  visibleSections: Id[];
  sectionSizes: Partial<Record<Id, SectionSize>>;
  knownSections: Id[];
};

export function mixHex(hex: string, pct: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${pct})`;
}

function allIds<Id extends string>(registry: SectionRegistry<Id>): Id[] {
  return registry.sections.map((section) => section.id);
}

export function defaultSizes<Id extends string>(registry: SectionRegistry<Id>): Record<Id, SectionSize> {
  return Object.fromEntries(
    registry.sections.map((section) => [section.id, section.sizePresets[0]]),
  ) as Record<Id, SectionSize>;
}

export function defaultConfig<Id extends string>(registry: SectionRegistry<Id>): SectionConfig<Id> {
  const ids = allIds(registry);
  return {
    sectionOrder: [...ids],
    visibleSections: [...ids],
    sectionSizes: defaultSizes(registry),
    knownSections: [...ids],
  };
}

function sanitizeOrder<Id extends string>(registry: SectionRegistry<Id>, value: unknown): Id[] {
  const ids = allIds(registry);
  const allowed = new Set<string>(ids);
  const source = Array.isArray(value) ? value : ids;
  const order = source.filter((item): item is Id => typeof item === "string" && allowed.has(item));
  const missing = ids.filter((id) => !order.includes(id));
  return [...order, ...missing];
}

function sanitizeVisible<Id extends string>(registry: SectionRegistry<Id>, value: unknown): Id[] {
  const ids = allIds(registry);
  const allowed = new Set<string>(ids);
  const visible = Array.isArray(value)
    ? value.filter((item): item is Id => typeof item === "string" && allowed.has(item))
    : ids;
  return visible.length > 0 ? visible : [...ids];
}

function sanitizeSizes<Id extends string>(
  registry: SectionRegistry<Id>,
  value: unknown,
): Record<Id, SectionSize> {
  const fallback = defaultSizes(registry);
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const result = {} as Record<Id, SectionSize>;
  for (const section of registry.sections) {
    const raw = (value as Record<string, unknown>)[section.id];
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const width = (raw as Record<string, unknown>).width;
      const match = section.sizePresets.find((preset) => preset.width === width);
      result[section.id] = match ?? fallback[section.id];
    } else {
      result[section.id] = fallback[section.id];
    }
  }
  return result;
}

export function readConfig<Id extends string>(registry: SectionRegistry<Id>): SectionConfig<Id> {
  if (typeof window === "undefined") return defaultConfig(registry);
  try {
    const raw = window.localStorage.getItem(registry.storageKey);
    if (!raw) return defaultConfig(registry);
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return { ...defaultConfig(registry), visibleSections: sanitizeVisible(registry, parsed) };
    }
    if (!parsed || typeof parsed !== "object") return defaultConfig(registry);
    const config = parsed as Record<string, unknown>;
    const ids = allIds(registry);
    const sectionOrder = sanitizeOrder(registry, config.sectionOrder);
    const visible = sanitizeVisible(registry, config.visibleSections);
    const isKnownId = (id: unknown): id is Id => typeof id === "string" && (ids as string[]).includes(id);
    const known = (
      Array.isArray(config.knownSections)
        ? config.knownSections
        : Array.isArray(config.sectionOrder)
          ? config.sectionOrder
          : []
    ).filter(isKnownId);
    const newlyShipped = ids.filter((id) => !known.includes(id) && !visible.includes(id));
    return {
      sectionOrder,
      visibleSections: [...visible, ...newlyShipped],
      sectionSizes: sanitizeSizes(registry, config.sectionSizes),
      knownSections: [...ids],
    };
  } catch {
    return defaultConfig(registry);
  }
}

export function saveConfig<Id extends string>(registry: SectionRegistry<Id>, config: SectionConfig<Id>) {
  try {
    window.localStorage.setItem(
      registry.storageKey,
      JSON.stringify({
        sectionOrder: sanitizeOrder(registry, config.sectionOrder),
        visibleSections: sanitizeVisible(registry, config.visibleSections),
        sectionSizes: sanitizeSizes(registry, config.sectionSizes),
        knownSections: allIds(registry),
      }),
    );
  } catch {
    // Local UI preference only; ignore storage failures.
  }
}

export function useSectionCustomization<Id extends string>(registry: SectionRegistry<Id>) {
  const [config, setConfig] = useState<SectionConfig<Id>>(() => readConfig(registry));

  useEffect(() => {
    saveConfig(registry, config);
  }, [config, registry]);

  const toggle = (id: Id) =>
    setConfig((current) => {
      const visible = new Set(current.visibleSections);
      if (visible.has(id)) visible.delete(id);
      else visible.add(id);
      if (visible.size === 0) return current;
      return { ...current, visibleSections: current.sectionOrder.filter((s) => visible.has(s)) };
    });

  const move = (id: Id, dir: -1 | 1) =>
    setConfig((current) => {
      const order = [...current.sectionOrder];
      const index = order.indexOf(id);
      const nextIndex = index + dir;
      if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return current;
      [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
      return { ...current, sectionOrder: order };
    });

  const resize = (id: Id, size: SectionSize) =>
    setConfig((current) => ({ ...current, sectionSizes: { ...current.sectionSizes, [id]: size } }));

  const reset = () => setConfig(defaultConfig(registry));

  return { config, toggle, move, resize, reset };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/section-customization.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/customize/section-customization.ts tests/unit/section-customization.test.ts
git commit -m "Add generic section-customization logic + hook"
```

---

### Task 2: Theme-able SectionCustomizePanel (collapsed by default)

**Files:**
- Create: `src/components/customize/section-customize-panel.tsx`

**Interfaces:**
- Consumes from Task 1: `SectionRegistry`, `SectionConfig`, `SectionSize`, `mixHex`.
- Produces:
  - `SectionPanelTheme = { card: string; ink: string; brand: string; muted: string; subtle: string; line: string; fontUi: string; fontSerif: string; fontMono: string }` (`card`/`ink`/`brand` must be `#rrggbb` — they are fed to `mixHex`).
  - `SectionCustomizePanel<Id>` component with props `{ registry: SectionRegistry<Id>; config: SectionConfig<Id>; visibleSections: Set<Id>; onToggle: (id: Id) => void; onMove: (id: Id, dir: -1 | 1) => void; onResize: (id: Id, size: SectionSize) => void; onReset: () => void; theme: SectionPanelTheme; eyebrow: string; title: string; subtitle: string }`.

**Note:** This is a near-verbatim port of `DashboardCustomizePanel` (`src/features/dashboard/dashboard-overview.tsx:1348-1601`) with three changes: (a) palette/fonts come from `theme` instead of module-scoped `PALETTE`/`UI`/`MONO`/`SERIF`, replacing `mix(PALETTE.x, p)` with `mixHex(theme.x, p)`; (b) categories/sections/sizes come from `registry`; (c) `expandedCategories` initial state is all-`false`.

- [ ] **Step 1: Implement the panel**

```tsx
// src/components/customize/section-customize-panel.tsx
"use client";

import { useId, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import {
  mixHex,
  type SectionConfig,
  type SectionRegistry,
  type SectionSize,
} from "@/components/customize/section-customization";

export type SectionPanelTheme = {
  card: string;   // #rrggbb
  ink: string;    // #rrggbb
  brand: string;  // #rrggbb
  muted: string;
  subtle: string;
  line: string;
  fontUi: string;
  fontSerif: string;
  fontMono: string;
};

function widthLabel(width: number) {
  if (width === 1) return "1 kolumna";
  if (width < 5) return `${width} kolumny`;
  return `${width} kolumn`;
}

function smallControlStyle(disabled: boolean, theme: SectionPanelTheme) {
  return {
    border: `0.5px solid ${theme.line}`,
    borderRadius: 8,
    background: theme.card,
    color: disabled ? mixHex(theme.ink, 0.25) : theme.ink,
    cursor: disabled ? "not-allowed" : "pointer",
    padding: "5px 7px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  } as const;
}

export function SectionCustomizePanel<Id extends string>({
  registry,
  config,
  visibleSections,
  onToggle,
  onMove,
  onResize,
  onReset,
  theme,
  eyebrow,
  title,
  subtitle,
}: {
  registry: SectionRegistry<Id>;
  config: SectionConfig<Id>;
  visibleSections: Set<Id>;
  onToggle: (id: Id) => void;
  onMove: (id: Id, dir: -1 | 1) => void;
  onResize: (id: Id, size: SectionSize) => void;
  onReset: () => void;
  theme: SectionPanelTheme;
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  const categoryPanelId = useId();
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const sectionById = Object.fromEntries(registry.sections.map((s) => [s.id, s])) as Record<Id, (typeof registry.sections)[number]>;
  const categoryById = Object.fromEntries(registry.categories.map((c) => [c.id, c]));
  const grouped = registry.categoryOrder
    .map((categoryId) => ({
      categoryId,
      sections: config.sectionOrder.filter((id) => sectionById[id]?.category === categoryId),
    }))
    .filter((group) => group.sections.length > 0);
  const toggleCategory = (categoryId: string) =>
    setExpandedCategories((current) => ({ ...current, [categoryId]: !current[categoryId] }));

  return (
    <div
      style={{
        background: theme.card,
        border: `0.5px solid ${theme.line}`,
        borderRadius: 16,
        padding: 22,
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: theme.fontUi, fontSize: 10.5, fontWeight: 700, letterSpacing: ".13em", textTransform: "uppercase", color: theme.subtle }}>
            {eyebrow}
          </div>
          <div style={{ fontFamily: theme.fontSerif, fontSize: 19, fontWeight: 500, color: theme.ink, marginTop: 3 }}>{title}</div>
          <div style={{ fontFamily: theme.fontUi, fontSize: 12, color: theme.muted, marginTop: 3 }}>{subtitle}</div>
        </div>
        <button
          type="button"
          onClick={onReset}
          style={{
            border: `0.5px solid ${theme.line}`,
            borderRadius: 9,
            background: theme.card,
            color: theme.ink,
            cursor: "pointer",
            fontFamily: theme.fontUi,
            fontSize: 12,
            fontWeight: 700,
            padding: "7px 11px",
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
          Przywróć domyślne
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {grouped.map(({ categoryId, sections }) => {
          const category = categoryById[categoryId];
          const CategoryIcon = category.icon;
          const expanded = expandedCategories[categoryId] ?? false;
          const visibleCount = sections.filter((id) => visibleSections.has(id)).length;
          const panelId = `${categoryPanelId}-${categoryId}`;
          return (
            <div key={categoryId} style={{ border: `0.5px solid ${theme.line}`, borderRadius: 12, background: mixHex(theme.ink, 0.014), overflow: "hidden" }}>
              <button
                type="button"
                onClick={() => toggleCategory(categoryId)}
                aria-expanded={expanded}
                aria-controls={panelId}
                style={{
                  width: "100%",
                  border: 0,
                  background: expanded ? mixHex(theme.brand, 0.06) : "transparent",
                  color: theme.ink,
                  cursor: "pointer",
                  padding: "11px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  textAlign: "left",
                }}
              >
                <span style={{ width: 28, height: 28, borderRadius: 8, background: mixHex(theme.brand, 0.11), color: theme.brand, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                  <CategoryIcon size={15.5} strokeWidth={2} aria-hidden="true" />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontFamily: theme.fontUi, fontSize: 13, fontWeight: 800, color: theme.ink }}>{category.label}</span>
                  <span style={{ display: "block", fontFamily: theme.fontUi, fontSize: 11.5, color: theme.muted, marginTop: 2, lineHeight: 1.35 }}>{category.desc}</span>
                </span>
                <span style={{ fontFamily: theme.fontMono, fontSize: 11, fontWeight: 700, color: theme.muted, background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: 999, padding: "3px 7px", whiteSpace: "nowrap" }}>
                  {visibleCount}/{sections.length}
                </span>
                {expanded ? <ChevronUp size={16} strokeWidth={2} aria-hidden="true" /> : <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />}
              </button>
              {expanded && (
                <div id={panelId} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 10px 10px" }}>
                  {sections.map((sectionId) => {
                    const section = sectionById[sectionId];
                    if (!section) return null;
                    const checked = visibleSections.has(sectionId);
                    const currentSize = config.sectionSizes[sectionId] ?? section.sizePresets[0];
                    const sectionIndex = config.sectionOrder.indexOf(sectionId);
                    const SectionIcon = section.icon;
                    return (
                      <div key={sectionId} style={{ border: `0.5px solid ${checked ? mixHex(theme.brand, 0.42) : theme.line}`, borderRadius: 11, background: checked ? mixHex(theme.brand, 0.055) : theme.card, padding: "11px 12px" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                          <input type="checkbox" checked={checked} onChange={() => onToggle(sectionId)} aria-label={`Pokaż sekcję ${section.label}`} style={{ marginTop: 6 }} />
                          <span style={{ width: 26, height: 26, borderRadius: 8, background: checked ? mixHex(theme.brand, 0.12) : mixHex(theme.ink, 0.045), color: checked ? theme.brand : theme.muted, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                            <SectionIcon size={14.5} strokeWidth={2} aria-hidden="true" />
                          </span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
                              <div>
                                <div style={{ fontFamily: theme.fontUi, fontSize: 13, fontWeight: 700, color: theme.ink }}>{section.label}</div>
                                <div style={{ fontFamily: theme.fontUi, fontSize: 11.5, color: theme.muted, marginTop: 2, lineHeight: 1.35 }}>{section.desc}</div>
                              </div>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button type="button" onClick={() => onMove(sectionId, -1)} disabled={sectionIndex === 0} aria-label={`Przesuń ${section.label} wyżej`} style={smallControlStyle(sectionIndex === 0, theme)}>
                                  <ArrowUp size={14} strokeWidth={2.1} aria-hidden="true" />
                                </button>
                                <button type="button" onClick={() => onMove(sectionId, 1)} disabled={sectionIndex === config.sectionOrder.length - 1} aria-label={`Przesuń ${section.label} niżej`} style={smallControlStyle(sectionIndex === config.sectionOrder.length - 1, theme)}>
                                  <ArrowDown size={14} strokeWidth={2.1} aria-hidden="true" />
                                </button>
                              </div>
                            </div>
                            <div role="radiogroup" aria-label={`Szerokość sekcji ${section.label}`} style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                              {section.sizePresets.map((preset) => {
                                const selected = currentSize.width === preset.width;
                                return (
                                  <button
                                    key={preset.width}
                                    type="button"
                                    role="radio"
                                    aria-checked={selected}
                                    onClick={() => onResize(sectionId, preset)}
                                    style={{ border: `0.5px solid ${selected ? mixHex(theme.brand, 0.48) : theme.line}`, borderRadius: 8, background: selected ? mixHex(theme.brand, 0.1) : theme.card, color: selected ? theme.brand : theme.muted, cursor: "pointer", fontFamily: theme.fontMono, fontSize: 11, fontWeight: 700, padding: "5px 8px" }}
                                  >
                                    {widthLabel(preset.width)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/customize/section-customize-panel.tsx
git commit -m "Add theme-able SectionCustomizePanel, categories collapsed by default"
```

---

### Task 3: Responsive SectionGrid

**Files:**
- Create: `src/components/customize/section-grid.tsx`

**Interfaces:**
- Consumes from Task 1: `SectionSize`.
- Produces: `SectionGrid<Id>` component with props `{ orderedVisibleSections: Id[]; sizeOf: (id: Id) => SectionSize; renderSection: (id: Id) => React.ReactNode; isMobile: boolean; isTablet: boolean; testIdPrefix: string; gap?: number }`.

- [ ] **Step 1: Implement the grid**

```tsx
// src/components/customize/section-grid.tsx
"use client";

import type { ReactNode } from "react";
import type { SectionSize } from "@/components/customize/section-customization";

export function SectionGrid<Id extends string>({
  orderedVisibleSections,
  sizeOf,
  renderSection,
  isMobile,
  isTablet,
  testIdPrefix,
  gap = 14,
}: {
  orderedVisibleSections: Id[];
  sizeOf: (id: Id) => SectionSize;
  renderSection: (id: Id) => ReactNode;
  isMobile: boolean;
  isTablet: boolean;
  testIdPrefix: string;
  gap?: number;
}) {
  const single = isMobile || isTablet;
  return (
    <div
      data-testid={`${testIdPrefix}-grid`}
      style={{
        display: "grid",
        gridTemplateColumns: single ? "1fr" : "repeat(4, minmax(0, 1fr))",
        gridAutoRows: "auto",
        gap,
        alignItems: "stretch",
      }}
    >
      {orderedVisibleSections.map((id) => {
        const size = sizeOf(id);
        return (
          <div
            key={id}
            data-testid={`${testIdPrefix}-section-${id}`}
            style={{
              gridColumn: single ? "1 / -1" : `span ${size.width}`,
              height: single ? "auto" : "100%",
              minHeight: 0,
              minWidth: 0,
            }}
          >
            {renderSection(id)}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/customize/section-grid.tsx
git commit -m "Add responsive SectionGrid wrapper"
```

---

### Task 4: Refactor the dashboard onto the shared module

**Files:**
- Modify: `src/features/dashboard/dashboard-overview.tsx`

**Interfaces:**
- Consumes from Tasks 1-3: `SectionRegistry`, `useSectionCustomization`, `SectionCustomizePanel`, `SectionPanelTheme`, `SectionGrid`, `SectionSize`.
- Produces: no new exports. `DashboardSectionId` type derives from the registry.

This task is a structural swap. After it, the dashboard must behave identically (the existing e2e suite is the contract). Keep the section render functions (`SummaryCard`, `KpiCard`, `ValueVsDepositsCard`, `HoldingsCard`, `AllocationCard`, `MonthlyCard`, `TransactionsCard`, `PortfoliosCard`) and all section ids/labels/descs/categories/size-presets exactly as today.

- [ ] **Step 1: Build the dashboard registry + theme**

Replace the inline section constants (`DASHBOARD_SECTION_OPTIONS`, `DASHBOARD_SECTION_CATEGORIES`, `DASHBOARD_SECTION_CATEGORY_ORDER`, `DASHBOARD_SECTION_ICONS`, `DASHBOARD_SECTION_SIZE_PRESETS`, the `DashboardSectionSize`/`DashboardCustomizationConfig` types, and all `sanitize*`/`readDashboardConfig`/`saveDashboardConfig` functions) with a single registry built from the same data:

```tsx
import {
  useSectionCustomization,
  type SectionDef,
  type SectionRegistry,
  type SectionSize,
} from "@/components/customize/section-customization";
import { SectionCustomizePanel, type SectionPanelTheme } from "@/components/customize/section-customize-panel";
import { SectionGrid } from "@/components/customize/section-grid";

// ...existing icon imports stay...

const KPI_SIZE_PRESETS: SectionSize[] = [{ width: 1 }, { width: 2 }];

const DASHBOARD_SECTIONS: SectionDef<string>[] = [
  { id: "summary", label: "Wartość i historia", desc: "Główna wartość portfela, wynik i wykres historii.", category: "overview", icon: LayoutDashboard, sizePresets: [{ width: 4 }] },
  ...KPI_TILE_META.map((tile) => ({
    id: tile.id,
    label: tile.label,
    desc: tile.desc,
    category: "metrics",
    icon: DASHBOARD_KPI_ICONS[tile.id],
    sizePresets: KPI_SIZE_PRESETS,
  })),
  { id: "valueVsDeposits", label: "Wartość vs wpłaty", desc: "Wartość konta na tle skumulowanych wpłat.", category: "charts", icon: ChartNoAxesCombined, sizePresets: [{ width: 4 }, { width: 2 }] },
  { id: "holdings", label: "Instrumenty", desc: "Największe aktywne pozycje.", category: "data", icon: Wallet, sizePresets: [{ width: 3 }, { width: 4 }] },
  { id: "allocation", label: "Alokacja", desc: "Podział klas aktywów.", category: "charts", icon: ChartPie, sizePresets: [{ width: 1 }, { width: 2 }] },
  { id: "monthly", label: "Miesięczny P&L", desc: "Miesięczne zmiany wartości.", category: "charts", icon: ChartColumn, sizePresets: [{ width: 1 }, { width: 2 }] },
  { id: "transactions", label: "Ostatnie transakcje", desc: "Najnowsza aktywność konta.", category: "data", icon: ClipboardList, sizePresets: [{ width: 2 }, { width: 3 }, { width: 4 }] },
  { id: "portfolios", label: "Portfele i cashflow", desc: "Podział kont, dywidendy, odsetki i prowizje.", category: "data", icon: Banknote, sizePresets: [{ width: 2 }, { width: 3 }, { width: 4 }] },
];

// KPI icon map (was DASHBOARD_SECTION_ICONS, kpi entries only)
const DASHBOARD_KPI_ICONS: Record<string, typeof ChartLine> = {
  kpiUnrealized: ChartLine,
  kpiXirr: BadgePercent,
  kpiTwr: CircleGauge,
  kpiCagr: ChartNoAxesCombined,
  kpiRealReturn: CircleDollarSign,
  kpiMaxDd: ChartNoAxesColumnDecreasing,
  kpiRealized: BadgeDollarSign,
  kpiInvested: Landmark,
  kpiDividends: Coins,
  kpiOpenPositions: BriefcaseBusiness,
};

const DASHBOARD_REGISTRY: SectionRegistry<string> = {
  storageKey: "zecca.dashboard.sections.v1",
  categoryOrder: ["overview", "metrics", "charts", "data"],
  categories: [
    { id: "overview", label: "Przegląd", desc: "Główna karta dashboardu.", icon: LayoutDashboard },
    { id: "metrics", label: "Wskaźniki", desc: "KPI portfela i zwrotu.", icon: CircleGauge },
    { id: "charts", label: "Wykresy", desc: "Wizualizacje wartości i alokacji.", icon: ChartArea },
    { id: "data", label: "Dane", desc: "Listy, transakcje i portfele.", icon: ClipboardList },
  ],
  sections: DASHBOARD_SECTIONS,
};
type DashboardSectionId = string;

const KPI_SECTION_IDS = new Set<string>(KPI_TILE_META.map((tile) => tile.id));

const DASHBOARD_THEME: SectionPanelTheme = {
  card: PALETTE.card,
  ink: PALETTE.ink,
  brand: PALETTE.brand,
  muted: PALETTE.muted,
  subtle: PALETTE.subtle,
  line: PALETTE.line,
  fontUi: UI,
  fontSerif: SERIF,
  fontMono: MONO,
};
```

(Note: `PALETTE.card`/`ink`/`brand` are hex literals `#F7F8F4`/`#161D18`/`#214A35`, so they satisfy `mixHex`.)

- [ ] **Step 2: Swap the component body**

In `DashboardOverview`, replace the config state + handlers + panel + grid:

```tsx
const { config: dashboardConfig, toggle, move, resize, reset } = useSectionCustomization(DASHBOARD_REGISTRY);
// delete: useState(readDashboardConfig), the saveDashboardConfig effect, toggleSection/moveSection/resizeSection/resetSections, sectionSize
const visibleSections = new Set(dashboardConfig.visibleSections);
const orderedVisibleSections = dashboardConfig.sectionOrder.filter((s) => visibleSections.has(s));
const sectionSize = (id: DashboardSectionId) =>
  dashboardConfig.sectionSizes[id] ?? DASHBOARD_REGISTRY.sections.find((s) => s.id === id)!.sizePresets[0];
```

Replace the `{showCustomize && <DashboardCustomizePanel .../>}` block with:

```tsx
{showCustomize && (
  <SectionCustomizePanel
    registry={DASHBOARD_REGISTRY}
    config={dashboardConfig}
    visibleSections={visibleSections}
    onToggle={toggle}
    onMove={move}
    onResize={resize}
    onReset={reset}
    theme={DASHBOARD_THEME}
    eyebrow="Dashboard"
    title="Układ sekcji"
    subtitle="Web zapisuje widoczność, kolejność i preset rozmiaru w tej przeglądarce."
  />
)}
```

Replace the inline `<div data-testid="dashboard-grid">…</div>` with:

```tsx
<SectionGrid
  orderedVisibleSections={orderedVisibleSections}
  sizeOf={sectionSize}
  renderSection={renderSection}
  isMobile={isMobile}
  isTablet={isTablet}
  testIdPrefix="dashboard"
/>
```

Delete the now-unused `DashboardCustomizePanel` function and `smallControlStyle` helper (moved into the panel module).

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean (resolve any leftover unused imports).

- [ ] **Step 4: Update the dashboard e2e for collapse-by-default**

In `tests/e2e/fake-sync/dashboard-customize.spec.ts`, before interacting with controls that now live inside collapsed categories, expand the owning category. Add this helper and the expand calls:

```ts
const expandCategory = (page: Page, name: string) =>
  page.getByRole("main").getByRole("button", { name: new RegExp(`^${name}`) }).click();
```

- Test 1 ("stores section visibility and width…"): after `await expect(main.getByText("Układ sekcji")).toBeVisible();` add `await expandCategory(page, "Dane");` (Instrumenty/holdings + transactions live in **Dane**). Then proceed with the existing "Przesuń Instrumenty wyżej" / width / uncheck steps.
- Test 3 ("width preset changes the column span…"): after opening Dostosuj, add `await expandCategory(page, "Dane");` before clicking the "Szerokość sekcji Ostatnie transakcje" radiogroup.
- Tests 2, 4, 5 don't open the panel (or only assert storage normalization) — no change needed, except confirm test 5's reload still surfaces sections (it asserts storage, not panel controls).

(The category header buttons render as e.g. "Dane Listy, transakcje i portfele." — the `^Dane` regex matches the accessible name prefix.)

- [ ] **Step 5: Run the dashboard e2e**

Run: `npx playwright test --config playwright.fake-sync.config.ts dashboard-customize`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/features/dashboard/dashboard-overview.tsx tests/e2e/fake-sync/dashboard-customize.spec.ts
git commit -m "Refactor dashboard onto shared customization module"
```

---

### Task 5: Time-horizon selector in ValueVsDepositsChart

**Files:**
- Modify: `src/components/charts/value-vs-deposits-chart.tsx`
- Test: `tests/e2e/fake-sync/value-vs-deposits-horizon.spec.ts`

**Interfaces:**
- Consumes: `ValuationPoint` (existing).
- Produces: `ValueVsDepositsChart` gains an optional prop `showPeriodControl?: boolean` (default `true`) and an internal default horizon of `MAX`.

- [ ] **Step 1: Write the failing e2e test**

```ts
// tests/e2e/fake-sync/value-vs-deposits-horizon.spec.ts
import { expect, test } from "@playwright/test";

test("value-vs-deposits chart exposes a horizon selector defaulting to MAX", async ({ page }) => {
  await page.goto("/dashboard");
  const main = page.getByRole("main");
  await expect(main.getByText(/pozycji w portfelu/)).toBeVisible();

  // The value-vs-deposits section carries its own period radiogroup.
  const section = page.getByTestId("dashboard-section-valueVsDeposits");
  const horizon = section.getByRole("radiogroup", { name: "Zakres wykresu wartość vs wpłaty" });
  await expect(horizon).toBeVisible();
  await expect(horizon.getByRole("radio", { name: "MAX" })).toHaveAttribute("aria-checked", "true");

  await horizon.getByRole("radio", { name: "3M" }).click();
  await expect(horizon.getByRole("radio", { name: "3M" })).toHaveAttribute("aria-checked", "true");
  await expect(horizon.getByRole("radio", { name: "MAX" })).toHaveAttribute("aria-checked", "false");
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `npx playwright test --config playwright.fake-sync.config.ts value-vs-deposits-horizon`
Expected: FAIL — no radiogroup found.

- [ ] **Step 3: Implement the selector + filtering**

At the top of `value-vs-deposits-chart.tsx`, add the period machinery and a filter that crops both series by the same date cutoff:

```tsx
import { useEffect, useRef, useState } from "react";

const PERIOD_OPTIONS = ["1M", "3M", "6M", "1Y", "2Y", "MAX"] as const;
type Period = (typeof PERIOD_OPTIONS)[number];
const PERIOD_MONTHS: Record<Period, number> = { "1M": 1, "3M": 3, "6M": 6, "1Y": 12, "2Y": 24, MAX: 0 };

// Crops to the selected horizon using the latest date across both series as the
// anchor, so value[i] and deposits[i] stay index-aligned after filtering.
function cropByPeriod(value: ValuationPoint[], deposits: ValuationPoint[], period: Period) {
  if (period === "MAX") return { value, deposits };
  const lastDate = [value.at(-1)?.date, deposits.at(-1)?.date].filter(Boolean).sort().at(-1);
  if (!lastDate) return { value, deposits };
  const cutoff = new Date(lastDate);
  cutoff.setMonth(cutoff.getMonth() - PERIOD_MONTHS[period]);
  const crop = (series: ValuationPoint[]) => {
    if (series.length <= 2) return series;
    const filtered = series.filter((p) => new Date(p.date).getTime() >= cutoff.getTime());
    return filtered.length >= 2 ? filtered : series.slice(-2);
  };
  return { value: crop(value), deposits: crop(deposits) };
}
```

Inside the component, add state and apply the crop before the existing `n`/`valueVals`/`depositVals` derivation:

```tsx
export function ValueVsDepositsChart({
  value: valueProp,
  deposits: depositsProp,
  height = 220,
  currency = "PLN",
  showPeriodControl = true,
}: {
  value: ValuationPoint[];
  deposits: ValuationPoint[];
  height?: number;
  currency?: string;
  showPeriodControl?: boolean;
}) {
  const [period, setPeriod] = useState<Period>("MAX");
  const { value, deposits } = cropByPeriod(valueProp, depositsProp, period);
  // ...existing refs/state unchanged; everything below keeps using `value`/`deposits`...
```

Render the selector inside the header row that holds the legend (replace the legend `<div>` opener):

```tsx
<div style={{ display: "flex", gap: 16, marginBottom: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
    <Legend color={VALUE_COLOR} label="Wartość konta" />
    <Legend color={DEPOSIT_COLOR} label="Wpłaty (skumulowane)" dashed />
  </div>
  {showPeriodControl && (
    <div role="radiogroup" aria-label="Zakres wykresu wartość vs wpłaty" style={{ display: "inline-flex", background: "rgba(22,29,24,0.06)", borderRadius: 10, padding: 3 }}>
      {PERIOD_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={period === option}
          onClick={() => setPeriod(option)}
          style={{
            padding: "4px 9px",
            borderRadius: 7,
            border: "none",
            cursor: "pointer",
            fontFamily: TYPOGRAPHY.system,
            fontSize: 11,
            fontWeight: period === option ? 700 : 500,
            background: period === option ? COLORS.surface : "transparent",
            color: period === option ? COLORS.text : COLORS.muted,
          }}
        >
          {option}
        </button>
      ))}
    </div>
  )}
</div>
```

Keep the early `if (n < 2) return null;` guard — but move it below the crop so it sees cropped data. Note the existing `value.indexOf(d)` x-label lookup keeps working because labels are derived from the same cropped `value` array.

- [ ] **Step 4: Run the e2e to verify pass**

Run: `npx playwright test --config playwright.fake-sync.config.ts value-vs-deposits-horizon`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/charts/value-vs-deposits-chart.tsx tests/e2e/fake-sync/value-vs-deposits-horizon.spec.ts
git commit -m "Add time-horizon selector to value-vs-deposits chart"
```

---

### Task 6: Portfolio detail customization (full parity)

**Files:**
- Modify: `src/features/portfolios/portfolio-detail-page.tsx`
- Test: `tests/e2e/fake-sync/portfolio-detail-customize.spec.ts`

**Interfaces:**
- Consumes: Tasks 1-3 module exports; `getKpiTiles`, `KPI_TILE_META`, `KpiCard` from `@/components/metrics/portfolio-kpi-strip`; existing `AreaChart`, `ValueVsDepositsChart`, bond grouping helpers.
- Produces: no new exports.

The page keeps Breadcrumb at top, adds a "Dostosuj" button (matching the dashboard header), renders `SectionCustomizePanel` when open, and moves the KPI strip + 2 charts + holdings + cash into a `SectionGrid` with `testIdPrefix="portfolio-detail"`.

- [ ] **Step 1: Add registry, theme, icons, and KPI plumbing**

```tsx
import { useMedia } from "@/features/dashboard/use-media"; // OR inline a local useMedia (see note)
import {
  useSectionCustomization,
  type SectionDef,
  type SectionRegistry,
  type SectionSize,
} from "@/components/customize/section-customization";
import { SectionCustomizePanel, type SectionPanelTheme } from "@/components/customize/section-customize-panel";
import { SectionGrid } from "@/components/customize/section-grid";
import { getKpiTiles, KPI_TILE_META, KpiCard } from "@/components/metrics/portfolio-kpi-strip";
import { TYPOGRAPHY } from "@/lib/design-tokens";
import {
  BadgeDollarSign, BadgePercent, Banknote, BriefcaseBusiness, ChartArea, ChartLine,
  ChartNoAxesColumnDecreasing, ChartNoAxesCombined, CircleDollarSign, CircleGauge, ClipboardList,
  Coins, Landmark, LayoutDashboard, Wallet,
} from "lucide-react";

const PD_KPI_ICONS: Record<string, typeof ChartLine> = {
  kpiValue: LayoutDashboard, kpiCash: Coins,
  kpiUnrealized: ChartLine, kpiXirr: BadgePercent, kpiTwr: CircleGauge, kpiCagr: ChartNoAxesCombined,
  kpiRealReturn: CircleDollarSign, kpiMaxDd: ChartNoAxesColumnDecreasing, kpiRealized: BadgeDollarSign,
  kpiInvested: Landmark, kpiDividends: Coins, kpiOpenPositions: BriefcaseBusiness,
};

const KPI_SIZE: SectionSize[] = [{ width: 1 }, { width: 2 }];

const PD_SECTIONS: SectionDef<string>[] = [
  { id: "kpiValue", label: "Wartość portfela", desc: "Łączna wartość portfela.", category: "metrics", icon: LayoutDashboard, sizePresets: KPI_SIZE },
  { id: "kpiCash", label: "Gotówka", desc: "Saldo środków pieniężnych.", category: "metrics", icon: Coins, sizePresets: KPI_SIZE },
  ...KPI_TILE_META.map((t) => ({ id: t.id, label: t.label, desc: t.desc, category: "metrics", icon: PD_KPI_ICONS[t.id], sizePresets: KPI_SIZE })),
  { id: "history", label: "Historia wartości", desc: "Wykres wartości z wyborem zakresu.", category: "charts", icon: ChartArea, sizePresets: [{ width: 4 }, { width: 2 }] },
  { id: "valueVsDeposits", label: "Wartość vs wpłaty", desc: "Wartość konta na tle wpłat.", category: "charts", icon: ChartNoAxesCombined, sizePresets: [{ width: 4 }, { width: 2 }] },
  { id: "holdings", label: "Pozycje", desc: "Tabela instrumentów w portfelu.", category: "data", icon: Wallet, sizePresets: [{ width: 4 }, { width: 3 }, { width: 2 }] },
  { id: "cash", label: "Środki pieniężne", desc: "Salda gotówkowe wg waluty.", category: "data", icon: Banknote, sizePresets: [{ width: 4 }, { width: 2 }] },
];

const PD_REGISTRY: SectionRegistry<string> = {
  storageKey: "zecca.portfolio-detail.sections.v1",
  categoryOrder: ["metrics", "charts", "data"],
  categories: [
    { id: "metrics", label: "Wskaźniki", desc: "KPI portfela i zwrotu.", icon: CircleGauge },
    { id: "charts", label: "Wykresy", desc: "Wizualizacje wartości.", icon: ChartArea },
    { id: "data", label: "Dane", desc: "Pozycje i środki pieniężne.", icon: ClipboardList },
  ],
  sections: PD_SECTIONS,
};

// Blue palette for this page. card/ink/brand are hex (fed to mixHex).
const PD_THEME: SectionPanelTheme = {
  card: "#FFFDF9",
  ink: "#1C3144",
  brand: "#34699A",
  muted: "rgba(28,49,68,0.58)",
  subtle: "rgba(28,49,68,0.38)",
  line: "rgba(28,49,68,0.10)",
  fontUi: TYPOGRAPHY.system,
  fontSerif: TYPOGRAPHY.serif,
  fontMono: TYPOGRAPHY.mono,
};
```

Note on `useMedia`: there is no shared `useMedia` export today (it is local to `dashboard-overview.tsx`). Inline a small copy at the top of this file rather than importing from the dashboard feature:

```tsx
function useMedia(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);
  return matches;
}
```

(Replace the earlier `import { useMedia }` line — use the inline version.)

- [ ] **Step 2: Build KPI value lookup + section renderer**

Inside `PortfolioDetailPage`, after `detail` is known (non-null branch), add:

```tsx
const isMobile = useMedia("(max-width: 720px)");
const isTablet = useMedia("(max-width: 1140px)");
const [showCustomize, setShowCustomize] = useState(false);
const { config, toggle, move, resize, reset } = useSectionCustomization(PD_REGISTRY);
const visibleSections = new Set(config.visibleSections);
const orderedVisibleSections = config.sectionOrder.filter((s) => visibleSections.has(s));
const sizeOf = (id: string) => config.sectionSizes[id] ?? PD_REGISTRY.sections.find((s) => s.id === id)!.sizePresets[0];

const kpiById = new Map(
  getKpiTiles({
    metrics: detail.metrics,
    cashflows: detail.cashflows,
    totalValue: detail.totalValue,
    openPositions: detail.holdings.length,
    currency: displayCurrency,
  }).map((tile) => [tile.id, tile]),
);

const renderSection = (id: string) => {
  if (id === "kpiValue") return <KpiCard label="Wartość portfela" value={`${fmt(detail.totalValue)} ${displayCurrency}`} />;
  if (id === "kpiCash") return <KpiCard label="Gotówka" value={`${fmt(detail.cashValue)} ${displayCurrency}`} />;
  const kpi = kpiById.get(id);
  if (kpi) return <KpiCard label={kpi.label} value={kpi.value} sub={kpi.sub} color={kpi.color} />;
  if (id === "history") return <HistoryCard detail={detail} period={period} onPeriodChange={setPeriod} chartSeries={chartSeries} />;
  if (id === "valueVsDeposits") return (
    <div style={{ ...glassCard, padding: "22px 22px 18px", height: "100%" }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: ".10em", marginBottom: 14 }}>Wartość konta na tle wpłat</div>
      <ValueVsDepositsChart value={detail.valuationSeries} deposits={detail.netInvestedSeries} currency={displayCurrency} height={210} />
    </div>
  );
  if (id === "holdings") return <HoldingsCard rows={holdingRows} groupedCount={groupedHoldings.length} expandedFamilies={expandedFamilies} toggleFamily={toggleFamily} displayCurrency={displayCurrency} />;
  if (id === "cash") return detail.cashBalances.length > 0 ? <CashCard balances={detail.cashBalances} /> : null;
  return null;
};
```

Extract the existing JSX blocks into `HistoryCard`, `HoldingsCard`, and `CashCard` components in the same file (move the current markup verbatim into them, wrapping each top-level card with `height: "100%"` so grid cells stretch). `HistoryCard` contains the period selector + `AreaChart` (currently lines ~176-208); `HoldingsCard` contains the holdings table (lines ~226-380); `CashCard` contains the cash balances block (lines ~383-432).

- [ ] **Step 3: Replace the page body's stacked layout with header + panel + grid**

```tsx
return (
  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
      <Breadcrumb name={detail.name} />
      <button
        type="button"
        onClick={() => setShowCustomize((v) => !v)}
        aria-expanded={showCustomize}
        style={{
          border: `0.5px solid ${PD_THEME.line}`,
          borderRadius: 10,
          background: showCustomize ? "rgba(52,105,154,0.10)" : "#FFFDF9",
          color: showCustomize ? PD_THEME.brand : INK,
          cursor: "pointer",
          fontFamily: TYPOGRAPHY.system,
          fontSize: 12.5,
          fontWeight: 700,
          padding: "8px 13px",
        }}
      >
        Dostosuj
      </button>
    </div>

    {showCustomize && (
      <SectionCustomizePanel
        registry={PD_REGISTRY}
        config={config}
        visibleSections={visibleSections}
        onToggle={toggle}
        onMove={move}
        onResize={resize}
        onReset={reset}
        theme={PD_THEME}
        eyebrow="Portfel"
        title="Układ sekcji"
        subtitle="Web zapisuje widoczność, kolejność i preset rozmiaru w tej przeglądarce."
      />
    )}

    <SectionGrid
      orderedVisibleSections={orderedVisibleSections}
      sizeOf={sizeOf}
      renderSection={renderSection}
      isMobile={isMobile}
      isTablet={isTablet}
      testIdPrefix="portfolio-detail"
    />
  </div>
);
```

The `!records` and `!detail` guard branches keep returning their existing simple layouts (Breadcrumb + message) — do not route those through the grid.

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean (remove unused imports such as `PortfolioKpiStrip` if no longer used).

- [ ] **Step 5: Write the portfolio-detail e2e**

```ts
// tests/e2e/fake-sync/portfolio-detail-customize.spec.ts
import { expect, test, type Page } from "@playwright/test";

const expandCategory = (page: Page, name: string) =>
  page.getByRole("main").getByRole("button", { name: new RegExp(`^${name}`) }).click();

test("portfolio detail customize toggles, resizes and persists per its own key", async ({ page }) => {
  await page.goto("/portfolios");
  const firstPortfolio = page.getByRole("main").getByRole("link", { name: /#/ }).first();
  // Navigate into the first portfolio detail.
  await page.getByRole("main").locator("a[href^='/portfolios/']").first().click();
  await expect(page).toHaveURL(/\/portfolios\/.+/);

  const main = page.getByRole("main");
  const grid = page.getByTestId("portfolio-detail-grid");
  await expect(grid).toBeVisible();

  await main.getByRole("button", { name: "Dostosuj" }).click();
  await expect(main.getByText("Układ sekcji")).toBeVisible();

  await expandCategory(page, "Dane");
  await main.getByRole("radiogroup", { name: "Szerokość sekcji Pozycje" }).getByRole("radio", { name: "2 kolumny" }).click();
  await expect.poll(async () =>
    page.evaluate(() => {
      const raw = window.localStorage.getItem("zecca.portfolio-detail.sections.v1");
      return raw ? JSON.parse(raw).sectionSizes?.holdings : null;
    }),
  ).toEqual({ width: 2 });

  await main.getByRole("checkbox", { name: "Pokaż sekcję Środki pieniężne" }).uncheck();
  await page.reload();
  await expect.poll(async () =>
    page.evaluate(() => {
      const raw = window.localStorage.getItem("zecca.portfolio-detail.sections.v1");
      return raw ? JSON.parse(raw).visibleSections : [];
    }),
  ).not.toContain("cash");

  await main.getByRole("button", { name: "Dostosuj" }).click();
  await main.getByRole("button", { name: "Przywróć domyślne" }).click();
  await expect.poll(async () =>
    page.evaluate(() => {
      const raw = window.localStorage.getItem("zecca.portfolio-detail.sections.v1");
      return raw ? JSON.parse(raw).visibleSections : [];
    }),
  ).toContain("cash");
});
```

(If a fake-sync portfolio has no cash balances, switch the toggled section to "Pozycje"/`holdings`, which always renders. Verify against the fake-sync fixture when running.)

- [ ] **Step 6: Run the portfolio-detail e2e**

Run: `npx playwright test --config playwright.fake-sync.config.ts portfolio-detail-customize`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/portfolios/portfolio-detail-page.tsx tests/e2e/fake-sync/portfolio-detail-customize.spec.ts
git commit -m "Add full section customization to portfolio detail page"
```

---

### Task 7: Full regression sweep

**Files:** none (verification only).

- [ ] **Step 1: Unit tests**

Run: `npx vitest run`
Expected: PASS (including new `section-customization.test.ts`).

- [ ] **Step 2: Fake-sync e2e suite**

Run: `npx playwright test --config playwright.fake-sync.config.ts`
Expected: PASS (dashboard-customize, value-vs-deposits-horizon, portfolio-detail-customize, and all pre-existing specs).

- [ ] **Step 3: Typecheck + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: clean.

- [ ] **Step 4: Manual smoke (preview)**

Start the dev server, then: open `/dashboard`, click Dostosuj — categories start collapsed; expand "Wskaźniki", hide a KPI, resize, reorder; confirm the value-vs-deposits card shows a MAX-default horizon selector and 1M/3M crop both lines. Open a portfolio at `/portfolios/[id]` — same panel (blue), KPIs as individual cards, both charts (value-vs-deposits with horizon), holdings, cash; toggle/resize/persist across reload; "Przywróć domyślne" restores. Confirm reports page value-vs-deposits chart also shows the horizon selector.

- [ ] **Step 5: Final commit (if smoke fixes needed)**

```bash
git add -A
git commit -m "Polish + fixes from regression sweep"
```

---

## Self-Review

**Spec coverage:**
- Req 1 (customization on portfolio detail, full parity) → Tasks 1-3 (module), 6 (page). ✓
- Req 2 (collapsed by default) → Task 2 (`expandedCategories` = `{}`/all-false), Task 4 step 4 (dashboard e2e expands first). ✓
- Req 3 (value-vs-deposits horizon) → Task 5; covered in all three usages by editing the shared chart. ✓
- Shared module / Approach A → Tasks 1-3; dashboard refactor → Task 4. ✓
- Separate storage key → Task 6 (`zecca.portfolio-detail.sections.v1`). ✓
- Legacy-shape + zero-visible + newly-shipped behavior preserved → Task 1 tests + impl. ✓
- Test updates (dashboard e2e) + new specs → Tasks 4, 5, 6; sweep → Task 7. ✓

**Placeholder scan:** No TBD/TODO; every code step shows code; the one conditional ("if no cash in fixture, toggle holdings") is an explicit fallback, not a placeholder.

**Type consistency:** `SectionRegistry`/`SectionConfig`/`SectionSize`/`SectionPanelTheme`/`mixHex` names match across Tasks 1-6. Hook returns `{config, toggle, move, resize, reset}` — used verbatim in Tasks 4 and 6. `SectionGrid` props (`orderedVisibleSections`, `sizeOf`, `renderSection`, `testIdPrefix`) consistent. `showPeriodControl` default `true` consistent.
