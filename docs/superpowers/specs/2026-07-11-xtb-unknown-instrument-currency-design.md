# XTB import — waluta dla nieznanych zagranicznych instrumentów

**Data:** 2026-07-11
**Zakres:** `src/features/import/xtb-parser.ts` + test w `tests/unit/certification-import-parsers.test.ts`

## Problem

Webowy importer XTB dla instrumentu nieobecnego w `references.instruments`
tworzy nowy instrument z `currency: "?"` (funkcja `resolveOrCreateInstrument`),
i tę samą `"?"` dostaje transakcja buy/sell. FX jest wyliczany poprawnie
(`|Amount| / (qty×price)` dla nie-PLN), więc koszt w PLN jest zachowany — ale
sama etykieta waluty jest nieznana, co psuje późniejszą wycenę pozycji (brak
kursu dla waluty `"?"`) i wyświetlanie.

Znane instrumenty (niosące `currency`) już działają — problem dotyczy wyłącznie
nieznanych.

## Parytet z native

`XTBImporter.swift` też zostawia `"?"` *by design*, ale ma dwie rzeczy, których
web nie ma: konsultację z `ETFCatalog` oraz dwufazowy pipeline inferujący walutę
z obserwowanego FX po parsowaniu. Web nie ma żadnego z nich, więc musi ustalać
walutę najlepiej-jak-może w czasie parsowania.

## Rozwiązanie: drabina rozwiązywania waluty (opcja C)

W `resolveOrCreateInstrument`, dla nowo tworzonego instrumentu, waluta ustalana
jest w kolejności od najpewniejszego sygnału:

1. **Znany instrument** — istniejące zachowanie (`references.instruments`),
   dopasowanie po symbolu i bazowym tickerze. Bez zmian.
2. **Harvest z komentarza dywidendy** — pre-pass po `cashRows` zbiera mapę
   `TICKER → CCY` z wierszy typu `dividend`, których komentarz pasuje do wzorca
   `<CCY> <kwota>/SHR` (np. `"CSPX.UK USD 10.5/SHR"` → `USD`). Najpewniejszy
   sygnał, bo to dane samego XTB. Musi być pre-passem, bo dywidenda potrafi
   wystąpić w pliku *po* transakcji kupna.
3. **Jednoznaczny sufiks giełdy** — mapa tylko pewnych przypadków:
   `.DE/.NL/.FR/.IT/.ES → EUR`, `.US → USD`, `.PL → PLN`.
   **`.UK` i `.IE` świadomie pominięte** jako niejednoznaczne
   (CSPX.UK to USD, IEML.UK to GBP).
4. **Placeholder + ostrzeżenie** — gdy nic nie pasuje: zostaw `currency: "?"`
   i dopisz raz na ticker wpis do `preview.warnings`. FX i tak jest łapany
   (bo `≠ "PLN"`), więc koszt w PLN pozostaje zachowany.

## Co się NIE zmienia

- Transakcje `dividend` nadal mają `currency: "PLN"` (kwota to wpływ w PLN).
- Instrumenty PLN i już-znane instrumenty zachowują dotychczasowe zachowanie.
- Logika FX / prowizji / parowania — bez zmian.

## Test regresyjny

Nowy przypadek w `certification-import-parsers.test.ts` wywołuje `parseXtbXlsx`
z **pustą** listą `instruments`, asercje:

- VWCE.DE → `EUR` (sufiks), fx ≈ 4.5
- CSPX.UK → `USD` (harvest z dywidendy), fx ≈ 4.2
- IEML.UK → `"?"` (placeholder) + wpis w `preview.warnings`, fx ≈ 5.2 (zachowany)
- `newInstrumentPayloads` niosą te same waluty co transakcje.

## Kryteria ukończenia

- `npx vitest run tests/unit` zielone (213 istniejących + nowy).
- `npx tsc --noEmit` zielone.
- Zmiana chirurgiczna: tylko `xtb-parser.ts` + test.

## Przyszłość (poza zakresem)

- **D2 — inferencja z FX**: dopasowanie obserwowanego `|Amount|/(qty×price)` do
  historycznych kursów CCY→PLN na datę transakcji, by odzyskać ISO tam, gdzie
  drabina daje `"?"` (np. IEML.UK → GBP). Parytet z natywnym pipeline; wymaga
  źródła kursów FX i obsługi niejednoznaczności. Osobny PR. `preview.warnings`
  to naturalny punkt zaczepienia — to te same wiersze, które D2 podniesie.
