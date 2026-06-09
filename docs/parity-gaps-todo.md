# InvestorWeb — braki parytetowe vs natywne aplikacje

Projekt to aplikacja Next.js w `/Users/jacek/Desktop/InvestorWeb`.  
Natywne aplikacje (macOS + iOS) siedzą w `/Users/jacek/Desktop/Investor`.  
Poniższe zadania wyrównują braki zidentyfikowane po porównaniu trzech platform.

---

## 1. Import brokerów — XTB i PKO Obligacje

**Problem**: Web obsługuje tylko generyczny CSV/XLSX według własnego szablonu. Natywne aplikacje mają dedykowane parsery dla:
- **XTB** — plik XLSX z historią rachunku (Konto → Historia rachunku → Eksport)
- **PKO Obligacje** — plik XLS z serwisu zakup.obligacjeskarbowe.pl (Historia dyspozycji → Eksport)

**Logika natywna do przeniesienia**:
- `Sources/InvestorDomain/BrokerImport/XTBImporter.swift`
- `Sources/InvestorDomain/BrokerImport/PKOBondsImporter.swift`

**Gdzie w web**: `src/features/import/import-parser.ts` + `app/(app)/import/page.tsx`

**Zadanie**: Dodaj dwa dedykowane parsery w TypeScript i opcję wyboru formatu importu (Generic CSV | XTB XLSX | PKO Obligacje XLS). Parser powinien zwracać te same struktury co obecny `parseTransactionTable`.

---

## 2. Eksport — 4 brakujące datasety

**Problem**: Web eksportuje tylko:
- CSV transakcji (`exportTransactionsCsv`)
- JSON snapshot (`exportSnapshotJson`)

Natywne aplikacje eksportują 5 datasetów:
1. Transakcje CSV ✅
2. **Snapshoty dzienne CSV** — brak w web
3. **Dywidendy/Odsetki CSV** — brak w web
4. **Pozycje na dziś CSV** — brak w web
5. **Konfiguracja JSON** — brak w web (natywna eksportuje AppSettings)

**Gdzie**: `src/features/import/import-page.tsx` → sekcja `tab === "export"`

**Zadanie**: Dodaj eksport dla 3 brakujących datasetów CSV (snapshoty, dochody, pozycje). Konfigurację można pominąć — jest specyficzna dla natywnych ustawień.

---

## 3. Ustawienia — brakujące sekcje

**Problem**: Web ma skromne ustawienia vs natywne. Brakuje:

### 3a. Dane rynkowe
Natywne mają: wybór providera FX (NBP / Yahoo), klucz API CoinGecko, toggle auto-odświeżania.  
**Gdzie w web**: `src/features/settings/settings-page.tsx`  
Web już pobiera dane z własnych API routes (`/api/market-data/fx`, `/api/market-data/quote`). Wystarczy toggle auto-refresh i klucz CoinGecko (jeśli jest używany).

### 3b. Wynik realny po inflacji
Toggle w sekcji "Wyświetlanie" — czy KPI i wykresy pokazują wynik nominalny czy realny (po odjęciu inflacji YOY).  
Natywne: `store.appSettings.showRealReturn: Bool`

### 3c. Prywatność / diagnostyka
Toggle telemetrii (TelemetryDeck w natywnych). W web można pominąć jeśli brak analogicznego systemu, albo dodać prosty toggle do `localStorage`.

---

## 4. App Lock / ochrona biometryczna

**Problem**: Natywne aplikacje (macOS + iOS) mają ekran blokady z Face ID / Touch ID / hasłem.  
Web nie ma żadnej ochrony po zalogowaniu.

**Zakres MVP**: Dodaj opcjonalny PIN (4–6 cyfr) przechowywany w `sessionStorage`, który jest wymagany po:
- odświeżeniu strony
- powrocie po utracie focusu (Page Visibility API, po N minutach)

**Gdzie**: Nowy komponent `src/features/auth/app-lock.tsx` + hook w `src/providers/providers.tsx`.

Biometria przeglądarki (WebAuthn) jest opcjonalna jako bonus.

---

## 5. Dedykowana strona Pozycji / Holdingów

**Problem**: Web nie ma osobnej strony z listą wszystkich pozycji (holdings). Dashboard ma `HoldingsCard` z uproszczonym widokiem, ale brak:
- filtrów wg klasy aktywów
- sortowania kolumn
- drill-down do transakcji danego instrumentu

**iOS odpowiednik**: `MobilePositionsView` (tab "Pozycje")  
**macOS odpowiednik**: nowo dodany `PositionsView.swift`

**Zadanie**: Dodaj nową stronę `/positions` z:
- Tabelą pozycji (symbol, nazwa, klasa, ilość, wartość, P&L%, zmiana 30D)
- Filtrem wg klasy aktywów (tak jak iOS filter strip: Wszystkie / ETF / Akcje / Krypto / Obligacje / Lokaty)
- Możliwością kliknięcia w pozycję → sheet z listą transakcji dla danego instrumentu
- Dodaj link w nawigacji (`app-shell.tsx`, sekcja "Dane")

---

## 6. Brakujące widgety dashboardu

**Problem**: Dashboard web ma stały layout bez konfiguracji. Natywne mają 30+ konfigurowalnych sekcji.

**Najpilniejsze braki** (widgety obecne na macOS i iOS, brak na web):
1. **Wykres podziału walut** — `chartCurrencyBreakdown`
2. **Wykres dywidend** — `chartDividends` (bar chart po miesiącach/kwartałach)
3. **Wykres odsetek** — `chartInterest`
4. **Wykres P&L w czasie** — `chartPnLOverTime`
5. **Drawdown w czasie** — `chartDrawdown`
6. **Benchmark vs inflacja** — `chartBenchmarkVsInflation` (linia portfela vs YOY CPI)

Obecne wykresy w `src/components/charts/` (AreaChart, AllocationDonut) są dobrą bazą.

**Uwaga**: Miesięczny P&L (MonthlyCard) na web ma **dane mockowe** (`MONTHLY_PROFIT`, `MONTHLY_LOSS` — hardcoded w `dashboard-overview.tsx:115-116`). Należy podpiąć pod rzeczywiste dane ze store.

---

## 7. Konfigurowalność dashboardu

**Problem**: Web ma stały layout dashboardu. Natywne mają możliwość ukrywania/pokazywania widgetów i zmiany kolejności.

**Zakres MVP**: Prosty toggle per-widget zapisywany w `localStorage`. Nie trzeba drag-and-drop.

Wzorzec: `MobileSectionConfigStore` (iOS) — klucz w UserDefaults per-surface, lista widocznych sekcji.

---

## Kolejność realizacji (sugestia)

1. **Import XTB/PKO** (#1) — najczęściej potrzebne przez użytkownika
2. **Strona Pozycji** (#5) — pełny widok holdingów
3. **Eksport brakujące datasety** (#2) — proste rozszerzenie istniejącego kodu
4. **Brakujące widgety + fix MonthlyCard** (#6) — wzbogacenie dashboardu
5. **Brakujące ustawienia** (#3) — wynik realny i market data
6. **App Lock** (#4) — bezpieczeństwo
7. **Konfigurowalność dashboardu** (#7) — comfort feature

---

## Kontekst techniczny

- **Sync store**: `src/sync/store/sync-store.ts` — stamtąd pochodzi `snapshot` ze wszystkimi danymi (transakcje, pozycje, portfele)
- **Dane szyfrowane**: `src/sync/encryption/` — dane w Supabase są zaszyfrowane AES-GCM
- **Market data API**: `app/api/market-data/` (fx, quote, status) — server-side, klient używa przez fetch
- **Design system**: `src/lib/v2-design.tsx` — kolory, typografia, komponenty (`V2Card`, `V2Button`, itp.)
- **Natywna logika domeny**: Swift w `/Users/jacek/Desktop/Investor/Sources/InvestorDomain/` — używaj jako specyfikację, nie port kodu
