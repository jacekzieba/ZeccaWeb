# InvestorWeb - architektura

## Zasada glowna

InvestorWeb nie powinien tworzyc osobnego modelu biznesowego. Web ma byc nowym klientem tego samego systemu danych:

- uzytkownik loguje sie przez Supabase Auth,
- pobiera zaszyfrowane rekordy z Supabase,
- odszyfrowuje je lokalnie w przegladarce,
- mapuje payloady na typy domenowe,
- przelicza portfel deterministycznie po stronie klienta lub w warstwie aplikacyjnej,
- wysyla do Supabase tylko zaszyfrowane payloady i metadane synchronizacji.

Supabase przechowuje tozsamosc, RLS, metadane sync i ciphertext. Nie powinien znac kwot, tickerow, nazw portfeli, notatek ani szczegolow transakcji.

## Repo

Rekomendowane osobne repo: `InvestorWeb`.

Uzasadnienie:

- inny toolchain: Node/Next zamiast SwiftPM/Xcode,
- inny CI: lint, typecheck, Playwright, build web,
- osobne zaleznosci frontendowe,
- osobny proces deployu,
- latwiejsze zarzadzanie release web bez dotykania natywnych targetow.

Wspolne miedzy repo powinny byc:

- specyfikacja sync payloadow,
- schemat Supabase,
- wersjonowanie `payloadVersion` i `schemaVersion`,
- test vectors szyfrowania,
- dokumentacja migracji.

## Warstwy

```text
InvestorWeb
  Next.js App Router
    routes, layouts, server actions, route handlers
  Feature Modules
    dashboard, portfolios, transactions, instruments, reports, sync, auth
  UI System
    daisyUI components, app components, charts, tables, forms
  Client Domain
    ledger, holdings, valuation, allocation, returns, imports
  Sync Layer
    encrypted records, conflict handling, local cache, key backup
  Supabase Integration
    auth, RLS-backed tables, generated database types
```

## Proponowana struktura

```text
app/
  (auth)/
  (app)/
    dashboard/
    portfolios/
    transactions/
    instruments/
    reports/
  api/
    market-data/
src/
  components/
    ui/
    charts/
    layout/
  features/
    auth/
    dashboard/
    portfolios/
    transactions/
    instruments/
    reports/
    sync/
  domain/
    models/
    ledger/
    valuation/
    performance/
  sync/
    encryption/
    envelopes/
    conflict-resolution/
  supabase/
    client.ts
    server.ts
    types.ts
  lib/
    dates.ts
    money.ts
    ids.ts
supabase/
  migrations/
  seed.sql
tests/
  unit/
  e2e/
```

## Rendering

Next.js App Router powinien byc uzyty ostroznie:

- Server Components dla shell, layoutow, auth gate i lekkich danych profilu.
- Client Components dla widokow portfela, tabel, wykresow, sync i odszyfrowanych danych.
- Server Actions tylko dla operacji, ktore faktycznie musza isc przez serwer.
- Dane wrażliwe po odszyfrowaniu nie powinny przechodzic przez server-rendered HTML.

## Lokalny stan i cache

Na start:

- TanStack Query do pobierania zaszyfrowanych rekordow i statusow sync.
- Zustand albo prosty reducer dla lokalnego stanu odszyfrowanego snapshotu, jesli TanStack Query zacznie byc niewygodny dla danych klientowych.
- IndexedDB dopiero po ustaleniu modelu offline. Nie warto dodawac jej w pierwszym commicie.

## Priorytet bezpieczenstwa

Kazda funkcja musi odpowiadac na pytanie: czy odszyfrowane dane opuszczaja przegladarke?

Domyslna odpowiedz powinna brzmiec: nie.

Wyjatki, np. import z pliku albo provider market data, musza miec osobna decyzje architektoniczna.
