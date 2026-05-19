# Valuation decision

## Zakres etapu 6

Etap 6 wprowadza historie cen i wyceny rynkowe. Celem nie jest automatyczne ujawnianie skladu portfela providerom danych. Aplikacja moze pytac backend/proxy o pojedynczy symbol albo pojedyncza walute, a zapis ceny do danych uzytkownika wymaga jawnej akcji w UI.

## Zrodla cen

1. `manualValuation` - zrodlo prawdy dla wycen instrumentow zapisanych w sync.
2. Cena transakcyjna - fallback, gdy instrument nie ma wyceny manualnej przed dana data.
3. Yahoo Finance - podstawowe zrodlo propozycji ceny dla pojedynczego symbolu.
4. Stooq - druga opcja dla propozycji ceny, gdy Yahoo nie zwroci danych i serwer ma `STOOQ_API_KEY`.
5. NBP FX - zrodlo propozycji kursu waluty do PLN dla pojedynczej waluty i daty.

Provider market data nie zapisuje samodzielnie rekordow sync. Wynik providera staje sie trwaly dopiero po potwierdzeniu przez uzytkownika i zaszyfrowaniu jako rekord sync.

## Prywatnosc

Backend/proxy nie dostaje snapshotu portfela, listy pozycji ani kwot uzytkownika.

Do endpointow providerow moga trafic tylko:

- pojedynczy symbol instrumentu, np. `AAPL`,
- pojedynczy kod waluty, np. `USD`,
- opcjonalna data kursu albo ceny.

Cache providerow pozostaje procesowy i generyczny. Nie zawiera `user_id`, identyfikatorow portfeli, ilosci, wartosci pozycji ani notatek.

## Model domenowy

Etap 6 powinien rozdzielic trzy odpowiedzialnosci:

1. Ledger - liczy ilosci instrumentow i salda gotowki na dana date.
2. Price resolver - dobiera najlepsza cene instrumentu `<= date`.
3. FX resolver - dobiera kurs waluty `<= date`, z fallbackiem do kursow zapisanych przy transakcjach.

Snapshot i raporty powinny uzywac resolverow, zamiast szukac ceny bezposrednio w transakcjach.

## Reguly wyboru ceny

Dla instrumentu i daty:

1. Najnowsza `manualValuation` z data `<= valuationDate`.
2. Najnowsza cena z transakcji z data `<= valuationDate`.
3. Brak ceny oznacza wartosc pozycji `0` i powinien byc widoczny w diagnostyce/testach.

Po pobraniu ceny z Yahoo albo fallbacku Stooq UI pokazuje preview. Dopiero zatwierdzenie zapisuje nowy `manualValuation`.

## Reguly FX

Dla waluty i daty:

1. `PLN` zawsze ma kurs `1`.
2. Najnowszy jawnie zapisany kurs przy transakcji `<= valuationDate`.
3. Kurs wynikajacy z transakcji `fxConversion`.
4. Propozycja z NBP dla konkretnej daty, jezeli uzytkownik ja pobierze.

Etap 6 nie powinien automatycznie przeliczac calego portfela przez backend. Przeliczenie pozostaje po stronie klienta.

## UI

Minimalny zakres UI:

1. Na ekranie instrumentow pokazac status ceny: ostatnia cena, data i zrodlo.
2. Dodac akcje pobrania ceny dla pojedynczego instrumentu.
3. Pokazac preview ceny i waluty przed zapisem.
4. Po zatwierdzeniu zapisac `manualValuation` przez istniejacy szyfrowany writer.
5. Po zapisie odswiezyc snapshot i raporty.

## Testy

Wymagane testy:

1. Price resolver wybiera najnowsza cene `<= date`.
2. `manualValuation` ma priorytet nad cena transakcyjna.
3. Brak ceny nie psuje snapshotu i jest reprezentowany deterministycznie.
4. FX resolver wybiera kurs dla daty i obsluguje PLN jako `1`.
5. `valuationSeries` zmienia wartosc historycznie po dodaniu wycen.
6. Route handlery providerow sa testowane na mockowanych odpowiedziach.
