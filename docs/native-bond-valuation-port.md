# Prompt: poprawka wyceny obligacji skarbowych w natywnej apce (macOS/iOS)

> Wklej całość w nowym czacie agenta uruchomionym w repo `Investor` (Swift, moduły `InvestorCore`/`InvestorDomain`).

---

## Kontekst

W apce wartość bieżąca obligacji skarbowych indeksowanych inflacją (ROS, ROD, COI, EDO) jest liczona **za nisko**. Dla testowego portfela natywna apka pokazuje **20 420 zł**, a poprawna wartość (obligacjeskarbowe.pl) to **21 710,95 zł** (−6%). Web liczył 19 281 i został już naprawiony — ta sama poprawka ma trafić do natywnego rdzenia.

Przyczyna: po 1. roku oprocentowanie tych obligacji = **inflacja GUS (CPI r/r) + marża**, a apka albo używa złego miesiąca referencyjnego inflacji, albo nieaktualnego/pojedynczego odczytu CPI, albo źle kapitalizuje. W modelu jest już pole `marginOverInflation` i „seria inflacji" jako źródło prawdy — trzeba poprawić **regułę liczenia stopy okresu**.

## Reguła (zweryfikowana co do grosza względem oficjalnych wartości)

Dla jednej obligacji o nominale 100 zł:

1. **Okres 1** (rok od dnia zakupu): stała stopa emisyjna `firstPeriodRate`.
2. **Każdy kolejny okres roczny**: `stopa = max(0, inflacja) + marża`, gdzie
   - `marża` = `marginOverInflation` (per emisja),
   - `inflacja` = roczny wskaźnik CPI GUS (r/r, w %) z miesiąca **(początek okresu − 2 miesiące)**.
     Uzasadnienie: regulamin mówi „wskaźnik ogłoszony w miesiącu poprzedzającym pierwszy miesiąc okresu"; GUS publikuje wskaźnik miesiąca M ~15. dnia miesiąca M+1, więc wskaźnik „ogłoszony w miesiącu poprzedzającym start" dotyczy miesiąca **start − 2**.
   - ujemna inflacja liczona jako 0 (marża zostaje).
3. **Kapitalizacja roczna** (`capitalization == .roczna`, `interestPayment == .atMaturity` / „przy wykupie"): odsetki za pełny okres dopisują się do kapitału (procent składany). Dla obligacji wypłacających odsetki rocznie (np. COI) — bez kapitalizacji.
4. **Okres bieżący (częściowy)**: narastająco `kapitał × stopa × (dni_od_startu_okresu / dni_w_okresie)`, gdzie dni liczone kalendarzowo, mianownik = długość pełnego okresu (365/366).
5. **Kotwica okresów = dzień zakupu** (każda obligacja ma własny harmonogram od dnia zakupu; wykup = zakup + N lat). Wartość obcięta na dacie wykupu.

## Referencyjna implementacja (TypeScript — do portu 1:1)

```ts
// stopa okresu (w %)
function bondPeriodRate(params, periodIndex, periodStart, cpi) {
  if (periodIndex === 0) return params.firstPeriodRate;
  if (params.subsequentBase === "stałe") return params.marginOverBase; // kupon stały
  const ref = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() - 2, 1));
  const key = `${ref.getUTCFullYear()}-${String(ref.getUTCMonth() + 1).padStart(2, "0")}`;
  const inflation = cpi[key]; // % r/r
  if (inflation == null) return Math.max(0, params.marginOverBase); // fallback: brak danych CPI
  return Math.max(0, inflation) + params.marginOverBase;
}

// dirty price jednej obligacji
function dirtyPrice(params, purchaseDate, asOf) {
  const effectiveAsOf = asOf < params.maturityDate ? asOf : params.maturityDate;
  if (effectiveAsOf <= purchaseDate) return params.nominalValue;
  let periodStart = purchaseDate, periodIndex = 0;
  let principal = params.nominalValue, carriedInterest = 0;
  while (periodStart < effectiveAsOf) {
    const periodEnd = addYears(periodStart, 1);
    const rate = bondPeriodRate(params, periodIndex, periodStart, cpi) / 100;
    if (effectiveAsOf < periodEnd) { // okres częściowy
      const totalDays = daysBetween(periodStart, periodEnd);
      const elapsed = daysBetween(periodStart, effectiveAsOf);
      return principal + carriedInterest + principal * rate * Math.min(elapsed / totalDays, 1);
    }
    const full = principal * rate;
    if (params.interestPayment === "przy wykupie") {
      if (params.capitalization === "roczna") principal += full; else carriedInterest += full;
    }
    periodStart = periodEnd; periodIndex += 1;
  }
  return principal + carriedInterest;
}
```

`addYears` przesuwa rok kalendarzowo (zachowuje dzień/miesiąc); `daysBetween` = różnica w pełnych dniach.

## Dane: CPI GUS r/r (%), klucz "RRRR-MM"

Zaszyj jako seria miesięczna (lub zweryfikuj istniejącą „serię inflacji" w apce — kluczowe są pogrubione miesiące referencyjne):

```
2023-09 8.2  2023-10 6.6  2023-11 6.6  2023-12 6.2
2024-09 4.9  2024-10 5.0  2024-11 4.7  2024-12 4.7
2025-09 2.9  2025-10 2.8  2025-11 2.4  2025-12 2.4
```
(pełniejszą tabelę 2021–2025 ma plik `src/domain/valuation/bond-rates.ts` w repo web — przenieś całość)

## Golden vectory (testy do dodania w Swift) — stan na 2026-06-21

| Emisja | Zakup | Wykup | firstPeriodRate | marża | Sztuk | Wartość/szt (cel) |
|---|---|---|---|---|---|---|
| ROS1228 | 2022-12-22 | 2028-12-22 | 7,20% | 1,50% | 15 | **126,05** |
| ROS0229 | 2023-02-27 | 2029-02-27 | 7,20% | 1,50% | 100 | **124,11** |
| ROS1129 | 2023-11-30 | 2029-11-30 | 6,95% | 1,75% | 20 | **117,01** |
| ROD0338 | 2026-03-27 | 2038-03-27 | 5,85% | 2,50% | 50 | **101,38** |

Wszystkie ROS/ROD: `subsequentBase = inflacja`, kapitalizacja roczna, odsetki przy wykupie, nominał 100.

Asercje:
- każda emisja: `dirtyPrice` ≈ wartość/szt (tolerancja 0,05 zł — oficjalna jest zaokrąglana do grosza);
- suma `round(wartość/szt, 2) × sztuk` = **21 710,95 zł**;
- regresja: ROD0338 w 1. roku liczona poprawnie (tu była ~ok);
- jednostkowo: dla ROS1228 stopa okresu 2 (start 2023-12-22) = `CPI[2023-10] (6,6) + 1,50 = 8,10%`.

## Zadania

1. Znajdź w `InvestorDomain`/`InvestorCore` warstwę liczenia obligacji (Domain Core → bonds) i miejsce ustalania stopy kolejnych okresów.
2. Zaimplementuj regułę powyżej (miesiąc referencyjny = start − 2, `max(0, inflacja) + marża`, kapitalizacja roczna, okres częściowy actual/365, kotwica = dzień zakupu).
3. Upewnij się, że „seria inflacji" zawiera właściwe miesięczne CPI r/r i że kod sięga po właściwy miesiąc referencyjny.
4. Dodaj testy z golden vectorami i sumą 21 710,95.
5. Uruchom `swift test`; potwierdź, że apka pokazuje 21 710,95 dla tego portfela.

## Uwaga o kontrakcie (do uzgodnienia z web)

Web używa `subsequentBase` + `marginOverBase`, native `marginOverInflation`. Docelowo ujednolicić nazewnictwo `bondParams` w `SyncPayloadEnvelope`, żeby obie platformy czytały to samo pole (warunek wstępny współdzielenia danych/silnika).
