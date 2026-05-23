# Staging risks

## Znane ograniczenia przed Etapem 7

1. `income` jest czescia kontraktu sync i jest akceptowane przez envelope oraz schemat tabeli, ale snapshot builder obecnie je ignoruje. Jesli natywny dataset uzywa osobnych rekordow `income`, parity raportow moze sie roznic.
2. `user_devices` istnieje w migracji, ale web nie zapisuje jeszcze device heartbeat. Kompatybilnosc danych portfela nie zalezy od tego, ale diagnostyka urzadzen w staging moze byc niepelna.
3. RLS jest zdefiniowane w migracji, ale wymaga live smoke testu na dwoch kontach Auth w realnym projekcie Supabase.
4. Stooq fallback zalezy od `STOOQ_API_KEY`. Bez klucza Yahoo i NBP powinny dzialac, ale fallback quote nie zostanie zweryfikowany.
5. Market data jest propozycja ceny. Trwaly zapis do sync następuje tylko po zaakceptowaniu preview i zapisaniu `manualValuation`.
6. Web nie ma jeszcze automatycznego eksportu snapshotu do formatu porownywalnego maszynowo z native. Etap 7 zaczyna od recznej parity wedlug raportu.

## Blokery przed produkcja

- Blad dekodowania rekordu zapisanego przez web w native.
- Cicha utrata danych przy konflikcie `updated_at`.
- Tombstone ignorowany przez jedna ze stron.
- Drugi uzytkownik widzi rekordy pierwszego konta.
- Provider market data dostaje caly snapshot albo identyfikator uzytkownika.
