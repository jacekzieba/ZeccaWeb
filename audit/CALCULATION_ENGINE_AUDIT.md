# Zecca Web — Audyt silnika obliczeniowego

**Wniosek: silnik jest wiarygodny i deterministyczny**, zbudowany jako czysta warstwa domenowa (`src/domain/*`) bez zależności od sync/UI, pokryty 334 testami jednostkowymi z parytetem względem natywnej aplikacji Zecca (macOS/iOS). Jedno istotne zastrzeżenie: cichy fallback wyceny obligacji przy braku danych makro ([BOND-STALE-FALLBACK], MEDIUM).

Miejsce wykonania: **wszystkie obliczenia w przeglądarce** (klient odszyfrowuje dane w pamięci karty, potem liczy). Serwer nie liczy portfela (zero-knowledge). Backend natywny (`/Users/jacek/Desktop/Zecca`) jest źródłem prawdy parytetu — testy `macos-payloads`, `macos-refactor-fixtures`, `certification-scenario` to egzekwują.

## Mapa obliczeń

| Funkcja | Plik:linia | Cel | Wejście | Jednostki | Determinizm |
| --- | --- | --- | --- | --- | --- |
| `computeXirr` | portfolio-metrics.ts:25 | MWRR annualizowana | cashflows (data, kwota znak.) | ułamek (0.12=12%) | tak |
| `computeMaxDrawdownPct` | portfolio-metrics.ts:91 | max obsunięcie | seria wartości | % (≤0) | tak |
| `computeTotalReturnPct` | portfolio-metrics.ts:108 | zwrot na kapitale | wartość, netInvested | % | tak |
| `computeRealReturnPct` | portfolio-metrics.ts:120 | zwrot realny | nominal%, inflacja% | % | tak |
| `resolveInstrumentPrice` | price-resolver.ts:56 | cena instrumentu | manual/market/tx | waluta instrumentu | tak |
| `resolveFxRate` | price-resolver.ts:128 | kurs do PLN | historia/tx/konwersja | mnożnik→PLN | tak |
| `valueInstrumentPosition` | position-valuator.ts:86 | wartość pozycji | lots, dataset, asOf | PLN | tak |
| `dirtyTreasuryBondPrice` | position-valuator.ts:207 | brudna cena obligacji | params, daty, cpi, stopy | PLN/szt | tak |
| `bondPeriodRate` | bond-rates.ts:112 | stopa okresu kuponu | params, index, data | %/rok | tak |
| `inflationReferenceRate` | bond-rates.ts:89 | CPI r/r okresu (m-2) | data, CPI | % | tak |

## Weryfikacja poszczególnych obszarów

### XIRR (`computeXirr`)
- Filtruje zerowe/niefinite, sortuje po dacie, wymaga ≥2 przepływów o różnych znakach (inaczej `null`) — poprawne warunki rozwiązywalności.
- Newton-Raphson (60 iter, |NPV|<1e-7), z ochroną przed dywergencją (`next<=-0.9999`), potem **bisekcja** na `[-0.9999, 10]` gdy `f(lo)*f(hi)<0`. Solidne i zbieżne; brak nieskończonych pętli (stałe limity).
- **Day-count Actual/365** (`MS_PER_YEAR=365d`), zgodne z Excel XIRR; lata przestępne nieważone ([XIRR-DAYCOUNT], INFO). Własność: identyczne wejście → identyczny wynik (deterministyczne), `null` dla degeneracji. Brak `NaN` na wyjściu (odrzucane wcześniej).

### Rozstrzyganie ceny (`resolveInstrumentPrice`)
- Priorytet: wycena ręczna → cena rynkowa → cena transakcyjna → `missing(0, PLN)`. `latestBeforeOrOn` bierze najnowszą ≤ dacie wyceny. `EPSILON=1e-6` odrzuca ceny ~0. Poprawne, przewidywalne.

### FX (`resolveFxRate`)
- PLN → 1. Priorytet: historia NBP → kurs transakcyjny (`fxRateToBase`) → konwersja (`grossAmount`/`target`) → konwersja odwrotna → `missing(1)`. Uwaga projektowa: fallback `missing` zwraca **rate=1** — dla waluty obcej bez danych to potencjalne zafałszowanie (traktowanie obcej kwoty jak PLN). W praktyce dane FX są dociągane; warto dodać ostrzeżenie analogiczne do luk obligacji. (POTENTIAL, LOW — nieujęte osobno; do rozważenia.)

### Akrual obligacji detalicznych (`dirtyTreasuryBondPrice`)
- Normalizacja do `startOfUtcDay` (stabilność niezależna od godziny importu). Okresy od `issueDate` (fallback purchaseDate dla starych payloadów). `periodMonths` 1 (co miesiąc) lub 12. `periodYearFraction` = 1 dla rocznych, `dni/365` dla miesięcznych.
- Kapitalizacja: „przy wykupie" + „roczna" → dopisywanie do principal; inaczej `carriedInterest`. Odsetki naliczane liniowo w obrębie okresu (`min(elapsed/total, 1)`). `roundToGrosz` (pół-do-góry z `Number.EPSILON`) na wynik.
- Zgodne z regułami detalicznych obligacji skarbowych; wartości zweryfikowane wstecznie (komentarz + testy `bond-valuation`, `legacy-bond-import-valuation`, `bond-daily-change`).

### Stopa okresu (`bondPeriodRate`) i dane makro
- Okres 0 = stopa emisyjna; „stałe" = marża; „stopa referencyjna NBP" = `max(0, NBP+marża)`; inaczej = `max(0, CPI_{m-2})+marża`. Ujemna inflacja → 0 (zgodne z regułami).
- **Fallback:** brak CPI/NBP → `max(0, marża)` (zaniżenie). Detektor `bondPeriodHasMacroData` / `treasuryBondMacroGaps` (position-valuator.ts:275) wykrywa luki bez dotykania matematyki. **[BOND-STALE-FALLBACK]** — potwierdzić ekspozycję ostrzeżenia w każdym widoku.

## Strategia precyzji i zaokrągleń
- Typ `number` (IEEE 754 double) w całym silniku. **Ocena skali błędu:** kwoty portfela i akrual mieszczą się w bezpiecznym zakresie double (≤ ~9e15 groszy); `AMOUNT_MAGNITUDE_CAP=1e12` ogranicza wejście. Zaokrąglenie do grosza (`roundToGrosz`) na granicach wyceny obligacji. Dla typowych portfeli błąd IEEE 754 jest poniżej grosza — akceptowalne. **Nie zalecamy** przechodzenia na bibliotekę dziesiętną jako P0 (koszt > korzyść przy obecnej skali i parytecie); rozważyć reprezentację w groszach dla eksportów/podatków jeśli pojawią się kwoty rzędu setek mln.
- Display: `formatCurrency` ukrywa grosze ([CURRENCY-FMT]) — nie wpływa na matematykę.

## Zależności od danych z API
- CPI/NBP: tabele fallback w `bond-rates.ts` (CPI do 2026-06, NBP do 2026-03) + live bootstrap (`MarketReferenceRateBootstrap`). FX: NBP. Ceny: Yahoo. Wszystko z timestampem i cache (TTL). Rozróżnienie źródła w `PositionValuation.source` + etykieta.
- Ryzyko: wynik na starym/fallbackowym zbiorze nie może wyglądać na aktualny — patrz [BOND-STALE-FALLBACK] i uwaga o FX `missing=1`.

## Przypadki brzegowe (ocena)
- Zerowa stopa → wartość = nominał (brak odsetek) ✓. Wkład rośnie → wartość nie maleje (monotoniczność akrualu) ✓. Zmiana kolejności wejść nie zmienia wyniku (`latestBeforeOrOn`, sort) ✓. Odświeżenie strony nie zmienia wyniku (determinizm) ✓. Bardzo długie okresy: pętla po okresach ograniczona `effectiveAsOf ≤ maturity` ✓. `NaN`/Inf: odrzucane w `parseAmount`/filtrach ✓.

## Niezależna weryfikacja (wykonana)
- Uruchomiono pełny zestaw: `bond-valuation` (11), `investor-snapshot` (28), `realized-pnl` (4), `price-resolver` (9), `bond-cpi-injection`, `bond-reference-rate-injection`, `certification-scenario`, `portfolio-valuation-consistency` — **wszystkie PASS**. Testy wstrzykują syntetyczne CPI/stopy i sprawdzają parytet oraz właściwości.

## Różnice klient–serwer
- Brak — serwer nie liczy portfela. Parytet dotyczy klient-web ↔ natywna aplikacja (nie web-serwer). Kontrakt sync (`AMOUNT_MAGNITUDE_CAP`, typy accountType „IKE"/„IKZE", envelope) współdzielony i testowany (`ike-ikze-usage`, `macos-payloads`, `settings-payload`).

## Brakujące/rekomendowane testy
1. Test propagacji flagi luk makro do UI (dashboard/pozycje/raporty) — dla [BOND-STALE-FALLBACK].
2. Golden test XIRR vs Excel na referencyjnym zestawie (udokumentować day-count).
3. Property-based: monotoniczność wartości względem wkładu; zwrot realny vs nominalny; niezmienniczość względem kolejności FX.
4. Test zachowania FX `missing` (czy `rate=1` jest oznaczane jako „brak kursu" w UI).
5. Tabela `parse-amount` z separatorami ([PARSE-AMOUNT-SEP]).

## Ocena wiarygodności wyników
**Wysoka** dla ścieżek z kompletem danych (ceny, FX, CPI/NBP dostępne). **Warunkowa** na ścieżce fallbacku obligacji — wynik pozostaje deterministyczny, ale zaniżony i wymaga jawnego oznaczenia w UI, aby nie wprowadzać użytkownika w błąd co do aktualności.
