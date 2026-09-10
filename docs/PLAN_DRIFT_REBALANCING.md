# Plan: alokacja docelowa vs aktualna (+ ewent. rebalansing)

Domknięcie pętli **plan → dryf**, którą konkurencja (atlasETF „Kompas") stawia w centrum.
Bez zależności od zewnętrznych danych: liczymy na tym, co już jest w sync store.

**Zasada nadrzędna: parytet z natywną apką** (macOS/iOS, `/Volumes/T5/Zecca` — źródło prawdy).
Ta funkcja **już istnieje natywnie** — web ma ją odtworzyć, nie wymyślić od nowa.

Status: **spec, do realizacji później.** Nic tu jeszcze nie zaimplementowane.

## Parytet — co natywna apka JUŻ ma (i czego nie ma)

Sekcja **„DOCELOWA VS AKTUALNA"**:
- `Sources/InvestorApp/SectionRenderer.swift` (~w. 740–800) — sekcja + `currentAllocation`
  / `targetAllocation` (per-portfel oraz agregat ważony wartością portfeli).
- `Sources/InvestorApp/ReportsView.swift` — `struct AllocationGapRow` (render wiersza).
- `Sources/InvestorMobileUI/MobileBenchmarkCards.swift` — wariant mobilny.

Model (parytet potwierdzony 1:1 z webem):
- `AssetClass` = `equity | bonds | crypto | other | deposit | cash`
  (`Sources/InvestorDomain/Models.swift`) — identyczne z web `AssetClassKey`.
- `InstrumentKind.assetClass`: `stock, etf → equity`; `treasuryBond, listedBond → bonds`;
  `crypto → crypto`; `otherAsset → other`; `deposit → deposit`; `cash → cash`.
- `Portfolio.targetAllocation: [AssetClass: Double]`, synchronizowane jako `[String: Double]`
  (rawValue). Odpowiada web `Record<AssetClassKey, number>`.

Zachowanie `AllocationGapRow` do skopiowania **dokładnie**:
- Wiersz: kropka koloru + etykieta + `aktualna% / docelowa%` (2 miejsca) + delta `+X,XXpp`.
- **Próg neutralności zaszyty = 1 p.p.**: `abs(delta) < 1` → kolor drugorzędny (szary);
  `delta > 0` → profit; `delta < 0` → loss. **Nie ma pola widełek — nie dodawać go.**
- Pasek: wypełnienie = aktualna%, pionowy znacznik (navy) na pozycji docelowej%.
- Brak planu (`suma target < 0.01`) → tekst dosłownie:
  „Brak ustawionej alokacji docelowej. Ustaw w Ustawieniach → Portfele."

Czego natywna apka **NIE** ma (istotne dla zakresu):
- **Konfigurowalnych widełek / tolerancji** na alokację (próg 1 p.p. jest zaszyty w UI,
  nie jest polem modelu ani nie jest synchronizowany). → web też nie wprowadza takiego pola.
- **Rebalansingu** w żadnej formie (0 trafień w Swift). → patrz „Rozbieżność" niżej.
- Framingu „w widełkach ±5" / hero-KPI odchylenia — to pomysł atlasETF, nie nasz.

## Punkt wyjścia w webie (co już mamy)

- `targetAllocation` per-konto + edytor: `src/features/portfolios/asset-classes.ts`,
  `allocation-editor-modal.tsx`. Klucze pokrywają się z natywnym enumem.
- Alokacja bieżąca: `src/sync/records/investor-snapshot.ts` —
  `buildPortfolioDetail()` (holdings: `kind` + `marketValue`, `totalValue`),
  `snapshot.allocation: AllocationSlice[]`.
- **Mapowanie `kind → klasa` zduplikowane** i do scalenia (Faza 0):
  `positions-page.tsx` `kindColor()` oraz `investor-snapshot.ts` `assetClassLabel()`.

---

## Faza 0 — scalenie mapowania `kind → AssetClassKey`

Mały refactor, odblokowuje reszcie. TDD.

- Nowy `src/domain/allocation/asset-class.ts`:
  - `kindToAssetClass(kind): AssetClassKey` — **wg natywnego `InstrumentKind.assetClass`**:
    `etf|stock → equity`, `treasuryBond|listedBond → bonds`, `crypto`, `otherAsset → other`,
    `deposit`, `cash`, nieznane → `other`.
- Przepiąć `assetClassLabel()` i `kindColor()` na wspólne źródło (etykieta/kolor z
  `ASSET_CLASSES`). Zero zmian zachowania — test charakteryzujący.

Weryfikacja: `npm test`; brak zmian w istniejących snapshotach.

---

## Faza 1 — „Docelowa vs aktualna" (port natywnej sekcji)

Odtworzenie natywnej sekcji 1:1. Bez nowych źródeł danych, bez nowych pól sync.

### Domena — `src/domain/allocation/allocation-gap.ts`
Deep module, testowany przez publiczny interfejs (fixtures). Nazwy/semantyka jak w Swift.

```ts
type GapRow = {
  key: AssetClassKey;
  targetPct: number | null;   // null => brak planu
  actualPct: number;
  deltaPp: number | null;     // actual - target; null gdy brak planu
};
type AllocationGap = {
  rows: GapRow[];             // po jednej na każdą AssetClassKey (jak AssetClass.allCases)
  hasTarget: boolean;         // suma target >= 0.01
};

// odpowiednik natywnego currentAllocation: bucket holdings przez kindToAssetClass,
// normalizacja do % względem totalValue (gotówka portfela → cash)
function computeActualAllocation(detail: PortfolioDetail): Record<AssetClassKey, number>;

// odpowiednik natywnego targetAllocation getter: per-portfel wprost,
// agregat = średnia ważona wartością portfeli
function aggregateTarget(details, targetsById): Record<AssetClassKey, number>;

function buildAllocationGap(target, actual): AllocationGap;
```

Próg neutralności **1 p.p. zaszyty** (jak natywnie) — nie parametryzować.

### UI
- Komponent `AllocationGapRow` (web) — wizual jak Swift: kropka + etykieta +
  `aktualna / docelowa` + delta `+X,XXpp` (neutralny gdy `|Δ|<1`), pasek + znacznik celu.
- Umiejscowienie **zgodnie z natywnym**: sekcja „Docelowa vs aktualna" w Raportach
  (`src/features/reports/reports-page.tsx`, gdzie natywnie żyje) — oraz opcjonalnie na
  portfelu (`portfolio-detail-page.tsx`). Empty-state: kopia dosłowna z natywnej.
- Dashboard-kafelek jest **opcjonalny i web-only** (natywnie go nie ma) — jeśli robimy,
  to jako skrót do sekcji, nie jako nowy „hero-KPI odchylenia".

Weryfikacja: unit na gap (brak planu; portfel 100% gotówki; klasa tylko w actual;
próg 1pp). Fake-sync E2E (wzór: istniejący E2E `manualValuation`).

---

## Faza 2 — asystent rebalansingu (web-first, prezentacyjny)

**Świadoma rozbieżność z natywną apką** (rebalansingu tam nie ma). Dopuszczalna, bo funkcja
jest **wyłącznie prezentacyjna: nic nie zapisuje do sync** → parytet *danych* nienaruszony,
rozjeżdża się tylko zestaw funkcji. Gdy rebalansing powstanie natywnie, wrócić tu po parytet
zachowania. **Twarda reguła: żaden kod tej fazy nie tworzy ani nie modyfikuje rekordów sync.**

### Domena — `src/domain/allocation/rebalance.ts`
Deep module, pure, testowany przez publiczny interfejs. Bierze wynik `computeActualAllocation`
z Fazy 1 — nie duplikuje bucketowania.

```ts
type Mode = "buyOnly" | "full";
type Order = {
  key: AssetClassKey;
  action: "buy" | "sell";
  amount: number;            // waluta bazowa
  resultingDriftPp: number;
};
type RebalancePlan = {
  orders: Order[];
  postMaxDriftPp: number;
  estimatedTax: number;      // 0 dla buyOnly oraz dla IKE/IKZE
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

- **`buyOnly` (domyślny, hak „zero podatku")** — nigdy nie sprzedaje. Rozdaje
  `newContribution` na klasy niedoważone tak, by zminimalizować `postMaxDriftPp`.
  `estimatedTax = 0`. Prosty, bez zależności — robimy najpierw.
- **`full` (mieszany)** — dopuszcza sprzedaż przeważonych klas. Konto standardowe:
  szacuj Belkę 19% od zrealizowanego zysku sprzedawanej części; IKE/IKZE → 0.
  - Zależność: prospektywny koszt FIFO sprzedawanej partii. FIFO/realized-PnL już jest
    w `investor-snapshot.ts` (`realizedPnl`) — wydzielić re-używalny helper kosztu bazowego.
    **Jedyny nietrywialny fragment — dlatego `full` po `buyOnly`.**
  - `accountType` porównywać **case-insensitive** ("IKE"/"IKZE" z realnego sync vs kody
    fake-sync — patrz notatka pamięci „accountType rawValue drift").

### UI
- Akcja „Rebalansuj" na portfelu → modal **read-only** (wzór wizualny:
  `allocation-editor-modal.tsx`, ale **bez ścieżki zapisu** — brak `saveRecord`,
  brak `applyFake*`). Wejście: tryb (domyślnie „tylko dokupowanie") + kwota wpłaty.
  Wyjście: lista zleceń klasami + nota podatkowa. To odpowiednik atlasowego
  „gotowy plan z listą zleceń".
- Zlecenia na **poziomie klasy** (np. „dokup 4 200 PLN obligacji"); mapowanie na konkretny
  instrument to osobna, późniejsza faza.

Weryfikacja: unit na `planRebalance` (buyOnly nie sprzedaje; suma zleceń buyOnly = wpłata;
full liczy Belkę; IKE/IKZE zeruje podatek). E2E potwierdza brak zapisu do sync po użyciu modala.

## Faza 3 — opcjonalne, odłożone

- Zlecenia na poziomie instrumentu (nie klasy).
- Druga linia „plan modelowy" na wykresie wartości — wymaga modelowanej serii, cięższe.
- Alerty mailowe o dużym odchyleniu — wymaga backendu (dziś alerty tylko w przeglądarce).

## Kolejność i koszt

| Faza | Zakres | Koszt | Parytet |
|------|--------|-------|---------|
| 0 | scalenie `kind→class` | niski | wg `InstrumentKind.assetClass` |
| 1 | port „Docelowa vs aktualna" | niski | 1:1 z natywną sekcją |
| 2a | rebalansing `buyOnly` (prezentacyjny) | niski/średni | web-first, brak zapisu do sync |
| 2b | rebalansing `full` + Belka | średni | web-first, brak zapisu do sync |
| 3 | instrument-level / linia planu / alerty | średni/wysoki | częściowo |

Rekomendacja: 0 → 1 → 2a to samodzielny, wartościowy przyrost (cały hak „Kompas" bez
podatkowej złożoności). 2b i 3 jako osobne iteracje.
