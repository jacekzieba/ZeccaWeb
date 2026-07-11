# Plan: odchylenie od planu + asystent rebalansingu

Domknięcie pętli **plan → dryf → widełki → lista zleceń** — rdzeń propozycji wartości
konkurencji (atlasETF „Kompas"), którego u nas brakuje. Bez zależności od zewnętrznych
danych: liczymy wyłącznie na tym, co już mamy w sync store.

Status: **spec, do realizacji później.** Nic tu jeszcze nie zaimplementowane.

## Punkt wyjścia (co już jest w kodzie)

- **Alokacja docelowa** — per-konto, `Record<AssetClassKey, number>` (procenty, tylko
  niezerowe zapisywane). Klucze: `equity | bonds | crypto | other | deposit | cash`.
  - Model + helpery: `src/features/portfolios/asset-classes.ts` (`ASSET_CLASSES`,
    `readAllocation`, `sumAllocation`, `emptyAllocation`).
  - Edytor: `src/features/portfolios/allocation-editor-modal.tsx` (zapis na rekord
    `account` przez `makeAccountPayload`, pole `targetAllocation`).
- **Alokacja bieżąca** — liczona w `src/sync/records/investor-snapshot.ts`:
  - `buildPortfolioDetail(records, portfolioId, opts)` → holdings z `kind` + `marketValue`
    + `totalValue` (per portfel).
  - `snapshot.allocation: AllocationSlice[]` (agregat, `{ label, percent }`).
- **Mapowanie `kind → klasa` jest dziś ZDUPLIKOWANE** i to trzeba scalić najpierw:
  - `src/features/positions/positions-page.tsx` `kindColor()` (kolory wg kind).
  - `src/sync/records/investor-snapshot.ts` `assetClassLabel()` (kind → polska etykieta).
  - Uwaga: etykiety z `assetClassLabel` i `ASSET_CLASSES.label` **pokrywają się**
    ("Obligacje", "Kryptowaluty", "Lokaty", "Gotówka", "Inne aktywa") poza `equity`,
    gdzie snapshot ma "Akcje / ETF" a asset-classes też "Akcje / ETF" — spójne.
    Mimo to bucketujmy po **kluczu**, nie po etykiecie.

## Decyzje do zatwierdzenia przed kodem

1. **Widełki (band) — per-portfel czy globalne?**
   Rekomendacja: pole `rebalanceBandPp` (domyślnie 5) na rekordzie `account` obok
   `targetAllocation`, z globalnym fallbackiem w Ustawieniach. Mirror do macOS — sprawdzić,
   czy natywna apka już takie pole ma (parytet: `/Users/jacek/Desktop/Zecca`).
2. **Rebalansing na poziomie klasy czy instrumentu?**
   Rekomendacja: **najpierw klasa** („dokup 4 200 PLN obligacji"). Sugestia konkretnego
   instrumentu to osobna, późniejsza faza (wymaga reguły wyboru: największy niedoważony
   holding danej klasy / preferowany ETF).

---

## Faza 0 — scalenie mapowania `kind → AssetClassKey`

Mały refactor, odblokowuje obie funkcje. TDD.

- Nowy `src/domain/allocation/asset-class.ts`:
  - `kindToAssetClass(kind: string | undefined): AssetClassKey`
    (`etf|stock → equity`, `treasuryBond|listedBond → bonds`, `crypto`, `deposit`,
    `cash`, reszta → `other`).
- Przepiąć `assetClassLabel()` (snapshot) i `kindColor()` (positions) na wspólne źródło:
  etykieta = `ASSET_CLASSES.find(key).label`, kolor = `.color`. Zero zmian zachowania —
  test charakteryzujący na obecne wyjścia.

Weryfikacja: `npm test` (nowe unit) + brak zmian w istniejących snapshotach.

---

## Faza 1 — odchylenie od planu (hak „Kompas")

Czysta domena + UI. Bez nowych źródeł danych.

### Domena — `src/domain/allocation/allocation-drift.ts`
Deep module, testowany przez publiczny interfejs (fixtures holdings + target).

```ts
type ClassDrift = { key: AssetClassKey; targetPct: number; actualPct: number; driftPp: number };
type DriftResult = {
  rows: ClassDrift[];        // po jednej na klasę występującą w target LUB actual
  maxAbsDriftPp: number;
  withinBand: boolean;       // maxAbsDriftPp <= bandPp
  hasTarget: boolean;        // false => portfel bez planu, UI chowa panel
};

function computeActualAllocation(detail: PortfolioDetail): Record<AssetClassKey, number>;
function computeDrift(
  target: Record<AssetClassKey, number>,
  actual: Record<AssetClassKey, number>,
  bandPp: number,
): DriftResult;
```

- `computeActualAllocation`: bucketuj `holdings[].marketValue` przez `kindToAssetClass`,
  znormalizuj do % względem `totalValue` (gotówka portfela → `cash`).
- Agregat wielu portfeli: osobna funkcja `aggregateDrift(details, targetsById, bandById)`
  — ważona wartością; portfele bez planu pomijane.

### UI
- **Portfel (detail)** — panel „Plan vs rzeczywistość":
  `src/features/portfolios/portfolio-detail-page.tsx`. Per-klasa: pasek target vs actual
  + chip dryfu (`+3,2 p.p.`), nagłówkowy status „w widełkach ±5" / „poza planem"
  (kolory `V2.profit`/`V2.loss`). Wzorzec wizualny: hero-KPI z makiety konkurencji.
- **Dashboard** — nowy kafelek w rejestrze w `src/features/dashboard/dashboard-overview.tsx`
  (lista ~w. 105–119): `{ id: "planDrift", label: "Odchylenie od planu",
  category: "metrics", icon: Compass, sizePresets: [{ width: 1 }, { width: 2 }] }`.
  Treść: `maxAbsDriftPp` + „w widełkach ±N". Agregat po portfelach z planem.
- **Ustawienia / edytor alokacji** — kontrolka widełek `rebalanceBandPp` (domyślnie 5).

Weryfikacja: unit na drift (w tym `hasTarget=false`, portfel 100% gotówki, klasa tylko
w actual). Fake-sync E2E na kafelek (wzór: istniejący E2E `manualValuation`).

---

## Faza 2 — asystent rebalansingu

### Domena — `src/domain/allocation/rebalance.ts`

```ts
type Mode = "buyOnly" | "full";
type Order = {
  key: AssetClassKey;
  action: "buy" | "sell";
  amount: number;            // w walucie bazowej
  resultingDriftPp: number;
};
type RebalancePlan = {
  orders: Order[];
  postMaxDriftPp: number;
  estimatedTax: number;      // 0 dla buyOnly i dla IKE/IKZE
  taxNote?: string;
};

function planRebalance(input: {
  target: Record<AssetClassKey, number>;
  currentByClass: Record<AssetClassKey, number>;  // wartości, nie %
  newContribution: number;                        // świeża gotówka do rozdania
  mode: Mode;
  accountType?: string;                           // IKE/IKZE => bez podatku
}): RebalancePlan;
```

- **`buyOnly` (domyślny, hak „zero podatku")**: nigdy nie sprzedaje. Rozdaje
  `newContribution` (+ istniejącą gotówkę, jeśli chcemy) na klasy niedoważone tak, by
  zminimalizować `maxAbsDriftPp`. `estimatedTax = 0` zawsze.
- **`full` (mieszany)**: dopuszcza sprzedaż przeważonych klas. Na koncie standardowym
  szacuj Belkę 19% od **zrealizowanego zysku** sprzedawanej części; na IKE/IKZE → 0.
  - Zależność: prospektywny koszt FIFO sprzedawanej partii. FIFO/realized-PnL już istnieje
    w `investor-snapshot.ts` (patrz `realizedPnl`) — wydzielić re-używalny helper kosztu
    bazowego. **To jedyny nietrywialny fragment fazy 2** — dlatego `full` po `buyOnly`.

### UI
- Akcja „Rebalansuj" na portfelu → modal (wzór: `allocation-editor-modal.tsx`):
  wybór trybu (domyślnie „tylko dokupowanie"), kwota nowej wpłaty, lista zleceń
  klasami + nota podatkowa. To odpowiednik ich „gotowy plan z listą zleceń".

Weryfikacja: unit na `planRebalance` (buyOnly nie sprzedaje; full liczy Belkę; IKE/IKZE
zeruje podatek; suma zleceń = wpłata w buyOnly). E2E na modal.

---

## Faza 3 — opcjonalne, odłożone

- Zlecenia na poziomie instrumentu (nie klasy).
- Druga linia „Plan modelowy" na wykresie wartości (`value-vs-deposits-chart.tsx`
  → wariant `value-vs-plan`) — wymaga modelowanej serii wartości planu, cięższe.
- Alerty mailowe o wyjściu poza widełki — wymaga backendu (dziś alerty tylko w przeglądarce).

## Kolejność i koszt

| Faza | Zakres | Koszt | Dane zewn. |
|------|--------|-------|-----------|
| 0 | scalenie `kind→class` | niski | brak |
| 1 | dryf + widełki + kafelek | niski/średni | brak |
| 2a | rebalansing buyOnly | niski/średni | brak |
| 2b | rebalansing full + Belka | średni | brak (FIFO wewn.) |
| 3 | instrument-level / linia planu / alerty | średni/wysoki | częściowo |

Rekomendacja: 0 → 1 → 2a to samodzielny, wartościowy przyrost (cały hak „Kompas"
bez podatkowej złożoności). 2b i 3 jako osobne iteracje.
