# Market data decision

## Zakres etapu 5

Etap 5 domyka tylko proxy i cache danych rynkowych. Nie aktualizuje automatycznie zaszyfrowanych rekordow uzytkownika.

## Providerzy

1. FX: NBP Web API.
   - Publiczny endpoint JSON dla kursow walut.
   - Obslugiwany zakres w aplikacji: pojedynczy kurs `A/{code}` jako `code -> PLN`.
   - Endpoint web: `/api/market-data/fx?code=USD` albo `/api/market-data/fx?code=USD&date=2026-05-15`.

2. Quote EOD: Stooq CSV download.
   - Obslugiwany zakres w aplikacji: ostatni dzienny wiersz OHLCV dla symbolu Stooq.
   - Endpoint web: `/api/market-data/quote?symbol=aapl.us`.
   - Stooq jest traktowany jako opcjonalny provider EOD, nie jako zrodlo gwarantowane dla wszystkich instrumentow.
   - Od 2026 Stooq CSV download wymaga klucza API; lokalnie ustawic `STOOQ_API_KEY`.

## Prywatnosc

Zapytanie o symbol lub walute ujawnia backendowi/proxy intencje uzytkownika. Dlatego:

- endpointy przyjmuja pojedynczy symbol albo pojedyncza walute, nie caly snapshot portfela;
- cache jest generyczny i kluczowany providerem oraz symbolem/waluta, bez `user_id`;
- cache jest procesowy/in-memory, nie tabela Supabase;
- wynik providera nie jest zapisywany do `encrypted_records` bez jawnej akcji uzytkownika.

## Cache

- FX NBP: TTL 60 minut.
- Quote Stooq: TTL 15 minut.
- Cache ma sluzyc do ograniczenia powtarzanych requestow z UI i testow, a nie jako historia cen.

Historia cen i automatyczne manual valuations powinny byc osobnym etapem, bo wymagaja decyzji czy dane cenowe maja trafiać do szyfrowanych rekordow, czy pozostac odtwarzalnym cachem.
