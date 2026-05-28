# Staging risks

## Znane ograniczenia przed Etapem 7

1. `income` jest czescia kontraktu sync i jest akceptowane przez envelope oraz schemat tabeli. Web parsuje je do `snapshot.income`; staging musi potwierdzic semantyczna parity z native.
2. `user_devices` istnieje w migracji i web zapisuje device heartbeat lokalnie. Staging musi potwierdzic faktyczny wpis `user_devices` w realnym projekcie Supabase.
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
| `income` ignorowane przez snapshot | Zamkniete lokalnie | Web parsuje `income` i buduje `snapshot.income`; testy pokrywaja earning, burden i tombstone | Potwierdzic parity z macOS fixtures/staging |
| Brak `user_devices` heartbeat | Zamkniete lokalnie | Web upsertuje `user_devices` przez `registerWebDevice`; `check:sync-compat` ma PASS | Potwierdzic wpis `user_devices` na staging |
| RLS wymaga live testu | Niezweryfikowane lokalnie | Migracja ma RLS i polityki `auth.uid()`, ale brak realnych dwoch kont Auth w lokalnym tescie | Uruchomic RLS smoke test na staging z dwoma kontami |
| Stooq fallback zalezy od `STOOQ_API_KEY` | Zabezpieczone testami, nadal konfiguracyjne | `market-data-routes.test.ts` testuje brak klucza i fallback z kluczem | Zweryfikowac faktyczny klucz na staging, jesli fallback Stooq ma byc czescia testu |
| Market data jako propozycja ceny | Zabezpieczone testami i architektura | Endpointy przyjmuja pojedynczy symbol/walute; fake-sync E2E pokrywa zapis `manualValuation` po akceptacji | W Network/logach staging potwierdzic brak snapshotu, `user_id` i ciphertext w requestach providerow |
| Brak automatycznego diffu snapshot web-native | Czesciowo zamkniete lokalnie | `tests/unit/macos-refactor-fixtures.test.ts` odszyfrowuje natywne `encrypted_records`, porownuje plaintext i buduje snapshot web; ksztalt snapshotu UI nadal rozni sie od natywnego raw snapshotu | Rozszerzyc staging o realny snapshot diff web-native dla danych z aplikacji, nie tylko deterministyczny fixture |

Blokery produkcyjne pozostaja zalezne od realnej walidacji web-native na staging. Lokalnie nie da sie potwierdzic natywnego dekodowania rekordow web ani izolacji RLS miedzy realnymi uzytkownikami.

## Weryfikacja refactoru macOS

Branch remote `origin/claude/hungry-goodall-1227f7` z repo `jacekzieba/Investor` potwierdza, ze `income` jest realnym rekordem sync po stronie macOS, a nie przyszlym placeholderem. Szczegolowy plan domkniecia kompatybilnosci jest w `docs/MACOS_WEB_MIGRATION_PLAN.md`.

## Weryfikacja implementacji web 2026-05-25

Po analizie refactorowanego macOS web domknal lokalnie:

- rozszerzony odczyt payloadow `account`, `asset`, `transaction`, `manualValuation`, `settings`;
- helpery zapisu web generujace pola wymagane przez macOS `Codable`;
- parser i minimalny `snapshot.income` dla `income` earning/burden;
- webowy heartbeat `user_devices`.

Uruchomione:

```bash
npm run typecheck
npm test -- tests/unit/supabase-sync-store.test.ts tests/unit/record-writer.test.ts tests/unit/macos-payloads.test.ts tests/unit/investor-snapshot.test.ts
npm run check:sync-compat
```

Wynik: PASS, `check:sync-compat` zostawia tylko staging RLS live check.

## Weryfikacja fixtures macOS 2026-05-28

Dodano deterministyczny fixture z refactor branch `origin/claude/hungry-goodall-1227f7`:

- `tests/fixtures/macos-refactor/sync-fixture.json`;
- payloady `account`, `asset`, `transaction`, `manualValuation`, `income`, `settings`;
- zaszyfrowane `encrypted_records` w formacie CryptoKit AES-GCM (`ciphertext + tag`, nonce osobno);
- raw `nativeSnapshot` dla tego samego datasetu.

Uruchomione:

```bash
npm test -- tests/unit/macos-refactor-fixtures.test.ts
```

Wynik: PASS. Test potwierdza odszyfrowanie, zgodnosc plaintext payloadow, pokrycie typow rekordow i zbudowanie web snapshotu z `income`.
