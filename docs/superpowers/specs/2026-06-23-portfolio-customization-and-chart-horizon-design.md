# Portfolio-view customization + value-vs-deposits time horizon

**Date:** 2026-06-23
**Status:** Approved (design)

## Problem

Three gaps relative to the dashboard:

1. The section-customization feature (toggle visibility, reorder, resize "wskaźniki i
   wykresy") exists **only** on the dashboard. The portfolio **detail** view
   (`/portfolios/[id]`) — the analog with KPIs, charts and tables — has no
   customization.
2. The customization panel shows every category **expanded** by default, which is a
   long wall of controls. Categories should be **collapsed** by default.
3. The "Wartość konta na tle wpłat" chart (`ValueVsDepositsChart`) has no time-horizon
   selector, unlike the main account-value chart.

## Decisions (from brainstorming)

- Target view for customization: **portfolio detail page** (`/portfolios/[id]`), not the
  list page.
- Granularity: **full parity with the dashboard** — each KPI is its own
  toggleable/movable/resizable section in a 4-column grid.
- Code sharing: **Approach A** — extract a generic, theme-able customization module;
  refactor the dashboard onto it; build the portfolio detail on the same module.
- Value-vs-deposits default horizon: **MAX** (full history is the point of the deposits
  overlay).
- Portfolio-detail customization persists under a **separate** localStorage key from the
  dashboard.

## Architecture

### New generic module: `src/components/customize/`

A reusable, theme-able section-customization unit, parameterized by a *registry* and a
*theme*. Decouples the dashboard's current inline machinery so both views share it.

**`section-customization.ts`** — pure logic + hook:

- Generic types:
  - `SectionSize = { width: 1 | 2 | 3 | 4 }`
  - `SectionCategory = { id: string; label: string; desc: string; icon: LucideIcon }`
  - `SectionDef<Id> = { id: Id; label: string; desc: string; category: string; icon: LucideIcon; sizePresets: SectionSize[] }`
  - `SectionRegistry<Id> = { sections: SectionDef<Id>[]; categories: SectionCategory[]; categoryOrder: string[] }`
  - `SectionConfig<Id> = { sectionOrder: Id[]; visibleSections: Id[]; sectionSizes: Partial<Record<Id, SectionSize>>; knownSections: Id[] }`
- `defaultConfig(registry)` — order/visible = all sections, sizes = first preset each,
  knownSections = all.
- `sanitizeOrder / sanitizeVisible / sanitizeSizes` — registry-driven (replace the
  dashboard-specific `sanitize*` functions).
- `readConfig(storageKey, registry)` — parses localStorage, sanitizes, and surfaces
  sections shipped after the saved config (the existing "newly-shipped" logic, made
  generic). Tolerates the legacy array-only shape and legacy sizes that carry a `height`
  (existing dashboard behavior must be preserved — covered by an existing e2e test).
- `saveConfig(storageKey, registry, config)`.
- `useSectionCustomization(storageKey, registry)` → `{ config, toggle, move, resize, reset }`,
  persisting on change. Reducer semantics identical to the current dashboard
  (`toggleSection` refuses to hit zero visible; `moveSection` swaps neighbors; `resize`
  sets size; `reset` restores defaults).

**`SectionCustomizePanel.tsx`** — the collapsible categorized panel (ported from
`DashboardCustomizePanel`), now generic:

- Props: `registry`, `config`, `visibleSections: Set<Id>`, `onToggle/onMove/onResize/onReset`,
  `theme`, plus optional `eyebrow`/`title`/`subtitle` text.
- `theme` carries the palette tokens the panel needs (`card`, `ink`, `muted`, `subtle`,
  `line`, `brand`, `mono`/`ui`/`serif` font families, and a `mix(hex, pct)` helper or the
  raw colors needed to derive tints). This lets the dashboard render green and the
  portfolio detail render its blue palette.
- **Categories collapsed by default** (requirement 2): `expandedCategories` initial state
  = all `false`.
- Preserves accessibility labels and control names used by tests ("Przesuń … wyżej/niżej",
  "Pokaż sekcję …", "Szerokość sekcji …", "Przywróć domyślne", "Układ sekcji").

**`SectionGrid.tsx`** — responsive grid wrapper:

- Props: `orderedVisibleSections: Id[]`, `sizeOf(id) => SectionSize`, `renderSection(id)`,
  `isMobile`, `isTablet`, and a `testIdPrefix` (default `"dashboard"` for back-compat).
- Emits `data-testid={`${testIdPrefix}-grid`}` and `${testIdPrefix}-section-${id}` and the
  same gridColumn/height rules as today (`span N` on desktop, `1 / -1` below the
  breakpoint).

### Dashboard refactor (`dashboard-overview.tsx`)

- Build `DASHBOARD_REGISTRY` from the current `DASHBOARD_SECTION_OPTIONS`, categories,
  icons, and size presets.
- Replace inline config state/handlers with `useSectionCustomization("zecca.dashboard.sections.v1", DASHBOARD_REGISTRY)`.
- Replace `DashboardCustomizePanel` with `<SectionCustomizePanel … theme={dashboardTheme}>`
  and the grid block with `<SectionGrid testIdPrefix="dashboard" …>`.
- Net: behavior identical; `data-testid`s and storage key preserved. The dashboard file
  shrinks substantially.

### Portfolio detail refactor (`portfolio-detail-page.tsx`)

- Build `PORTFOLIO_DETAIL_REGISTRY`:
  - **metrics**: `kpiValue` (Wartość portfela), `kpiCash` (Gotówka), then the 10 shared
    `KPI_TILE_META` tiles (same ids as the dashboard) — sizes `[{1},{2}]`.
  - **charts**: `history` (Historia wartości; keeps its own period selector + `AreaChart`),
    `valueVsDeposits` — sizes `[{4},{2}]`.
  - **data**: `holdings` (Pozycje, with the bond-family grouping/expansion), `cash` (Środki
    pieniężne) — sizes `[{4},{3},{2}]` / `[{2},{3},{4}]`.
- `useSectionCustomization("zecca.portfolio-detail.sections.v1", PORTFOLIO_DETAIL_REGISTRY)`.
- Breadcrumb + a "Dostosuj" toggle button live above the grid (matching the dashboard
  header pattern); `SectionCustomizePanel` renders below the button when open; everything
  else moves into `<SectionGrid testIdPrefix="portfolio-detail">`.
- KPI values come from `getKpiTiles(...)` (already shared) plus the two portfolio-specific
  value/cash tiles. Each KPI renders via the shared `KpiCard`.
- The history chart's period state stays local to the detail page (its existing
  selector). Holdings keep their existing interaction (family expand/collapse).
- Visual style: blue `INK` palette via `theme`; sections wrapped in the page's `glassCard`
  look where appropriate so the grid still reads as the portfolio detail page.

### Requirement 3: `ValueVsDepositsChart` time horizon

In `src/components/charts/value-vs-deposits-chart.tsx`:

- Add an internal `period` state with options `["1M","3M","6M","1Y","2Y","MAX"]`, default
  **`MAX`**.
- Render a small period selector (same affordance/labels as the existing chart period
  bars) in the chart header next to the legend.
- Filter **both** `value` and `deposits` by the same date cutoff before plotting, keeping
  them index-aligned (a single shared `filterByPeriod` helper applied to each series with
  the same cutoff date derived from the longer/last series). Falls back to the last two
  points so sparse short ranges still render.
- Optional `showPeriodControl?: boolean` prop (default `true`) so a caller can suppress it
  if ever needed. All three usages (dashboard, portfolio detail, reports) get the selector
  automatically.

## Data flow

No backend/snapshot changes. All customization is client-side localStorage UI preference,
per browser. The chart horizon is pure client-side filtering of series the snapshot already
produces (`valuationSeries`, `netInvestedSeries`). No new types in `domain/models`.

## Error handling / edge cases

- localStorage read/parse failures fall back to `defaultConfig(registry)` (existing
  behavior).
- `toggle` never allows zero visible sections.
- Legacy stored shapes (array-only config; sizes with a stale `height`) normalize exactly
  as today (existing e2e test must stay green).
- Chart with `< 2` aligned points after filtering renders nothing (existing guard); the
  period filter must not reduce a valid series below 2 points (fallback to last 2).
- New portfolio-detail sections shipped later surface once via the same "newly-shipped"
  logic.

## Testing

- **Update** `tests/e2e/fake-sync/dashboard-customize.spec.ts`: with collapse-by-default,
  expand the relevant category before interacting with its controls. All existing
  assertions (order, width persistence, visibility, reload, legacy-size normalization,
  no-internal-scroll, tablet/mobile spans) must still pass.
- **Add** an e2e spec for the portfolio detail panel: toggle a section hidden, reorder,
  resize, reload-persist, reset — against `zecca.portfolio-detail.sections.v1` and
  `portfolio-detail-section-*` test ids.
- **Add** coverage for the value-vs-deposits period control (changing horizon re-renders;
  default is MAX).
- Run the existing unit/`vitest` suite for any touched shared logic
  (sanitize/read/save round-trip) — add focused unit tests for the generic
  `readConfig`/`sanitize*` if practical.

## Out of scope (YAGNI)

- No customization on the portfolio **list** page.
- No drag-and-drop reordering (keep the up/down buttons).
- No server-side persistence / cross-device sync of layout.
- No change to the dashboard main chart's default period (stays 1Y).
