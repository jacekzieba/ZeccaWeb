# InvestorWeb

Webowa wersja Investora. Projekt jest osobnym klientem Next.js dla tego samego prywatnego modelu synchronizacji: Supabase Auth, zaszyfrowane rekordy w Postgresie i odszyfrowanie danych wyłącznie po stronie przeglądarki.

## Status

Etap 6 jest domknięty lokalnie. Aplikacja zawiera:

- Next.js App Router + TypeScript.
- Tailwind CSS + daisyUI z motywem `investor`.
- Shell aplikacji, dashboard, portfele, instrumenty, transakcje, raporty i import.
- Supabase browser/server clients i typy minimalnego kontraktu DB.
- Klientowy panel sesji Supabase, pobrania `encrypted_key_backups` i odblokowania rekordów sync passphrase.
- Migrację Supabase dla `profiles`, `user_devices`, `encrypted_records` i `encrypted_key_backups` z RLS.
- Web Crypto AES-GCM helpers zgodne z założeniem `ciphertext || auth_tag` w Base64.
- Zod schemas dla sync envelope.
- CRUD portfeli, instrumentów i transakcji na zaszyfrowanych rekordach sync.
- Import CSV/XLSX transakcji z preview, walidacją i raportem.
- Route handlery market data dla NBP FX i Yahoo quote z cache TTL.
- Historyczną wycenę portfela przez price resolver, manual valuations i FX dla daty.
- Vitest i Playwright, w tym fake-sync E2E dla pobrania ceny i zapisu `manualValuation`.

## Uruchomienie lokalne

```bash
npm install
cp .env.example .env.local
npm run dev
```

Aplikacja startuje na `http://127.0.0.1:3000`.

## Weryfikacja

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e:fake-sync
```

Przed walidacją staging dodatkowo sprawdź konfigurację Supabase:

```bash
npm run check:staging-env
```

Testy E2E wymagają lokalnej przeglądarki Playwright:

```bash
npx playwright install chromium
npm run test:e2e
```

## Dokumenty

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/STACK_DECISION.md](docs/STACK_DECISION.md)
- [docs/SYNC_CONTRACT.md](docs/SYNC_CONTRACT.md)
- [docs/CRYPTO_FIXTURES.md](docs/CRYPTO_FIXTURES.md)
- [docs/CHARTING_DECISION.md](docs/CHARTING_DECISION.md)
- [docs/MARKET_DATA_DECISION.md](docs/MARKET_DATA_DECISION.md)
- [docs/VALUATION_DECISION.md](docs/VALUATION_DECISION.md)
- [docs/STAGING_VALIDATION.md](docs/STAGING_VALIDATION.md)
- [docs/STAGING_VALIDATION_REPORT.md](docs/STAGING_VALIDATION_REPORT.md)
- [docs/ROADMAP.md](docs/ROADMAP.md)
