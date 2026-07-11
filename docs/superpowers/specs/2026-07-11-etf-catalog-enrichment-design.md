# Web — port katalogu ETF (enrichment: ISIN / nazwa / domicile)

**Data:** 2026-07-11
**Status:** propozycja (komplementarny follow-up)
**Parytet:** natywny `ETFCatalog.swift` + `inwestomat-etf-catalog.csv`

## Cel

Wzbogacać nowo tworzone instrumenty z importu o tożsamość: **ISIN, pełną nazwę,
domicile, emitenta** — z tego samego statycznego katalogu, który wozi native
(`Sources/InvestorDomain/Resources/inwestomat-etf-catalog.csv`, ~2300 wierszy,
„ETF-y dostępne u polskich maklerów", w tym XTB).

## Czego ten katalog NIE robi (ważne)

Nie służy do ustalania waluty rozliczenia. Kolumna waluty w CSV to
**„Waluta funduszu (dywidend)"** — waluta bazowa funduszu, nie waluta notowania.
Dla `.UK`/LSE (podwójne notowania) baza ≠ rozliczenie (IEML: baza USD, XTB GBP).
Native to potwierdza: jego mapa waluty *notowania* (`exchangeCurrency`) **celowo
pomija LON**. Waluta rozliczenia pozostaje domeną drabiny C + inferencji FX (D2).

Innymi słowy: waluta z katalogu bierzemy **tylko** dla jednoznacznych venue —
a to już pokrywa nasza mapa sufiksów. Katalog dokłada tożsamość, nie walutę.

## Zakres

1. **Dane** — dołączyć CSV do zasobów weba (skopiować z natywnego repo).
2. **Loader** — parser CSV → `Map<ticker, Entry>` i `Map<isin, Entry[]>`
   (parytet z `ETFCatalog(entries:)`); lookup `entry(forTicker)` z fallbackiem
   base-ticker (odcięcie po kropce), jak w native.
3. **Integracja w `xtb-parser.ts`** — przy tworzeniu nowego instrumentu:
   uzupełnić `isin`, `name` (gdy pełniejsza niż z eksportu), `country`
   z katalogu. **Waluty z katalogu nie używać** (patrz wyżej) — waluta nadal z
   drabiny C.
4. **Mapowanie sufiksu XTB → prefiks giełdy katalogu** przy potrzebie
   (`.DE`↔`FRA/Xetra`, `.UK`↔`LON`, `.US`↔`NYSE/NASDAQ`) — do doprecyzowania;
   dla samego lookupu po base-tickerze może być zbędne.

## Ryzyka / decyzje

- **Rozmiar bundla** — ~2300-wierszowy CSV w web assecie; rozważyć wczytywanie
  leniwe / tylko w ścieżce importu.
- **Aktualność** — katalog ma datę wersji (09.2025); to statyczny snapshot,
  wymaga okresowego odświeżania (jak w native). Udokumentować źródło i wersję.
- **Kolizje tickerów** — ten sam ticker na wielu giełdach; native bierze pierwszy
  wpis. Zachować ten sam wybór dla parytetu, chyba że mamy ISIN/exchange do
  dokładniejszego dopasowania.

## Test (TDD)

- Lookup `VWCE` → ISIN `IE00BK5BQT80`, nazwa Vanguard, domicile Irlandia.
- Import nieznanego `VWCE.DE` (pusta `references`) → instrument z ISIN/nazwą z
  katalogu, a waluta nadal `EUR` **z sufiksu, nie z kolumny waluty katalogu**.
- Ticker spoza katalogu → brak enrichmentu, bez błędu (degradacja).

## Kryteria ukończenia

- CSV + loader + integracja; testy jednostkowe zielone.
- Waluta rozliczenia niezmieniona względem drabiny C (test to pilnuje).
- Zmiana chirurgiczna, zamknięta w module katalogu + punkcie tworzenia
  instrumentu w `xtb-parser.ts`.
