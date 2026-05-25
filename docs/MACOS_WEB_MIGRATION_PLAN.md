# macOS -> web migration plan

## Zrodlo prawdy

Plan bazuje na repo `https://github.com/jacekzieba/Investor` i branchu:

```text
origin/claude/hungry-goodall-1227f7
commit: 83e079b83fff5f9ac3ca03bbdb05b967337c5adc
```

Uwaga: lokalny branch `claude/hungry-goodall-1227f7` w `/Users/jacek/Desktop/Investor` wskazuje na inny commit niz aktualny remote. Do migracji web uzywamy aktualnego remote z GitHuba, nie lokalnego diverged brancha.

## Ustalenia z refactoru macOS

macOS sync envelope nadal jest plaskim JSON-em z `recordType` i obsluguje:

- `account`
- `asset`
- `transaction`
- `manualValuation`
- `income`
- `settings`

Refactor macOS rozszerza kontrakt wzgledem obecnego web MVP:

- `account` ma dodatkowe pola `accountType`, `colorHex`, `targetAllocation`.
- `asset` ma dodatkowe pola `exchange`, `country`, `isin`, `marketDataID`, `listedBondParams`, `depositParams`.
- `transaction` ma dodatkowe pola `bookingDate`, `notes`, `externalImportID`, `sourcePortfolioID`, `transferSourceKind`, `contributionTreatment`, `transferCostBasisMode`, `createdAt`, `updatedAt`.
- `manualValuation` ma dodatkowe pola `note`, `createdAt`, `updatedAt`.
- `settings` ma stale ID `B2AA7BD4-A95D-4D80-90F9-787B8A1EC401` i pelny zestaw ustawien aplikacji.
- `income` jest realnie zapisywane przez macOS jako `Earning` albo `EarningBurden` przez jedno `IncomePayload`.
- macOS zapisuje `user_devices` przez `registerDevice(userID:)`.

## Priorytet 1 - zgodnosc payloadow

Status lokalny: zrobione dla web read compatibility i podstawowego web write compatibility. Do potwierdzenia fixtures/staging.

1. Zaktualizowac webowe schematy payloadow w `src/sync/records/investor-snapshot.ts`:
   - `accountPayloadSchema`: dodac opcjonalne `accountType`, `colorHex`, `targetAllocation`.
   - `assetPayloadSchema`: dodac opcjonalne `exchange`, `country`, `isin`, `marketDataID`, `listedBondParams`, `depositParams`.
   - `transactionPayloadSchema`: dodac opcjonalne `bookingDate`, `notes`, `externalImportID`, `sourcePortfolioID`, `transferSourceKind`, `contributionTreatment`, `transferCostBasisMode`, `createdAt`, `updatedAt`.
   - `manualValuationPayloadSchema`: dodac opcjonalne `note`, `createdAt`, `updatedAt`.
   - `settingsPayloadSchema`: rozszerzyc o pola z macOS, zachowujac obecne uzycie `baseCurrency`.
2. Przy zapisie z weba uzupelniac payloady polami wymaganymi przez macOS:
   - `accountType`, `colorHex`, `targetAllocation`,
   - `notes`, `createdAt`, `updatedAt` dla transakcji,
   - `note`, `createdAt`, `updatedAt` dla `manualValuation`.
3. Dodac testy unit, ktore parsują payloady w ksztalcie macOS dla wszystkich typow rekordow.

## Priorytet 2 - `income`

Status lokalny: zrobione minimalnie. Web parsuje `income` i wystawia `snapshot.income` z licznikami oraz sumami PLN. Nie miesza `income` automatycznie z gotowka portfela.

macOS zapisuje:

```text
recordType: "income"
entryKind: "earning" | "burden"
year
month
employmentType?
enteredAmount?
currency?
fxRateToPLN?
plnAmount?
source?
burdenCategory?
amountPLN?
note?
```

Do zrobienia w web:

1. Dodac `incomePayloadSchema`.
2. Rozszerzyc `ParsedDataset` o `income`.
3. Odczytywac `income` zamiast ignorowac `case "income"`.
4. Na start wprowadzic minimalna zgodnosc:
   - `earning` zwieksza przychodowy cashflow raportowy,
   - `burden` zwieksza obciazenia/koszty raportowe,
   - nie mieszać automatycznie z pozycjami portfela, jesli macOS traktuje earnings jako osobny modul.
5. Dodac testy:
   - parse `earning`,
   - parse `burden`,
   - snapshot/report nie gubi licznikow income,
   - tombstone income jest ignorowany.
6. Dopiero po parity z macOS zdecydowac, czy `income` ma wejsc do dashboard/report UI web, czy tylko do zgodnego sync read/write.

## Priorytet 3 - `user_devices`

Status lokalny: zrobione. Web ma stabilny `device_id`, upsertuje `user_devices` i uzywa tego samego `device_id` przy `encrypted_records`.

macOS ma `registerDevice(userID:)` i upsertuje:

```text
user_id
device_id
device_name
platform
last_seen_at
```

Do zrobienia w web:

1. Dodac stabilny web `device_id` w localStorage albo IndexedDB.
2. Dodac `registerWebDevice(supabase)` w sync layer.
3. Wywolac rejestracje po potwierdzonym auth i przed/po odblokowaniu sync.
4. Uzywac tego samego `device_id` przy `encrypted_records`.
5. Dodac testy store/writer dla payloadu `user_devices`.

## Priorytet 4 - fixtures z macOS

Bez fixtures nie ma dowodu kompatybilnosci. Potrzebne sa fixtures wygenerowane z `origin/claude/hungry-goodall-1227f7`:

1. Plain JSON payload dla:
   - `account`
   - `asset`
   - `transaction`
   - `manualValuation`
   - `income` earning
   - `income` burden
   - `settings`
2. Zaszyfrowane `encrypted_records` z tym samym formatem AES-GCM.
3. Snapshot eksportowany z macOS dla tego samego datasetu.

Po stronie web:

1. Dodac fixtures do `tests/fixtures/macos-refactor/`.
2. Dodac test `macos-refactor-fixtures.test.ts`.
3. Test ma:
   - parsowac payload envelope,
   - odszyfrowac encrypted records,
   - zbudowac snapshot web,
   - porownac z macOS snapshot w tolerancji numerycznej.

## Priorytet 5 - staging validation

Po domknieciu payloadow i fixtures:

1. Uruchomic:

```bash
npm run preflight:staging
npm run typecheck
npm test
npm run lint
npm run build
npm run test:e2e:fake-sync
```

2. Przejsc `docs/STAGING_VALIDATION.md`.
3. Wypelnic `docs/STAGING_VALIDATION_REPORT.md`.
4. Zamknac tylko wtedy, gdy:
   - web czyta dane zapisane przez macOS,
   - macOS czyta dane zapisane przez web,
   - `income` nie powoduje parity drift,
   - `user_devices` web pojawia sie na staging,
   - RLS przechodzi test na dwoch kontach,
   - tombstones i konflikty dzialaja po obu stronach.

## Kolejnosc implementacji

1. Web read compatibility dla rozszerzonych payloadow macOS - zrobione lokalnie.
2. Web write compatibility dla wymaganych pol macOS - zrobione lokalnie dla UI writes.
3. `income` parser i minimalny model raportowy - zrobione lokalnie.
4. `user_devices` heartbeat - zrobione lokalnie.
5. Generator/eksport fixtures z macOS refactor branch - do zrobienia.
6. Web tests na fixtures - do zrobienia.
7. Staging validation - do zrobienia.

## Ryzyko glowne

Najwiekszym ryzykiem nie jest szyfrowanie, tylko drift semantyczny payloadow po refactorze macOS. `income`, nowe pola `transaction` i nowe parametry `asset` moga nie psuc samego dekodowania Zod, ale moga powodowac rozne snapshoty i raporty. Dlatego najpierw trzeba zamknac fixtures i snapshot diff, a dopiero potem staging.
