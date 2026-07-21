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

## Cookies sesyjne (do potwierdzenia w runtime — NOT ASSESSED)
Flagi ustawiane przez `@supabase/ssr`. Zweryfikować w produkcji: `HttpOnly`, `Secure`, `SameSite=Lax/Strict`, prefiks `__Host-`/`__Secure-`, brak dostępu JS, zakres domeny/ścieżki, zachowanie na subdomenach i preview.
