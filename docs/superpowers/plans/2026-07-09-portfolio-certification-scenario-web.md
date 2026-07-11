# Portfolio Certification Scenario — plan testów (ZeccaWeb)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Webowy odpowiednik natywnego testu certyfikacyjnego (plan: `~/Desktop/Zecca/docs/superpowers/plans/2026-07-09-portfolio-certification-scenario.md`): te same dane wejściowe (XTB, PKO Obligacje, ręczne akcje, lokaty, 3 portfele, sprzedaże) i **te same dokładne kwoty** per portfel i per instrument, liczone przez webowy silnik (`investor-snapshot` + `position-valuator`).

**Architecture:** (1) testy vitest parserów `xtb-parser`/`pko-parser` na wierszach identycznych z natywnymi fixture'ami; (2) test vitest scenariusza: `DecryptedRecord[]` (wzorzec z `src/sync/dev/fake-sync.ts`) → `buildInvestorDataSnapshot` z wstrzykniętymi kursami i `asOf` → asercje kwot; (3) Playwright fake-sync e2e z dedykowanym datasetem certyfikacyjnym.

**Tech Stack:** vitest, Playwright (`playwright.fake-sync.config.ts` jako wzorzec), TypeScript.

## Global Constraints

- **asOf = 2026-07-01**; kursy: **EUR 4.60, USD 4.20, GBP 5.30, PLN 1**.
- Rozliczenia zapadłości (wykup TOS0626, zamknięcie Lokaty A) generuje **strona natywna** i trafiają do web przez sync — w webowych testach podajemy je jako gotowe rekordy transakcji (dokładne kwoty niżej).
- Ceny instrumentów pinujemy deterministycznie (rekordy `manualValuation` albo wejście prices silnika — do potwierdzenia w Task 2 Step 1), nigdy przez sieć.
- Wszystkie oczekiwane kwoty pochodzą z natywnego planu i są przeliczone ręcznie — **rozbieżność webowego wyniku z tabelą to potencjalny bug parity, nie powód do poprawiania liczby w teście**. Zatrzymaj się i zgłoś.
- Testy: `npx vitest run tests/unit/<plik>` oraz `npx playwright test -c playwright.fake-sync-cert.config.ts`.

---

## Oczekiwane wartości (identyczne z natywnym planem)

### Portfele i identyfikatory rekordów

| Portfel | accountType | id |
|---|---|---|
| IKE ETF | `ike` | `AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA` |
| IKZE Obligacje | `ikze` | `BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB` |
| Portfel zwykły | `taxable` | `CCCCCCCC-CCCC-4CCC-8CCC-CCCCCCCCCCCC` |

### Kwoty docelowe (PLN, asOf 2026-07-01)

| Portfel | holdingsValue | cash | totalValue | costBasis | unrealizedPnL |
|---|---|---|---|---|---|
| IKE | 79 870.00 | 28 167.10 | **108 037.10** | 74 900.00 | 4 970.00 |
| IKZE | 4 558.27 | 4 148.05 | **8 706.31** | 4 000.00 | 558.27 |
| Zwykły | 32 440.00 | 30 505.30 | **62 945.30** | 31 385.00 | 1 055.00 |
| **Σ dashboard** | | | **179 688.71** | | |

Per instrument (marketValue PLN): VWCE.DE 60 szt → **30 360.00**; CSPX.UK 20 szt → **43 680.00**; IEML.UK 50 szt → **5 830.00**; EDO0432 40 szt → **4 558.27** (dirty 113.9566343151); TOS0626 → pozycja **0**; CDR 40 → **4 480.00**; PKN 110 → **7 040.00**; ALE 185 → **5 920.00**; Lokata B → **15 000.00**; Lokata A → zamknięta (brak pozycji).

### Transakcje scenariusza (wejście dla Task 2 i 3)

**IKE** (wyniki importu XTB; waluty instrumentów: VWCE.DE EUR, CSPX.UK USD, IEML.UK GBP):

| Data | Typ | Instrument | qty | price | gross | ccy | fees | taxes | fx |
|---|---|---|---|---|---|---|---|---|---|
| 2026-01-05 | cashDeposit | | | | 100000 | PLN | | | 1 |
| 2026-01-10 | buy | VWCE.DE | 100 | 100 | 10000 | EUR | 10 | | 4.5 |
| 2026-02-03 | buy | CSPX.UK | 20 | 500 | 10000 | USD | 0 | | 4.2 |
| 2026-03-02 | buy | IEML.UK | 50 | 20 | 1000 | GBP | 0 | | 5.2 |
| 2026-04-15 | dividend | CSPX.UK | | | 210 | PLN | | 0 | 1 |
| 2026-05-01 | interest | | | | 10 | PLN | | 1.90 | 1 |
| 2026-06-01 | sell | VWCE.DE | 40 | 110 | 4400 | EUR | 10 | | 4.6 |

**IKZE** (wyniki importu PKO + settlement; wszystko PLN, fx 1):

| Data | Typ | Instrument | qty | price | gross | fees | taxes |
|---|---|---|---|---|---|---|---|
| 2023-06-15 | cashDeposit | | | | 3000 | | |
| 2023-06-15 | buy | TOS0626 | 30 | 100 | 3000 | | |
| 2024-04-15 | cashDeposit | | | | 5000 | | |
| 2024-04-15 | buy | EDO0432 | 50 | 100 | 5000 | | |
| 2025-09-01 | sell | EDO0432 | 10 | 100 | 1000 | 20 | |
| 2025-09-01 | interest | EDO0432 | | | 95 | | |
| 2025-09-05 | cashWithdrawal | | | | 500 | | |
| 2026-06-15 | bondRedemption | TOS0626 | 30 | 119.1016 | 3573.048 | | 0 |

**Portfel zwykły** (PLN, fx 1): cashDeposit 2026-01-02 60000; pełne tabele CDR (12 transakcji, fee 5), PKN (13, fee 3), ALE (12, fee 4) — **skopiuj 1:1 z natywnego planu, sekcja „Portfel zwykły — ręczne transakcje"**; lokaty:

| Data | Typ | Instrument | qty | price | gross | taxes |
|---|---|---|---|---|---|---|
| 2026-04-01 | depositOpen | Lokata A | | | 20000 | |
| 2026-03-01 | depositOpen | Lokata B | | | 15000 | |
| 2026-06-30 | depositClose | Lokata A | 1 | 20360 | 20360 | 68.40 |

Instrumenty obligacji niosą `bondParams` (TOS0626: issue 2023-06-15, maturity 2026-06-15, first 6.0, base fixed, margin 6.0, kapitalizacja roczna, atMaturity; EDO0432: issue 2024-04-15, maturity 2032-04-15, first 7.0, base inflation, margin 1.5, kapitalizacja roczna, atMaturity). CPI: 2025-02 → 4.0, 2026-02 → 3.0. Lokaty niosą `depositParams` (A: 7.30%, maturity 2026-06-30; B: 6.00%, maturity 2026-09-01).

Ceny latest: VWCE.DE 110 (EUR), CSPX.UK 520 (USD), IEML.UK 22 (GBP), CDR 112, PKN 64, ALE 32, Lokata B 15000.

---

## File Structure

- Create: `tests/unit/certification-import-parsers.test.ts` — parity parserów XTB/PKO
- Create: `tests/unit/certification-scenario.test.ts` — kwoty per portfel/instrument przez `buildInvestorDataSnapshot`
- Create: `tests/unit/helpers/certification-records.ts` — budowa `DecryptedRecord[]` scenariusza (współdzielona przez unit i fake-sync)
- Create: `src/sync/dev/certification-scenario.ts` — dataset dla fake-sync (reeksport helpera)
- Modify: miejsce wyboru `buildFakeSyncRecords()` (znajdź: `grep -rn "buildFakeSyncRecords" src/`) — przełącznik `NEXT_PUBLIC_FAKE_SYNC_DATASET=certification`
- Create: `playwright.fake-sync-cert.config.ts` + `tests/e2e/fake-sync-cert/certification.spec.ts`

---

### Task 1: Parity parserów importu (vitest)

**Files:**
- Create: `tests/unit/certification-import-parsers.test.ts`

**Interfaces:**
- Consumes: `parseXtbXlsx(rows, portfolioId, references)` z `@/features/import/xtb-parser`, `parsePkoBondsXls(rows, portfolioId, references)` z `@/features/import/pko-parser`. Oba przyjmują `rows: unknown[][]` — test podaje wiersze inline (dokładnie te z tabel fixture w natywnym planie), bez czytania plików binarnych.

- [ ] **Step 1: Sprawdź kształt `ImportReferenceData` i wynikowych wierszy**

Run: `grep -n "ImportReferenceData\|TransactionImportRow\|payload" src/features/import/import-parser.ts | head -30`
Expected: definicje typów — użyj ich pól w asercjach Step 2 (payload transakcji: type/quantity/price/grossAmount/currency/fees/taxes/fxRateToBase, jak w `tests/unit/import-parser.test.ts`).

- [ ] **Step 2: Napisz test**

```ts
import { describe, expect, it } from "vitest";
import { parseXtbXlsx } from "@/features/import/xtb-parser";
import { parsePkoBondsXls } from "@/features/import/pko-parser";

const PORTFOLIO = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA";
const REFERENCES = { instruments: [], portfolios: [] } as never; // dopasuj do ImportReferenceData ze Step 1

// Wiersze identyczne z Tests/Fixtures/Certification/xtb_cert_scenario.xlsx (repo natywne)
const XTB_ROWS: unknown[][] = [
  ["ID", "Type", "Time", "Ticker", "Instrument", "Comment", "Amount"],
  [100001, "IKE Deposit", new Date("2026-01-05T10:00:00Z"), "", "", "Deposit", 100000],
  [100002, "Stock purchase", new Date("2026-01-10T10:00:00Z"), "VWCE.DE", "Vanguard FTSE All-World", "OPEN BUY 100 @ 100.00", -45000],
  [100003, "Commission", new Date("2026-01-10T10:01:00Z"), "VWCE.DE", "Vanguard FTSE All-World", "Commission", -45],
  [100004, "Stock purchase", new Date("2026-02-03T10:00:00Z"), "CSPX.UK", "iShares Core S&P 500", "OPEN BUY 20 @ 500.00", -42000],
  [100005, "Stock purchase", new Date("2026-03-02T10:00:00Z"), "IEML.UK", "iShares EM Local Govt", "OPEN BUY 50 @ 20.00", -5200],
  [100006, "Dividend", new Date("2026-04-15T10:00:00Z"), "CSPX.UK", "iShares Core S&P 500", "CSPX.UK USD 10.5/SHR", 210],
  [100007, "Free funds interest", new Date("2026-05-01T10:00:00Z"), "", "", "Interest", 10],
  [100008, "Free funds interest tax", new Date("2026-05-01T10:00:00Z"), "", "", "Interest tax", -1.9],
  [100009, "Stock sale", new Date("2026-06-01T10:00:00Z"), "VWCE.DE", "Vanguard FTSE All-World", "CLOSE SELL 40 @ 110.00", 20240],
  [100010, "Commission", new Date("2026-06-01T10:01:00Z"), "VWCE.DE", "Vanguard FTSE All-World", "Commission", -46],
];

// Wiersze identyczne z pko_cert_scenario.xls
const PKO_ROWS: unknown[][] = [
  ["DATA DYSPOZYCJI", "RODZAJ DYSPOZYCJI", "KOD OBLIGACJI", "NR ZAPISU", "SERIA", "LICZBA OBLIGACJI", "KWOTA OPERACJI", "STATUS"],
  ["2023-06-15", "dyspozycja zakupu", "TOS0626", 1001, 626, 30, 3000, "zrealizowana"],
  ["2023-06-15", "zakup papierów", "TOS0626", 1001, 626, 30, 3000, "zrealizowana"],
  ["2024-04-15", "dyspozycja zakupu", "EDO0432", 1002, 432, 50, 5000, "zrealizowana"],
  ["2024-04-15", "zakup papierów", "EDO0432", 1002, 432, 50, 5000, "zrealizowana"],
  ["2024-05-10", "dyspozycja zakupu", "EDO0432", 1003, 432, 20, 2000, "anulowana"],
  ["2025-08-28", "dyspozycja przedterminowego wykupu", "EDO0432", 0, 432, 10, 1000, "zrealizowana"],
  ["2025-09-01", "przedterminowy wykup", "EDO0432", 0, 432, 10, 1000, "zrealizowana"],
  ["2025-09-01", "odsetki", "EDO0432", 0, 432, 0, 95, "zrealizowana"],
  ["2025-09-01", "opłata za przedterminowy wykup", "EDO0432", 0, 432, 0, 20, "zrealizowana"],
  ["2025-09-05", "wypłata przelewem", "", 0, 0, 0, 500, "zrealizowana"],
];

describe("certification import parity", () => {
  it("XTB: 7 transakcji, prowizje w walucie, fx z obserwacji", () => {
    const preview = parseXtbXlsx(XTB_ROWS, PORTFOLIO, REFERENCES);
    expect(preview.errorRows).toHaveLength(0);
    expect(preview.validRows).toHaveLength(7);

    const byType = new Map<string, typeof preview.validRows>();
    for (const row of preview.validRows) {
      const t = String((row.payload as { transactionType?: string })?.transactionType);
      byType.set(t, [...(byType.get(t) ?? []), row]);
    }
    expect(byType.get("buy")).toHaveLength(3);
    expect(byType.get("sell")).toHaveLength(1);
    expect(byType.get("dividend")).toHaveLength(1);
    expect(byType.get("interest")).toHaveLength(1);
    expect(byType.get("cashDeposit")).toHaveLength(1);

    const vwceBuy = byType.get("buy")![0].payload as Record<string, number>;
    expect(vwceBuy.quantity).toBe(100);
    expect(vwceBuy.price).toBe(100);
    expect(vwceBuy.grossAmount).toBeCloseTo(10_000, 2);
    expect(vwceBuy.fxRateToBase).toBeCloseTo(4.5, 4);
    expect(vwceBuy.fees).toBeCloseTo(10, 4);

    const sell = byType.get("sell")![0].payload as Record<string, number>;
    expect(sell.grossAmount).toBeCloseTo(4_400, 2);
    expect(sell.fxRateToBase).toBeCloseTo(4.6, 4);
    expect(sell.fees).toBeCloseTo(10, 4);
  });

  it("PKO: buys + funding + wykup przedterminowy z opłatą + odsetki + wypłata", () => {
    const preview = parsePkoBondsXls(PKO_ROWS, PORTFOLIO, REFERENCES);
    expect(preview.errorRows).toHaveLength(0);
    const payloads = preview.validRows.map((r) => r.payload as Record<string, unknown>);
    const ofType = (t: string) => payloads.filter((p) => p.transactionType === t);

    expect(ofType("buy")).toHaveLength(2);
    expect(ofType("sell")).toHaveLength(1);
    expect(ofType("interest")).toHaveLength(1);
    expect(ofType("cashWithdrawal")).toHaveLength(1);

    const sell = ofType("sell")[0];
    expect(sell.quantity).toBe(10);
    expect(sell.grossAmount).toBe(1000);
    expect(sell.fees).toBe(20);
    expect(ofType("interest")[0].grossAmount).toBe(95);
  });
});
```

Uwaga wykonawcza: nazwy pól payloadu (`transactionType` vs `type`) i to, czy PKO emituje syntetyczne wpłaty funding (parity z natywnym importerem!) potwierdź w `pko-parser.ts` — **jeśli web nie emituje wpłat funding, gotówka IKZE się nie zepnie z natywną; to finding do zgłoszenia**, a oczekiwaną gotówkę w Task 2 trzeba wtedy policzyć wariantowo (patrz Step 3 Task 2).

- [ ] **Step 3: Uruchom**

Run: `npx vitest run tests/unit/certification-import-parsers.test.ts`
Expected: PASS (2 testy).

- [ ] **Step 4: Commit**

```bash
git add tests/unit/certification-import-parsers.test.ts
git commit -m "test: certification-scenario parity for XTB/PKO import parsers"
```

---

### Task 2: Scenariusz — kwoty przez buildInvestorDataSnapshot (vitest)

**Files:**
- Create: `tests/unit/helpers/certification-records.ts`
- Create: `tests/unit/certification-scenario.test.ts`

**Interfaces:**
- Consumes: `buildInvestorDataSnapshot(records, { fxRates, asOf })`, `buildPortfolioDetail(records, portfolioID)` z `@/sync/records/investor-snapshot`; wzorzec rekordów z `src/sync/dev/fake-sync.ts` (payload `account`/`asset`/`transaction`).
- Produces: `buildCertificationRecords(): DecryptedRecord[]` — używany też w Task 3.

- [ ] **Step 1: Potwierdź kształty payloadów i wejścia cen/kursów**

Run:
```bash
grep -n "manualValuation" src/domain/models/investor-data.ts src/sync/records/investor-snapshot.ts | head
grep -n "FxRateInput" src/domain/valuation/price-resolver.ts
grep -n "bondParams\|depositParams" src/domain/models/investor-data.ts src/sync/records/investor-snapshot.ts | head
```
Expected: pola payloadu `manualValuation` (instrumentID, date, value…), kształt `FxRateInput` i sposób, w jaki snapshot czyta `bondParams`/`depositParams` z rekordów `asset`. Jeśli snapshot wycenia obligacje z katalogu emisji (`treasury-bond-issues.ts`) zamiast z payloadu — dodaj EDO0432/TOS0626 do danych wejściowych w taki sposób, jaki silnik faktycznie konsumuje (payload > katalog; nie modyfikuj katalogu produkcyjnego, jeśli test może podać parametry w rekordzie).

- [ ] **Step 2: Napisz helper `buildCertificationRecords`**

Wzorzec `record(type, id, payload)` skopiuj z `src/sync/dev/fake-sync.ts:30-48`. Zawartość: 3 rekordy `account` (tabela portfeli), rekordy `asset` (VWCE.DE/CSPX.UK/IEML.UK z walutami EUR/USD/GBP; EDO0432/TOS0626 `kind: "treasuryBond"` z `bondParams`; CDR/PKN/ALE `kind: "stock"` PLN; Lokata A/B `kind: "deposit"` z `depositParams`), wszystkie transakcje z sekcji „Transakcje scenariusza" (daty ISO `T10:00:00.000Z`), oraz rekordy `manualValuation` pinujące ceny latest (data 2026-06-30) dla: VWCE.DE 110, CSPX.UK 520, IEML.UK 22, CDR 112, PKN 64, ALE 32, Lokata B 15000.

```ts
// tests/unit/helpers/certification-records.ts — szkielet
import type { DecryptedRecord } from "@/sync/records/encrypted-records";
import type { RecordType } from "@/domain/models/investor-data";

export const IKE_ID = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA".toLowerCase();
export const IKZE_ID = "BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB".toLowerCase();
export const TAXABLE_ID = "CCCCCCCC-CCCC-4CCC-8CCC-CCCCCCCCCCCC".toLowerCase();

export const ASOF = new Date("2026-07-01T00:00:00.000Z");
export const FX = [
  { base: "EUR", quote: "PLN", date: "2026-07-01", rate: 4.6 },
  { base: "USD", quote: "PLN", date: "2026-07-01", rate: 4.2 },
  { base: "GBP", quote: "PLN", date: "2026-07-01", rate: 5.3 },
]; // dopasuj do FxRateInput ze Step 1

export function buildCertificationRecords(): DecryptedRecord[] {
  // record(...) + pełna lista rekordów wg sekcji "Transakcje scenariusza"
  // (accounts, assets z bondParams/depositParams, transactions, manualValuations)
  ...
}
```

(Pełna lista transakcji jest w sekcji „Transakcje scenariusza" — przepisz ją wiersz po wierszu; to dane, nie logika.)

- [ ] **Step 3: Napisz test kwot**

```ts
import { describe, expect, it } from "vitest";
import { buildInvestorDataSnapshot, buildPortfolioDetail } from "@/sync/records/investor-snapshot";
import { ASOF, FX, IKE_ID, IKZE_ID, TAXABLE_ID, buildCertificationRecords } from "./helpers/certification-records";

describe("certification scenario — web parity", () => {
  const records = buildCertificationRecords();
  const snapshot = buildInvestorDataSnapshot(records, { fxRates: FX, asOf: ASOF });
  const byId = new Map(snapshot.portfolios.map((p) => [p.id, p]));

  it("IKE: dokładne kwoty", () => {
    const ike = byId.get(IKE_ID)!;
    expect(ike.value).toBeCloseTo(108_037.10, 2);
    const detail = buildPortfolioDetail(records, IKE_ID)!;
    // pozycje: VWCE.DE 60 szt → 30 360; CSPX.UK 20 → 43 680; IEML.UK 50 → 5 830
    // dokładne pole (holdings/positions) potwierdź w typie PortfolioDetail
  });

  it("IKZE: dokładne kwoty (zapadła emisja wykupiona)", () => {
    expect(byId.get(IKZE_ID)!.value).toBeCloseTo(8_706.31, 2);
  });

  it("Zwykły: dokładne kwoty (lokata zamknięta rozliczona)", () => {
    expect(byId.get(TAXABLE_ID)!.value).toBeCloseTo(62_945.30, 2);
  });

  it("suma dashboardu", () => {
    expect(snapshot.totalValue).toBeCloseTo(179_688.71, 2);
  });
});
```

Rozszerz o asercje per instrument po potwierdzeniu kształtu `PortfolioDetail` (Step 1): market value każdej pozycji zgodnie z tabelą „Per instrument". Gotówkę per portfel asercjonuj polem cash z detail/snapshot (IKE 28 167.10; IKZE 4 148.05; zwykły 30 505.30).

- [ ] **Step 4: Uruchom**

Run: `npx vitest run tests/unit/certification-scenario.test.ts`
Expected: PASS. Rozbieżność = bug parity (np. inna wycena EDO, brak obsługi depositClose) — zgłoś z liczbami z tabeli, nie koryguj oczekiwań.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/helpers/certification-records.ts tests/unit/certification-scenario.test.ts
git commit -m "test: certification scenario exact per-portfolio amounts (web parity)"
```

---

### Task 3: Fake-sync e2e — kwoty widoczne w UI (Playwright)

Deterministycznie w UI asercjonujemy portfele PLN-owe (IKZE **8 706,31**, zwykły **62 945,30**) oraz obecność pozycji IKE; pełne kwoty IKE (zależne od FX) są przybite w Task 2 — w e2e sprawdzamy je tylko, jeśli fake-sync pinuje też kursy (Step 1 to rozstrzyga).

**Files:**
- Create: `src/sync/dev/certification-scenario.ts`
- Modify: miejsce wywołania `buildFakeSyncRecords()` (znajdź: `grep -rn "buildFakeSyncRecords" src/`)
- Create: `playwright.fake-sync-cert.config.ts`
- Create: `tests/e2e/fake-sync-cert/certification.spec.ts`

**Interfaces:**
- Consumes: `buildCertificationRecords()` z Task 2 (przenieś helper do `src/sync/dev/certification-scenario.ts`, a w testach unit reeksportuj stamtąd — jedna definicja danych).
- Produces: dataset `certification` włączany env `NEXT_PUBLIC_FAKE_SYNC_DATASET=certification`.

- [ ] **Step 1: Zbadaj konsumenta fake-sync i źródło kursów w tym trybie**

Run: `grep -rn "buildFakeSyncRecords\|NEXT_PUBLIC_FAKE_SYNC" src/ | grep -v ".test."`
Expected: jedno miejsce wyboru datasetu (store sync) + informacja, czy w trybie fake-sync kursy FX są mockowane. Jeśli FX idzie z sieci — w spec'u dodaj `page.route("**/api/market-data/**", ...)` zwracające stałe kursy 4.6/4.2/5.3, wtedy można asercjonować też IKE 108 037,10 i sumę 179 688,71.

- [ ] **Step 2: Dodaj dataset i przełącznik**

```ts
// src/sync/dev/certification-scenario.ts
export { buildCertificationRecords } from "...";
```
W miejscu z Step 1: `const records = process.env.NEXT_PUBLIC_FAKE_SYNC_DATASET === "certification" ? buildCertificationRecords() : buildFakeSyncRecords();`

- [ ] **Step 3: Konfiguracja Playwright**

```ts
// playwright.fake-sync-cert.config.ts — kopia playwright.fake-sync.config.ts z:
//   testDir: "./tests/e2e/fake-sync-cert"
//   command: "NEXT_PUBLIC_FAKE_SYNC=1 NEXT_PUBLIC_FAKE_SYNC_DATASET=certification npm run dev -- --port 3102"
//   baseURL/url: port 3102
```

- [ ] **Step 4: Spec**

```ts
import { expect, test } from "@playwright/test";

test("portfele pokazują dokładne kwoty scenariusza certyfikacyjnego", async ({ page }) => {
  await page.goto("/portfolios");
  const main = page.locator("main");

  await expect(main.getByText("IKZE Obligacje")).toBeVisible();
  await expect(main.getByText("8 706,31")).toBeVisible();

  await expect(main.getByText("Portfel zwykły")).toBeVisible();
  await expect(main.getByText("62 945,30")).toBeVisible();

  // IKE: pozycje obecne (kwoty PLN zależą od FX — patrz Task 3 Step 1)
  await page.goto("/positions");
  for (const symbol of ["VWCE.DE", "CSPX.UK", "IEML.UK", "EDO0432", "CDR", "PKN", "ALE"]) {
    await expect(page.getByText(symbol).first()).toBeVisible();
  }
});
```

Formatowanie liczb (`8 706,31` — twarda spacja?) potwierdź w `src/lib/money.ts` i dopasuj matcher (ew. regex `/8\s?706,31/`).

- [ ] **Step 5: Uruchom**

Run: `npx playwright test -c playwright.fake-sync-cert.config.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/sync/dev/certification-scenario.ts playwright.fake-sync-cert.config.ts tests/e2e/fake-sync-cert tests/unit/helpers/certification-records.ts
git commit -m "test(e2e): certification scenario dataset + exact amounts in fake-sync UI"
```

---

### Task 4: Weryfikacja uploadu prawdziwych plików przez stronę importu (manualna/e2e)

Strona importu dekoduje pliki przez `read-excel-file/browser` (patrz `src/features/import/import-page.tsx:147-177`) — ta biblioteka czyta **tylko XLSX**, a PKO to legacy BIFF8 `.xls`. Podejrzenie: upload `pko_cert_scenario.xls` (i każdego prawdziwego eksportu PKO) na webie kończy się błędem parsowania.

- [ ] **Step 1: Sprawdź ręcznie lub e2e**

W trybie fake-sync wejdź na stronę importu, format „PKO Obligacje", wgraj `~/Desktop/Zecca/Tests/Fixtures/Certification/pko_cert_scenario.xls` (Playwright: `page.setInputFiles`). Zanotuj wynik.

- [ ] **Step 2: Zgłoś wynik**

Jeśli upload pada — **nie naprawiaj w ramach tego planu**; zgłoś finding (web import PKO wymaga konwersji do XLSX albo parsera BIFF8) z krokami odtworzenia. Upload XTB XLSX (`xtb_cert_scenario.xlsx`) powinien działać — potwierdź, że preview pokazuje 7 poprawnych wierszy i te same kwoty co Task 1.

---

## Self-Review

- Te same dane wejściowe i oczekiwane kwoty co plan natywny (tabele zsynchronizowane); rozliczenia zapadłości wchodzą jako rekordy sync — zgodnie z produkcyjnym podziałem odpowiedzialności (generuje natywna apka).
- Świadome niedookreślenia (kształt `ImportReferenceData`, payload `manualValuation`, źródło FX w fake-sync) mają dedykowane kroki weryfikacyjne z konkretnymi komendami — wynik kroku determinuje kod, liczby pozostają niezmienne.
- Znane ryzyko zgłoszone z góry: PKO `.xls` vs `read-excel-file` (Task 4) oraz możliwy brak syntetycznych wpłat funding w webowym `pko-parser` (Task 1) — oba są findingami parity, nie powodem korekty oczekiwań.
