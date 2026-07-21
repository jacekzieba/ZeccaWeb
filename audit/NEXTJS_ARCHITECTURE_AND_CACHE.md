# Zecca Web — Architektura Next.js, cache i renderowanie

**Router:** App Router (wyłącznie). **Brak** Pages Router, **brak** Server Actions, **brak** RSC pobierających dane portfela (model klient-shell + E2E). Runtime route’ów: Node.js (jawnie `runtime = "nodejs"` w waitlist/csp; middleware domyślnie).

## Mapa tras (z buildu)

| Trasa | Render | Cache/Revalidate | Dane użytkownika | Ryzyko wycieku |
| --- | --- | --- | --- | --- |
| `/` | Static ○ | statyczny landing | brak (marketing) | brak |
| `/demo` | Static ○ | statyczny (dane syntetyczne) | brak | brak |
| `/faq`, `/privacy-policy` | Static ○ | statyczny | brak | brak |
| `/login`,`/register`,`/forgot-password`,`/reset-password` | Static ○ | statyczny shell; auth po stronie klienta | brak w HTML | brak |
| `/dashboard`,`/positions`,`/portfolios`,`/portfolios/[id]`,`/transactions`,`/instruments`,`/earnings`,`/benchmark`,`/reports`,`/import`,`/settings` | Dynamic ƒ | `force-dynamic` (layout) | tylko `{id,email,onboarding}` z serwera; reszta E2E w kliencie | brak (patrz niżej) |
| `/api/market-data/*` | Dynamic ƒ | in-memory cache + `fetch next.revalidate` | brak (dane publiczne) | brak |
| `/api/sync/bootstrap` | Dynamic ƒ | brak cache (per-request, `getUser`) | tylko szyfrogram | brak |
| `/api/beta-waitlist`,`/api/csp-report`,`/api/health`,`/api/market-data/status` | Dynamic ƒ | brak | brak | brak |
| `/auth/callback`,`/auth/confirm` | Dynamic ƒ | brak | wymiana tokenu → cookies | [OPEN-REDIRECT] |
| `robots.txt`,`sitemap.xml` | Static ○ | statyczny | brak | brak |

## Server vs Client Components
- Root `app/layout.tsx`: Server Component; montuje `<Analytics/>`+`<SpeedInsights/>` (patrz [ANALYTICS-CONSENT]). Ustawia `lang="pl"`, `data-theme`.
- `app/(app)/layout.tsx`: Server Component, `export const dynamic = "force-dynamic"`; `getUser()`, odczyt `profiles.onboarding_completed_at`, `redirect('/login')`. **Do klienta przekazuje wyłącznie** `{ id, email, onboardingCompleted }` — brak serializacji obiektu użytkownika/tokenów. CONFIRMED, brak nadmiaru pól.
- Strony app: Client Components (formularze, tabele, wykresy) pobierające dane przez `/api/sync/bootstrap` i odszyfrowujące w kliencie. Serwer nie renderuje danych portfela → **brak danych prywatnych w HTML**.
- `use client` na liściach; brak importu modułów serwerowych/sekretów do klienta (grep czysty).

## Server Actions / Route Handlers / Middleware
- **Server Actions:** nie występują (brak `"use server"` w mutacjach). Mutacje danych idą przez supabase-js (RLS) z klienta oraz route bootstrap (odczyt).
- **Route Handlers:** publiczne proxy danych (rate-limit + walidacja + stałe hosty), waitlist (honeypot+zod+rate-limit), csp-report (rate-limit), bootstrap (getUser→RLS). Metody: tylko `GET`/`POST` zdefiniowane; niezdefiniowane metody zwraca Next 405. Odpowiedzi nie ujawniają stack trace ani wewnętrznych identyfikatorów (błędy generyczne; detale dostawcy tylko poza produkcją w waitlist).
- **Middleware:** `getUser()` na każdy request (walidacja JWT), CSP-Report-Only+nonce, gate redirectów. **Nie jest jedyną warstwą authz** — layout serwerowy i RLS powtarzają kontrolę. Matcher wyklucza statyki. Koszt: sieciowe `getUser()` per-request (wydajność — do rozważenia cache/`getClaims` gdzie bezpieczne).

## Cache i revalidation
- **Full Route Cache:** trasy app są `ƒ` (force-dynamic) → nie są cache’owane statycznie z danymi użytkownika. Marketing/auth `○` nie zawierają danych prywatnych. **Brak ryzyka statycznego utrwalenia danych użytkownika.**
- **Data Cache / fetch:** providerzy Yahoo używają `next: { revalidate: 15min/60min }` (dane publiczne, bez cookies) — bezpieczne. NBP/GUS przez in-memory cache (TTL). Bootstrap nie cache’uje (per-user, `getUser`).
- **Router Cache (klient):** nawigacja między trasami `ƒ` nie serwuje cudzych danych (render per-request). Wylogowanie robi twardą nawigację `window.location.assign('/login')`.
- **CDN/przeglądarka:** odpowiedzi API nie ustawiają `Cache-Control public` na danych prywatnych; bootstrap zależny od sesji (cookie) i `getUser`. **Zalecenie:** jawnie dodać `Cache-Control: private, no-store` na `/api/sync/bootstrap` (obecnie brak jawnego nagłówka — poleganie na dynamiczności; niski priorytet, defensywnie warto).

## Hydration / rendering
- Wartości niedeterministyczne (`crypto.randomUUID` nonce) tylko w middleware (nie w komponentach) → brak mismatchu. Daty w silniku liczone w UTC. Brak `Math.random`/`window` w ścieżce SSR komponentów. Build bez ostrzeżeń hydratacji.

## Ryzyko wycieku między użytkownikami
**Nie wykryto** wycieku plaintextu między użytkownikami. Warstwy ochronne: (1) trasy app dynamiczne, (2) serwer nie zna danych (E2E), (3) RLS na odczyt/zapis, (4) klucz per-user w IndexedDB czyszczony przy wylogowaniu. Jedyny resztkowy stan to metadane kolejki sync na współdzielonym urządzeniu ([LOGOUT-QUEUE-RESIDUE], LOW, bez plaintextu).

## Rekomendowana architektura docelowa (zmiany minimalne)
1. Zachować model klient-shell + E2E (mocny). 
2. Egzekwować CSP (nonce+strict-dynamic) po obserwacji.
3. Dodać `Cache-Control: private, no-store` na endpointach zależnych od sesji (defensywnie).
4. Rozważyć redukcję kosztu `getUser()` w middleware (np. lekka walidacja + pełny `getUser` w layout/route) — tylko jeśli wydajność tego wymaga; nie kosztem bezpieczeństwa.
5. Domknąć dryf schematu, by środowiska z migracji były wierne produkcji ([SYNC-SCHEMA-DRIFT]).
