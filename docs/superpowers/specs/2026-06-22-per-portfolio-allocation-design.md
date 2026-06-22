# Per-portfolio target allocation (synced) — design

**Date:** 2026-06-22
**Status:** Approved

## Problem

The web app edits a single **global** target allocation stored in `localStorage`
(`profile.targetAllocation`) with only **4** asset classes (Akcje/ETF, Obligacje,
Lokaty, Gotówka). The macOS app stores target allocation **per account**, synced,
covering all **6** supported classes. Web should match macOS: per-portfolio
allocation over all asset classes, written back to the synced account record.

## Canonical asset classes

The macOS account record carries `targetAllocation: Record<string, number>` keyed
by asset-class key (confirmed from synced payloads / unit fixtures: `equity`,
`bonds`, `crypto`, `deposit`, `other`, `cash`). Ordered list, with labels/colors:

| key | label | color token |
|---|---|---|
| `equity` | Akcje / ETF | `V2.equity` |
| `bonds` | Obligacje | `V2.bonds` |
| `crypto` | Kryptowaluty | `V2.crypto` |
| `other` | Inne aktywa | brown `#6F6353` |
| `deposit` | Lokaty | `V2.deposit` |
| `cash` | Gotówka | `V2.cash` |

## Components

1. **`src/features/portfolios/asset-classes.ts`** — exports `ASSET_CLASSES`
   (ordered `{ key, label, color }`), plus helpers `emptyAllocation()`,
   `readAllocation(record): Record<string, number>` (normalizes/clamps a raw
   payload allocation to the 6 known keys), and `sumAllocation(record): number`.

2. **`AllocationEditorModal`** (new, `src/features/portfolios/`) — mirrors the
   macOS "Alokacja docelowa" dialog. Header: title + portfolio name. Six rows
   (color dot · label · range slider · number input · `%`). Footer: `Suma: X%`
   (green at 100, red otherwise) + `Wyczyść`; actions `Anuluj` / `Zapisz`.
   Save writes the account record:
   `saveRecord(supabase, key, "account", makeAccountPayload({ id, name,
   baseCurrency, accountType, colorHex, targetAllocation }), { baseUpdatedAt })`,
   then `refreshSyncStore` + `setSync`. Locked sync (no `userDataKey`/`supabase`)
   → warning banner + disabled save, same pattern as `PortfolioEditorModal`.
   Saving is allowed regardless of sum (matches macOS), only colored for feedback.

3. **Fix `makeAccountPayload` callers** — `PortfolioEditorModal` currently calls
   `makeAccountPayload({ id, name, baseCurrency })`, dropping `colorHex`,
   `accountType`, and `targetAllocation` (defaulted to `{}`), so renaming a
   portfolio on web **wipes its macOS allocation**. Both modals must pass through
   the existing values read from the source `account` record envelope.

4. **Settings integration** (`settings-page.tsx`) — remove the global
   `AllocationSection`. In "Konta i źródła", each portfolio row gets an
   **"Alokacja"** button opening the modal. The draft (id, name, baseCurrency,
   colorHex, accountType, targetAllocation, updatedAt) is built from the raw
   `useSyncStore` records via `envelope.type === "account"` lookup — the same
   pattern `portfolio-list-page` already uses for the editor draft.

5. **`profile-store.ts`** — remove the now-unused `targetAllocation` field, its
   default, and the load-merge branch. Old localStorage value is ignored harmlessly.

## Out of scope

- Dashboard allocation card (shows *actual* allocation) — unchanged.
- Entry points other than Settings rows.
- Migration of the old global allocation into a portfolio (not meaningful).
- In-flight `dashboard-overview.tsx` / `dashboard-customize.spec.ts` changes — untouched.

## Testing

- Unit: `makeAccountPayload` round-trips a non-empty `targetAllocation`;
  `readAllocation` / `sumAllocation` clamp and normalize unknown/missing keys.
- e2e (fake-sync): open a portfolio's allocation from Settings, set values, save,
  reopen, verify persistence and sum.
