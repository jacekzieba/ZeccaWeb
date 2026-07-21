# Zecca Web — Plan testów przedprodukcyjnych

Stan obecny: **334 testy jednostkowe (vitest) PASS**, Playwright skonfigurowany (auth-e2e, fake-sync, staging-smoke, staging-destructive). Poniżej luki i konkretne uzupełnienia powiązane ze znaleziskami.

## Jednostkowe (istniejące — mocne)
Silnik: `bond-valuation`, `investor-snapshot`, `realized-pnl`, `price-resolver`, `bond-cpi-injection`, `bond-reference-rate-injection`, `portfolio-valuation-consistency`. Sync/kryptografia: `aes-gcm`, `key-backup`, `key-cache`, `envelope`, `record-writer`, `sync-conflict-resolution`, `sync-cycle`, `encrypted-records`. Market-data: `market-data-routes`, `yahoo`/`nbp`/`finwire`/`treasury-bond-params` providers. Parytet: `macos-payloads`, `macos-refactor-fixtures`, `certification-scenario`, `ike-ikze-usage`.

## Do dodania (powiązane ze znaleziskami)

### Jednostkowe / komponentowe
1. **Open-redirect guard** ([OPEN-REDIRECT]): wektory `['/\\evil.com','/\t//evil.com','//evil.com','https://evil.com','/ok?x=1']` → tylko same-origin honorowane.
2. **Rate-limit XFF** ([RATE-LIMIT-XFF]): rotujący spoof `X-Forwarded-For` nie resetuje licznika; klucz po realnym IP.
3. **Logout clears queue** ([LOGOUT-QUEUE-RESIDUE]): po `handleLogout` brak `investor-web-pending-sync-v1`.
4. **Bond macro-gap w UI** ([BOND-STALE-FALLBACK]): flaga `treasuryBondMacroGaps` renderuje widoczne ostrzeżenie na dashboard/pozycjach/raportach.
5. **parse-amount separatory** ([PARSE-AMOUNT-SEP]): tabela wektorów z oczekiwaniami/odrzuceniami.
6. **JSON-LD escaping** ([DANGEROUS-HTML]): brak surowego `<` w wyjściu FAQ.
7. **A11y formularzy** ([A11Y-FORM-LABELS]): accessible name pól (login/register/transactions/instruments/settings).
8. **XIRR golden** ([XIRR-DAYCOUNT]): vs Excel na referencyjnym cashflow.

### Kontraktowe API (klient ↔ Supabase/dostawcy)
- Kontrakt `encrypted_records` (kolumny, onConflict) vs migracje — test wykrywający dryf ([SYNC-SCHEMA-DRIFT]); w CI `supabase db diff`.
- Schematy zod dostawców vs realne kształty odpowiedzi (snapshot fixtures Yahoo/NBP/GUS) — wykrycie zmiany kontraktu.
- RLS-smoke (`check:rls-smoke`, dwie tożsamości) — utrzymać w preflight.

### E2E (Playwright)
- Auth: rejestracja→confirm→login→logout→sesja unieważniona; „wstecz" po wylogowaniu nie pokazuje danych z cache.
- Sync: utworzenie rekordu offline→enqueue→flush; konflikt→rozwiązanie; zmiana konta na tym samym urządzeniu nie ujawnia danych poprzednika.
- Bezpieczeństwo: nagłówki (po egzekwowaniu CSP), open-redirect, brak indeksacji prywatnych tras.
- Odporność (bezpieczny zakres): 401/403/404/409/422/429/5xx, zły/niepełny JSON, timeout, offline — komunikaty i brak fałszywego sukcesu.

### Dostępność
- axe-core na kluczowych ekranach; testy klawiatury (focus order, brak pułapek, widoczny focus); czytnik ekranu na formularzach; wykresy Chart.js — alternatywa tabelaryczna + opis trendu.

### Wydajność
- CWV (lab: Lighthouse; teren: Speed Insights) na `/`, `/demo`, `/dashboard`, `/import`, `/settings`; budżet bundle (regresja rozmiaru).

### Bezpieczeństwo
- Statyczne: `npm audit`/skaner (poza CDN xlsx — śledzić ręcznie); przegląd sekretów w bundlu (`grep NEXT_PUBLIC` + inspekcja).
- Dynamiczne (staging oznaczony): weryfikacja RLS między dwoma kontami, brak IDOR na bootstrap.

## Bramki jakości (CI)
1. `typecheck` + `lint` (0 warning po [LINT-WARN]).
2. `vitest run` zielone + nowe testy z findings.
3. `supabase db diff` pusty ([SYNC-SCHEMA-DRIFT]).
4. `check:sync-compat` (parytet natywny), `check:staging-env`.
5. Build produkcyjny bez ostrzeżeń hydratacji.

## Smoke po wdrożeniu
- `/api/health`, `/api/market-data/status`, logowanie testowego konta, bootstrap zwraca szyfrogram, nagłówki bezpieczeństwa obecne, brak błędów w error-reportingu przez pierwsze N minut.

## Testy rollbacku
- Migracje wstecznie zgodne (dodanie constraintu → drop). E2E na poprzedniej wersji artefaktu po rollbacku Vercel.
