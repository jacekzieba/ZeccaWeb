# XTB Import — Remaining Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the three parity gaps in the web XTB importer relative to native `XTBImporter.swift`: re-import deduplication, orphan interest-tax warnings, and known-instrument resolution by name.

**Architecture:** All three are surgical changes to the existing pure/sync parser (`parseXtbXlsx`) and its reference-data builder. No new modules. Dedup data flows in through `ImportReferenceData`; the two warning/resolution gaps are local to `xtb-parser.ts`.

**Tech Stack:** TypeScript, Vitest. Tests live in `tests/unit/`.

## Global Constraints

- `npx vitest run tests/unit` must stay green (currently 237 passing).
- `npx tsc --noEmit` must exit 0.
- Surgical changes only (CLAUDE.md §3): touch `import-parser.ts` and `xtb-parser.ts` only; do not alter PKO/generic behavior.
- Parity reference: `~/Desktop/Zecca/Sources/InvestorDomain/BrokerImport/XTBImporter.swift`.
- Match existing style: Polish warning strings, `crypto.randomUUID()` for ids, no new deps.

---

### Task 1: Re-import deduplication by externalImportID

Native skips any row whose `xtb:<ID>` is already imported (`existingExternalIDs`). The web importer never checks this: each parse mints fresh transaction UUIDs and `externalImportID` is stored but never read, so re-importing the same file duplicates every transaction.

**Files:**
- Modify: `src/features/import/import-parser.ts` — `ImportReferenceData` type + `buildImportReferenceData`
- Modify: `src/features/import/xtb-parser.ts` — raw-row loop
- Test: `tests/unit/certification-import-parsers.test.ts`

**Interfaces:**
- Produces: `ImportReferenceData.existingExternalImportIds?: Set<string>` (optional — omitted means "nothing imported yet").
- Consumes (Task nothing): parser reads `references.existingExternalImportIds`.

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/certification-import-parsers.test.ts`, inside `describe("certification import parity", ...)`:

```typescript
  it("XTB: skips rows already imported (dedup by externalImportID)", () => {
    const refs: ImportReferenceData = {
      ...references,
      existingExternalImportIds: new Set(["xtb:100002"]), // VWCE buy already imported
    };
    const preview = parseXtbXlsx(XTB_ROWS, PORTFOLIO, refs);
    const byType = groupByType(preview.validRows);
    expect(byType.get("buy")).toHaveLength(2); // was 3
    const hasDuplicated = preview.validRows.some(
      (r) => (payloadOf(r) as Payload).externalImportID === "xtb:100002",
    );
    expect(hasDuplicated).toBe(false);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/certification-import-parsers.test.ts -t "dedup by externalImportID"`
Expected: FAIL — `expected 3 to have length 2` (dedup not yet implemented). It may also fail to typecheck on `existingExternalImportIds`; that is fixed in Step 3.

- [ ] **Step 3: Add the field to the reference type and builder**

In `src/features/import/import-parser.ts`, extend the `ImportReferenceData` type (the `instruments: {...}[]` block near line 92-98) by adding:

```typescript
  existingExternalImportIds: Set<string>;
```

Make it required in the type. In `buildImportReferenceData`, add the collector next to `existingTransactionIds`:

```typescript
  const existingExternalImportIds = new Set<string>();
```

Inside the `if (record.envelope.type === "transaction")` block, alongside `existingTransactionIds.add(record.id);`:

```typescript
      const txPayload = record.envelope.payload as { externalImportID?: string | null };
      if (txPayload.externalImportID) existingExternalImportIds.add(txPayload.externalImportID);
```

And add `existingExternalImportIds,` to the returned object.

- [ ] **Step 4: Make the field optional on the type OR update all literals**

Because test literals and callers build `ImportReferenceData` inline, make the new field optional to avoid breaking them:

Change the type line to:

```typescript
  existingExternalImportIds?: Set<string>;
```

(The builder still always sets it; consumers treat `undefined` as empty.)

- [ ] **Step 5: Skip duplicates in the parser**

In `src/features/import/xtb-parser.ts`, in the raw-row parse loop, right after `const externalId = rawId ? \`xtb:${rawId}\` : null;`:

```typescript
    if (externalId && references.existingExternalImportIds?.has(externalId)) continue;
```

This drops the row before it enters commission/tax indexing, so a duplicated trade never produces phantom pairings.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/unit/certification-import-parsers.test.ts && npx tsc --noEmit`
Expected: PASS (all XTB/PKO tests green), tsc exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/features/import/import-parser.ts src/features/import/xtb-parser.ts tests/unit/certification-import-parsers.test.ts
git commit -m "fix(import): dedup XTB rows already imported by externalImportID"
```

---

### Task 2: Orphan interest-tax warning

Native surfaces a "free funds interest tax" row with no matching interest as a warning (its final `taxesByDay` sweep). The web parser silently drops it (it falls into the no-op `close trade / interest tax` branch), so a stray tax vanishes without a trace.

**Files:**
- Modify: `src/features/import/xtb-parser.ts` — after the main `for` loop, before `return`
- Test: `tests/unit/certification-import-parsers.test.ts`

**Interfaces:** none (local warning only).

- [ ] **Step 1: Write the failing test**

Add inside the `describe` block:

```typescript
  it("XTB: warns about an interest tax with no matching interest", () => {
    const rows: unknown[][] = [
      ["ID", "Type", "Time", "Ticker", "Instrument", "Comment", "Amount"],
      [200001, "IKE Deposit", new Date("2026-01-05T10:00:00Z"), "", "", "Deposit", 1000],
      [200002, "Free funds interest tax", new Date("2026-05-01T10:00:00Z"), "", "", "Interest tax", -1.9],
    ];
    const preview = parseXtbXlsx(rows, PORTFOLIO, references);
    expect(preview.warnings.some((w) => w.includes("bez pary"))).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/certification-import-parsers.test.ts -t "no matching interest"`
Expected: FAIL — `expected false to be true` (no warning emitted).

- [ ] **Step 3: Add the orphan sweep**

In `src/features/import/xtb-parser.ts`, immediately before the final `return {` of `parseXtbXlsx`:

```typescript
  // Surface interest taxes that never paired with an interest row (parity with
  // native's final taxesByDay sweep).
  for (const [, list] of taxesByDay) {
    for (const entry of list) {
      if (consumedTax.has(entry.idx)) continue;
      const r = cashRows[entry.idx];
      warnings.push(`Wiersz ${r.rowIndex}: ${r.typeRaw} bez pary — pominięto`);
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/certification-import-parsers.test.ts && npx tsc --noEmit`
Expected: PASS. Confirm the existing "7 transactions" test still passes — its interest tax (100008) pairs with interest (100007), so it is consumed and must NOT warn.

- [ ] **Step 5: Commit**

```bash
git add src/features/import/xtb-parser.ts tests/unit/certification-import-parsers.test.ts
git commit -m "feat(import): warn on XTB interest tax with no matching interest"
```

---

### Task 3: Resolve known instruments by name

Native's `resolveInstrument` matches a known instrument by symbol, then base ticker, then **case-insensitive full name**. The web parser stops at base ticker, so a known instrument whose registered symbol differs from the XTB ticker but whose name matches gets duplicated as a new instrument.

**Files:**
- Modify: `src/features/import/xtb-parser.ts` — `resolveOrCreateInstrument` known-lookup
- Test: `tests/unit/certification-import-parsers.test.ts`

**Interfaces:** none (uses existing `references.instruments[].name`).

- [ ] **Step 1: Write the failing test**

Add inside the `describe` block:

```typescript
  it("XTB: resolves a known instrument by name when the ticker differs", () => {
    const refs: ImportReferenceData = {
      ...references,
      instruments: [
        // Registered under a different symbol but the same display name.
        { id: "99999999-9999-4999-8999-999999999999", symbol: "VWRA.UK", name: "Vanguard FTSE All-World", currency: "USD" },
      ],
    };
    const rows: unknown[][] = [
      ["ID", "Type", "Time", "Ticker", "Instrument", "Comment", "Amount"],
      [300001, "Stock purchase", new Date("2026-01-10T10:00:00Z"), "VWCE.DE", "Vanguard FTSE All-World", "OPEN BUY 10 @ 100.00", -4500],
    ];
    const preview = parseXtbXlsx(rows, PORTFOLIO, refs);
    // Matched by name → reuses the registered instrument, creates none.
    expect(preview.newInstrumentPayloads).toHaveLength(0);
    const buy = preview.validRows.find((r) => String((payloadOf(r) as Payload).transactionType) === "buy")!;
    expect((payloadOf(buy) as Payload).instrumentID).toBe("99999999-9999-4999-8999-999999999999");
    expect((payloadOf(buy) as Payload).currency).toBe("USD");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/certification-import-parsers.test.ts -t "by name when the ticker differs"`
Expected: FAIL — `expected [ {...} ] to have length 0` (a new instrument is created because name matching is missing).

- [ ] **Step 3: Add the name fallback**

In `src/features/import/xtb-parser.ts`, in `resolveOrCreateInstrument`, extend the `known` lookup (currently symbol then base) to add a case-insensitive name match:

```typescript
    const known =
      references.instruments.find((i) => i.symbol.toUpperCase() === upper) ??
      references.instruments.find((i) => i.symbol.toUpperCase() === base) ??
      (name
        ? references.instruments.find((i) => i.name.toLowerCase() === name.toLowerCase())
        : undefined);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/certification-import-parsers.test.ts && npx tsc --noEmit`
Expected: PASS. The existing "7 transactions" test still matches VWCE.DE/CSPX.UK/IEML.UK by symbol first, so name matching does not change its results.

- [ ] **Step 5: Commit**

```bash
git add src/features/import/xtb-parser.ts tests/unit/certification-import-parsers.test.ts
git commit -m "feat(import): resolve known XTB instrument by name when ticker differs"
```

---

## Notes / Out of scope

- **ISIN-based resolution** (native also matches known instruments by catalog ISIN) is deferred: `ImportReferenceData.instruments` carries no `isin` today, so it would require threading ISIN through `buildImportReferenceData` and the asset payload — a larger change than these three gaps. Revisit if duplicate-by-ISIN cases appear in practice.
- These tasks are independent and can be executed in any order; each is a self-contained red→green→commit cycle.

## Self-Review

- **Spec coverage:** Task 1 → gap #1 (dedup); Task 2 → gap #2 (orphan tax); Task 3 → gap #3 (name resolution). All three covered.
- **Placeholder scan:** none — every step has concrete code and exact commands.
- **Type consistency:** `existingExternalImportIds` is the single new symbol, declared optional on `ImportReferenceData` and read with `?.has(...)` in the parser. Consistent.
