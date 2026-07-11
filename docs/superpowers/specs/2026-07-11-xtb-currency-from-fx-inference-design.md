# XTB import — inferencja waluty z obserwowanego FX (D2)

**Data:** 2026-07-11
**Status:** propozycja (follow-up do
[currency resolution ladder](2026-07-11-xtb-unknown-instrument-currency-design.md))
**Zależność:** źródło historycznych kursów CCY→PLN na datę transakcji

## Problem

Drabina waluty (opcja C) zostawia `currency: "?"` + warning tam, gdzie żaden
pewny sygnał nie zadziałał — typowo instrument z niejednoznacznego venue (`.UK`,
LSE) bez dywidendy (np. `IEML.UK`). Symbol→waluta tego nie rozwiąże: `.UK` to na
LSE dwie linie (USD i GBx/GBP) pod tym samym kluczem, więc katalog zwróciłby co
najwyżej walutę bazową funduszu (dla IEML: USD), co jest walutą inną niż
rozliczeniowa w XTB (GBP) — cichy błąd.

Jedyny sygnał rozróżniający linie to **obserwowany kurs** z samego eksportu:
`fxObserved = |Amount| / (quantity × price)`.

## Rozwiązanie

Nowy krok drabiny **3.5** (między sufiksem a placeholderem): dopasuj
`fxObserved` do historycznych kursów kandydujących walut na datę transakcji;
wybierz walutę, której kurs jest najbliżej, o ile jest jednoznacznie najbliżej.

Przykład (IEML.UK, 2026-03-02): `fxObserved = 5200 / (50 × 20) = 5.2`.

| CCY | kurs→PLN | \|Δ\| |
|---|---|---|
| USD | ~4.0 | 1.2 |
| EUR | ~4.3 | 0.9 |
| **GBP** | **~5.1** | **0.1** |

→ `GBP`. Gdyby dwie waluty mieściły się w tolerancji i były porównywalnie
blisko → **nie zgadujemy**: zostaje `"?"` + warning (obecne zachowanie C).

## Interfejs (proponowany, do doprecyzowania w planie)

- Wejście: `fxObserved: number`, `date: Date`, `candidates: string[]`
  (np. `["USD","EUR","GBP","CHF"]`), `rates: (ccy, date) => number | null`.
- Wyjście: `{ currency: string } | null` (null = niejednoznaczne/brak danych).
- Parametry: tolerancja względna (np. 2%), minimalny margines nad drugim
  kandydatem (np. drugi musi być >5% dalej), żeby uniknąć fałszywej pewności.

Czysty, testowalny seam — bez sięgania do sieci; kursy wstrzykiwane (parytet z
istniejącym wzorcem wstrzykiwania w tym repo).

## Ryzyka / decyzje do podjęcia

- **Skąd kursy na datę** — `src/market-data/` (uwaga: w working tree były obce,
  niezwiązane zmiany w tym obszarze — do potwierdzenia z właścicielem).
- **Zbiór kandydatów** — mały, jawny (waluty realnie obsługiwane), by ograniczyć
  ryzyko kolizji bliskich kursów.
- **Tolerancja i margines** — dobrać na realnych danych; test parametryczny.
- **Kwantyzacja GBX vs GBP** — LSE bywa notowane w pensach; sprawdzić, czy
  `price` z komentarza jest w GBP czy GBx (rząd wielkości ×100).

## Test (TDD)

- IEML.UK z pustą `references.instruments` i wstrzykniętymi kursami → `GBP`.
- Przypadek niejednoznaczny (dwie waluty w tolerancji) → `"?"` + warning.
- Brak danych kursowych na datę → `"?"` + warning (degradacja do C).

## Kryteria ukończenia

- Nowy krok 3.5 w `xtb-parser.ts`, wstrzykiwane kursy, czysty seam.
- Testy jednostkowe zielone; C nadal zielone (degradacja gdy brak kursów).
- Zero zmian dla PLN / znanych / rozwiązanych sufiksem/harvestem.
