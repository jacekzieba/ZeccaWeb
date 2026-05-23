# Staging validation

## Cel

Potwierdzic, ze InvestorWeb czyta i zapisuje ten sam prywatny model synchronizacji co aplikacja natywna Investora na realnym projekcie Supabase i realnych zaszyfrowanych rekordach.

Etap jest zamkniety dopiero wtedy, gdy snapshot web i snapshot natywny zgadzaja sie na tym samym zestawie rekordow, a rekordy zapisane przez web przechodza natywne dekodowanie.

## Zakres

Walidacja obejmuje:

- Supabase Auth i sesje web.
- Odczyt `encrypted_key_backups`.
- Odblokowanie `userDataKey` passphrase.
- Odczyt i odszyfrowanie `encrypted_records`.
- Zapis `account`, `asset`, `transaction` i `manualValuation` z weba.
- Odczyt rekordow zapisanych przez web w aplikacji natywnej.
- Konflikty `updated_at`, tombstones `deleted_at` i wymuszenie lokalnej zmiany.
- Granice prywatnosci endpointow market data.

Walidacja nie obejmuje migracji produkcyjnej kont uzytkownikow. Do testu uzywac staging albo dedykowanego konta testowego.

## Przygotowanie

1. Utworzyc albo wskazac staging Supabase z migracja `supabase/migrations/0001_initial_sync.sql`.
2. Wlaczyc RLS na tabelach:
   - `profiles`
   - `user_devices`
   - `encrypted_records`
   - `encrypted_key_backups`
3. Utworzyc konto testowe Supabase Auth.
4. W aplikacji natywnej przygotowac zestaw testowy z co najmniej:
   - 2 portfelami,
   - 3 instrumentami w minimum 2 walutach,
   - transakcjami `cashDeposit`, `buy`, `sell`, `dividend`, `fxConversion`,
   - co najmniej jedna wycena `manualValuation`,
   - jedna usunieta encja, zeby sprawdzic tombstone.
5. Upewnic sie, ze konto ma `encrypted_key_backups` zgodny z passphrase znanym testerowi.
6. Skonfigurowac lokalnie web:

```bash
cp .env.example .env.local
```

W `.env.local` ustawic:

```text
NEXT_PUBLIC_SUPABASE_URL=<staging-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging-anon-key>
NEXT_PUBLIC_FAKE_SYNC=
```

`STOOQ_API_KEY` jest opcjonalny. Brak klucza oznacza brak fallbacku Stooq, ale Yahoo quote i NBP FX nadal powinny dzialac.

## Bramka lokalna przed staging

Przed podpieciem realnego staging uruchomic:

```bash
npm run preflight:staging
npm run typecheck
npm test
npm run lint
npm run build
npm run test:e2e:fake-sync
```

Wszystkie komendy musza przejsc. Jesli nie przechodza, nie zaczynac walidacji staging.

## Walidacja odczytu

1. Uruchomic web:

```bash
npm run dev
```

2. Otworzyc `http://127.0.0.1:3000/login`.
3. Zalogowac sie kontem testowym.
4. Odblokowac sync passphrase.
5. Potwierdzic w UI:
   - dashboard laduje realny snapshot, nie sample data,
   - lista portfeli zgadza sie z native,
   - lista instrumentow zgadza sie z native,
   - lista transakcji zgadza sie z native,
   - raporty i serie wycen sa deterministycznie zgodne z native dla tych samych danych.
6. Spisac roznice z dokladnym rekordem i ekranem. Nie korygowac danych testowych bez odnotowania przyczyny.

Oczekiwany wynik: web odczytuje rekordy bez bledow dekodowania, a wartosci laczne, gotowka, pozycje i serie wycen zgadzaja sie z aplikacja natywna albo maja jawnie wyjasniona roznice zaokraglenia.

## Walidacja zapisu web -> native

Wykonac w webie po jednej zmianie kazdego typu:

1. Dodac portfel testowy `Web Staging Portfolio`.
2. Dodac instrument testowy `WEB-STAGE`.
3. Dodac transakcje testowa dla tego instrumentu.
4. Pobrac cene z market data, zaakceptowac preview i zapisac ja jako `manualValuation`.
5. Odczekac zakonczenie pending sync.
6. Otworzyc konto w aplikacji natywnej i potwierdzic:
   - rekordy sa widoczne,
   - natywne dekodowanie nie zwraca bledu,
   - snapshot po stronie native uwzglednia te same wartosci.

Oczekiwany wynik: rekordy zapisane przez web sa poprawnymi payloadami Swift `Codable`, maja zgodny `record_type`, `payload_version`, `schema_version`, nonce i `encrypted_payload`.

## Walidacja native -> web

1. W aplikacji natywnej dodac portfel, instrument, transakcje i `manualValuation`.
2. W webie odswiezyc sync.
3. Potwierdzic, ze rekordy pojawiaja sie w odpowiednich widokach.

Oczekiwany wynik: web akceptuje payload natywny bez potrzeby migracji klientowej.

## Konflikty i tombstones

### Konflikt edycji

1. Otworzyc ten sam rekord w webie i native.
2. Zmienic rekord w native i zsynchronizowac.
3. Bez odswiezania weba zmienic ten sam rekord w webie.
4. Potwierdzic, ze web nie nadpisuje cicho rekordu z nowszym `updated_at`.
5. Uzyc akcji odrzucenia lokalnej zmiany.
6. Powtorzyc i uzyc wymuszenia lokalnej zmiany.

Oczekiwany wynik: konflikt jest jawny, a wymuszenie tworzy jednoznaczny nowy stan.

### Tombstone

1. Usunac rekord w native.
2. Odswiezyc web i potwierdzic, ze rekord znika z aktywnych widokow.
3. Usunac inny rekord w webie.
4. Potwierdzic w native, ze `deleted_at` jest respektowane.

Oczekiwany wynik: soft delete nie powoduje ponownego pojawienia sie rekordu po sync.

## Prywatnosc market data

Sprawdzic w Network albo logach route handlerow, ze requesty maja tylko parametry:

- `/api/market-data/quote?symbol=<symbol>`
- `/api/market-data/fx?code=<currency>&date=<yyyy-mm-dd>`

Nie powinny wystepowac:

- `user_id`
- nazwa portfela,
- ilosc pozycji,
- lista instrumentow,
- pelny snapshot,
- ciphertext z `encrypted_records`.

Oczekiwany wynik: provider market data dostaje pojedynczy symbol albo pojedyncza walute i date. Zapis ceny do `encrypted_records` dzieje sie dopiero po jawnej akceptacji uzytkownika.

## RLS smoke test

Na staging utworzyc drugie konto testowe i sprawdzic, ze nie widzi rekordow pierwszego konta:

1. Zalogowac sie w webie drugim kontem.
2. Potwierdzic brak `encrypted_key_backups` pierwszego konta.
3. Potwierdzic brak `encrypted_records` pierwszego konta.
4. Jesli drugie konto ma wlasny backup, potwierdzic, ze widzi tylko swoje rekordy.

Oczekiwany wynik: RLS ogranicza dostep po `auth.uid()`.

## Raport walidacji

Po tescie wypelnic:

```text
Data:
Supabase project:
Native build:
Web commit:
Test account:

Local gate:
- staging preflight:
- typecheck:
- unit tests:
- lint:
- build:
- fake-sync e2e:

Read parity:
- portfolios:
- instruments:
- transactions:
- valuations:
- reports:

Write web -> native:
- account:
- asset:
- transaction:
- manualValuation:

Write native -> web:
- account:
- asset:
- transaction:
- manualValuation:

Conflicts:
- reject local:
- force local:
- tombstone native -> web:
- tombstone web -> native:

Market data privacy:
- quote:
- fx:

RLS:
- second account isolation:

Open issues:
```

## Kryterium zamkniecia Etapu 7

Etap 7 mozna oznaczyc jako gotowy, gdy:

1. Local gate przechodzi na commicie walidowanym na staging.
2. Web odczytuje staging data bez bledow dekodowania.
3. Snapshot web i native zgadzaja sie na tym samym zestawie rekordow.
4. Rekordy zapisane przez web dekoduja sie w native.
5. Rekordy zapisane przez native dekoduja sie w webie.
6. Konflikty i tombstones nie prowadza do cichej utraty danych.
7. Endpointy market data nie dostaja danych portfela.
8. Drugie konto testowe nie widzi rekordow pierwszego konta.
