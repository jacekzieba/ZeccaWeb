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

## Weryfikacja 2026-05-25

Uruchomione lokalnie:

```bash
npm run check:sync-compat
npm test -- tests/unit/market-data-routes.test.ts tests/unit/market-data.test.ts tests/unit/investor-snapshot.test.ts tests/unit/record-writer.test.ts tests/unit/supabase-sync-store.test.ts
```

Wynik:

- `check:sync-compat`: PASS dla klas rekordow sync, migracji, writerow, tombstones, conflict guard i key backup.
- Testy ukierunkowane: 25/25 PASS.

Status ryzyk:

| Ryzyko | Status | Dowod lokalny | Co zostaje do staging |
| --- | --- | --- | --- |
| `income` ignorowane przez snapshot | Potwierdzone | `check:sync-compat` oznacza `income` jako jawny read gap; `investor-snapshot.ts` ma `case "income"` bez wplywu na snapshot | Sprawdzic, czy refactor macOS zapisuje osobne rekordy `income`; jesli tak, dodac parser i modelowanie w web |
| Brak `user_devices` heartbeat | Potwierdzone | Schemat i typy zawieraja `user_devices`, ale kod web zapisuje tylko `device_id` na `encrypted_records` | Zdecydowac, czy heartbeat urzadzenia jest wymagany przed produkcja |
| RLS wymaga live testu | Niezweryfikowane lokalnie | Migracja ma RLS i polityki `auth.uid()`, ale brak realnych dwoch kont Auth w lokalnym tescie | Uruchomic RLS smoke test na staging z dwoma kontami |
| Stooq fallback zalezy od `STOOQ_API_KEY` | Zabezpieczone testami, nadal konfiguracyjne | `market-data-routes.test.ts` testuje brak klucza i fallback z kluczem | Zweryfikowac faktyczny klucz na staging, jesli fallback Stooq ma byc czescia testu |
| Market data jako propozycja ceny | Zabezpieczone testami i architektura | Endpointy przyjmuja pojedynczy symbol/walute; fake-sync E2E pokrywa zapis `manualValuation` po akceptacji | W Network/logach staging potwierdzic brak snapshotu, `user_id` i ciphertext w requestach providerow |
| Brak automatycznego diffu snapshot web-native | Potwierdzone | Istnieje reczny raport i testy domeny, ale brak eksportu/diffu z natywnym snapshotem | Przy danych z refactorowanego macOS dodac fixtures albo maszynowy diff |

Blokery produkcyjne pozostaja zalezne od realnej walidacji web-native na staging. Lokalnie nie da sie potwierdzic natywnego dekodowania rekordow web ani izolacji RLS miedzy realnymi uzytkownikami.
