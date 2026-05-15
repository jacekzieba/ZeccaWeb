# Roadmap

## Etap 0 - przygotowanie repo

1. Utworzyc repo `InvestorWeb`.
2. Zainicjalizowac Next.js + TypeScript.
3. Dodac daisyUI i podstawowy theme.
4. Dodac Supabase client/server helpers.
5. Dodac Vitest i Playwright.

## Etap 1 - auth i klucz

1. Ekrany logowania/rejestracji przez Supabase Auth.
2. Obsluga sesji server-side przez cookies.
3. Pobranie `encrypted_key_backups`.
4. Odblokowanie `userDataKey` passphrase.
5. Test vectors zgodnosci Web Crypto z CryptoKit.

## Etap 2 - read-only sync

1. Pobranie `encrypted_records`.
2. Odszyfrowanie payloadow w przegladarce.
3. Walidacja Zod dla envelope.
4. Zlozenie `InvestorDataSnapshot`.
5. Dashboard read-only z Chart.js.

## Etap 3 - domena web

1. Port TypeScript podstawowych modeli domenowych.
2. Ledger i holdings.
3. Wycena manualna i seria wartosci portfela.
4. Alokacja aktywow, walut i portfeli.
5. Testy porownujace wyniki z wersja Swift na fixtures.

## Etap 4 - edycja

1. CRUD portfeli.
2. CRUD instrumentow.
3. CRUD transakcji.
4. Lokalny pending sync queue.
5. Konflikty i tombstones.

## Etap 5 - import i providerzy

1. Import CSV/XLSX w przegladarce.
2. Preview importu.
3. Proxy providerow market data przez route handlers albo Supabase Edge Functions.
4. Cache cen i kursow.
