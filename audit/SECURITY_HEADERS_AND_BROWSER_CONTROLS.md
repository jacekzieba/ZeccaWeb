# Zecca Web — Nagłówki bezpieczeństwa i kontrole przeglądarki

> Rekomendacja, bez zmian w konfiguracji produkcyjnej.

## Stan obecny

Źródła: `next.config.ts` (globalne nagłówki dla `/:path*`) i `middleware.ts` (CSP-Report-Only + nonce).

| Nagłówek | Stan | Wartość / uwaga |
| --- | --- | --- |
| Strict-Transport-Security | PASS | `max-age=63072000; includeSubDomains; preload` |
| X-Frame-Options | PASS | `DENY` (plus CSP `frame-ancestors 'none'`) |
| X-Content-Type-Options | PASS | `nosniff` |
| Referrer-Policy | PASS | `strict-origin-when-cross-origin` |
| Permissions-Policy | PASS | `camera=(), microphone=(), geolocation=()` |
| Content-Security-Policy | **FAIL (nieegzekwowany)** | tylko `-Report-Only` w middleware ([CSP-REPORT-ONLY]) |
| Cross-Origin-Opener-Policy | BRAK | rekomendowane `same-origin` |
| Cross-Origin-Resource-Policy | BRAK | rekomendowane `same-origin` |
| Cross-Origin-Embedder-Policy | N/A | tylko jeśli potrzebna izolacja (nie wymagana) |
| Cache-Control (dane prywatne) | BRAK jawnie | polega na dynamiczności; dodać `private, no-store` na `/api/sync/bootstrap` |

## CSP (obecny Report-Only)
```
default-src 'self';
script-src 'self' 'nonce-<rnd>' 'strict-dynamic' https: 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self';
connect-src 'self' https://*.supabase.co wss://*.supabase.co https://nom.telemetrydeck.com;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
object-src 'none';
report-uri /api/csp-report;
```
Ocena: dobra konstrukcja docelowa (nonce+strict-dynamic; `https:`/`unsafe-inline` to fallback ignorowany przez nowoczesne przeglądarki przy strict-dynamic). `connect-src` obejmuje Supabase (REST+realtime) i TelemetryDeck. Vercel Analytics/Speed Insights ładują skrypt z tego samego origin (`/_vercel/*`) → pokryte `'self'`.

## CSRF
- Brak Server Actions. Mutacje przez supabase-js (nagłówek `Authorization`, nie ambient cookie w cross-site). Cookies Supabase SSR. `form-action 'self'`. Ryzyko niskie; brak zmian mutujących przez GET.

## CORS
- Aplikacja web nie wystawia własnego CORS na `/api/*` (te route’y są konsumowane przez tę samą aplikację; dane rynkowe są publiczne). Edge Function `delete-account` używa `Access-Control-Allow-Origin: *` — akceptowalne, bo autoryzacja jest przez token w nagłówku (nie cookie), a operacja dotyczy wyłącznie właściciela tokenu. Rekomendacja: zawęzić origin do domeny produkcyjnej, jeśli to nie łamie preflightu.

## Framing / clickjacking
- `X-Frame-Options: DENY` + `frame-ancestors 'none'` (po egzekwowaniu CSP). PASS.

## Rekomendowana konfiguracja docelowa (propozycja, do wdrożenia po obserwacji)

Nagłówki statyczne (`next.config.ts`), dodać:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```
Na endpointach zależnych od sesji (`/api/sync/bootstrap`, `/auth/*`):
```
Cache-Control: private, no-store
```

CSP egzekwowany (middleware, po analizie raportów) — ten sam policy, nagłówek `Content-Security-Policy` zamiast `-Report-Only`. Kroki wdrożenia:
1. Zebrać raporty z `/api/csp-report` (już działa).
2. Zidentyfikować legalne źródła (Supabase, TelemetryDeck, `/_vercel/*`, inline bootstrap Next z nonce).
3. Usunąć zbędny `https:`/`unsafe-inline` gdy potwierdzone, że nonce+strict-dynamic wystarcza.
4. Przełączyć na egzekwowanie na stagingu, potem produkcji.
5. Utrzymać `report-uri`/`report-to` dla monitoringu.

### ⚠️ Weryfikacja runtime (2026-07-21) — egzekwowanie obecnego policy ŁAMIE strony statyczne

Podczas prób przełączenia na egzekwowanie (prod build + `next start`) potwierdzono **empirycznie**, że policy z `'strict-dynamic'` + nonce **psuje statycznie prerenderowane strony** (`/`, `/login`, `/register`, `/demo`, `/faq`, `/privacy-policy`, `/forgot-password`, `/reset-password`).

**Dowód (sonda w przeglądarce na egzekwowanym buildzie):**
- nagłówek `Content-Security-Policy` (egzekwujący) obecny, z `nonce-…`;
- `scriptSrcWithNonce: 0` — żaden `<script src="/_next/…">` nie ma nonce;
- `inlineExecFirstHasNonce: false`, **`window.__next_f` === undefined** → inline bootstrap RSC Next (`self.__next_f.push`) **zablokowany**, JS strony się nie wykonuje.

**Przyczyna:** strony statyczne mają skrypty „zapieczone" w czasie buildu, więc nie mogą dostać per-request nonce. `'strict-dynamic'` każe przeglądarce **ignorować** `'self'`/`'unsafe-inline'`, więc wszystkie nienoncowane skrypty (w tym bootstrap Next) są blokowane. Mechanizm nonce Next działa tylko dla stron **dynamicznych** (renderowanych na żądanie). Dlatego zmiana została **wycofana** — middleware pozostaje w Report-Only.

**Do decyzji właściciela — dwie realne drogi:**
1. **Zachować strony statyczne → egzekwować słabszy `script-src`:** usunąć `'strict-dynamic'` i nonce, ustawić `script-src 'self' 'unsafe-inline'` (opcjonalnie bez `https:`). Wtedy egzekwowane są WSZYSTKIE pozostałe dyrektywy (`connect-src`, `frame-ancestors`, `object-src`, `base-uri`, `form-action`, `default-src`) — realna wartość — kosztem słabszej ochrony skryptów (dopuszczony inline). Nie łamie stron statycznych.
2. **Zachować silny nonce+strict-dynamic → zdynamizować strony:** dodać `export const dynamic = "force-dynamic"` do stron auth/marketingowych, aby Next stemplował nonce na żądanie. Pełna ochrona XSS, ale utrata statycznej generacji (wolniejszy TTFB, koszt SSR) tych stron.

Rekomendacja: (1) jako szybki, bezpieczny krok pośredni (egzekwuje dyrektywy niezwiązane ze skryptami), a docelowo rozważyć (2) tylko dla stron z realnym ryzykiem wstrzyknięcia.

### ✅ ROZWIĄZANIE WDROŻONE (2026-07-21) — opcja (1), zweryfikowane runtime

W `middleware.ts` wdrożono **egzekwowany CSP w produkcji** (Report-Only w dev), z polityką skryptów `script-src 'self' 'unsafe-inline'` (bez `strict-dynamic`/nonce). Wszystkie pozostałe dyrektywy egzekwowane ściśle: `default-src 'self'`, `connect-src` (self + Supabase + TelemetryDeck), `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `img-src 'self' data:`, `style-src 'self' 'unsafe-inline'`, `report-uri /api/csp-report`.

**Weryfikacja na produkcyjnym buildzie (`next build` + `next start`, przeglądarka):**
- Nagłówek `Content-Security-Policy` (egzekwujący) obecny na `/` i `/login`.
- `window.__next_f` **zdefiniowane** (len 19 / 7), React zhydrowany → **JS stron działa** (w przeciwieństwie do wariantu strict-dynamic).
- **Zero naruszeń CSP** w konsoli na `/` i `/login`; strona logowania renderuje się i jest interaktywna.
- Skrypt Vercel Analytics (`/_vercel/*`, same-origin) ładuje się pod `script-src 'self'`.

**Kompromis (świadomy):** `'unsafe-inline'` w `script-src` dopuszcza skrypty inline (wymagane przez bootstrap Next na stronach statycznych), więc ochrona przed inline-XSS jest słabsza niż nonce. Blokowane są jednak skrypty zewnętrzne/wstrzyknięte przez `src`, a ryzyko inline-XSS jest niskie (escaping React, brak dynamicznego `dangerouslySetInnerHTML`, escapowany JSON-LD). Ścieżka do pełnej ochrony nonce = opcja (2) w przyszłości.

## Cookies sesyjne (do potwierdzenia w runtime — NOT ASSESSED)
Flagi ustawiane przez `@supabase/ssr`. Zweryfikować w produkcji: `HttpOnly`, `Secure`, `SameSite=Lax/Strict`, prefiks `__Host-`/`__Secure-`, brak dostępu JS, zakres domeny/ścieżki, zachowanie na subdomenach i preview.
