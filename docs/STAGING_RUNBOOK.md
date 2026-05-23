# Staging runbook

## Cel

Ten runbook opisuje prace przygotowawcze do realnej walidacji Etapu 7. Nie zawiera sekretow ani danych kont testowych.

## Role

- Web: uruchamia lokalna bramke, web app i zapisuje raport.
- Native: przygotowuje build natywny pod ten sam staging i potwierdza dekodowanie rekordow web.
- Supabase: przygotowuje projekt staging, Auth users, migracje i RLS.

## Kolejnosc

1. Supabase: zastosowac `supabase/migrations/0001_initial_sync.sql`.
2. Supabase: utworzyc dwa konta testowe Auth.
3. Native: zapisac na pierwszym koncie dataset testowy opisany w `docs/STAGING_VALIDATION.md`.
4. Native: potwierdzic, ze konto ma `encrypted_key_backups` i znana passphrase dziala.
5. Web: ustawic `.env.local` pod staging.
6. Web: uruchomic lokalny preflight:

```bash
npm run preflight:staging
```

7. Web i Native: przejsc procedure z `docs/STAGING_VALIDATION.md`.
8. Web: zapisac wynik w `docs/STAGING_VALIDATION_REPORT.md`.
9. Zespół: zaklasyfikowac znalezione problemy jako blokujace albo nieblokujace.

## Dane testowe

Minimalny dataset powinien zawierac:

- 2 portfele,
- 3 instrumenty,
- minimum 2 waluty,
- `cashDeposit`,
- `buy`,
- `sell`,
- `dividend`,
- `fxConversion`,
- `manualValuation`,
- tombstone po usunieciu rekordu.

## Zakazy

- Nie uzywac produkcyjnego konta uzytkownika.
- Nie commitowac `.env.local`, haseł, passphrase ani tokenow Supabase.
- Nie wlaczac `NEXT_PUBLIC_FAKE_SYNC` podczas staging validation.
- Nie korygowac datasetu w trakcie porownywania bez zapisania przyczyny w raporcie.

## Wynik

Etap 7 jest gotowy dopiero wtedy, gdy raport walidacji ma `Result: PASS` i brak blokujacych problemow.
