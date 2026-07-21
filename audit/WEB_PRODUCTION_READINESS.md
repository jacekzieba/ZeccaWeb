# Zecca Web — Lista kontrolna gotowości produkcyjnej

Legenda: `PASS` · `FAIL` · `PARTIAL` · `NOT ASSESSED` · `NOT APPLICABLE`

| Obszar | Status | Dowód / uwaga |
| --- | --- | --- |
| **Build produkcyjny** | PASS | `next build` exit 0, 30 stron, 15.5.18 |
| Typecheck | PASS | `tsc --noEmit` exit 0 |
| Lint | PASS | exit 0, 1 warning ([LINT-WARN]) |
| Testy jednostkowe | PASS | 334/334, 63 pliki |
| Testy E2E | PARTIAL | Playwright skonfigurowany (auth/fake-sync/staging), wymaga środowiska; nieuruchamiane w audycie |
| Błędy hydratacji | PASS | brak w buildzie; wartości niedeterministyczne (nonce) tylko w middleware |
| **Bezpieczeństwo — authz** | PASS | RLS + `getUser()` w middleware/layout/route; obrona w głąb |
| Bezpieczeństwo — sekrety | PASS | brak sekretu w kliencie; `.env.local` poza gitem; ostrzeżenie w `.env.example` |
| Bezpieczeństwo — SSRF | PASS | hosty stałe, symbol regex, `encodeURIComponent` |
| Bezpieczeństwo — nagłówki | PARTIAL | HSTS/XFO/nosniff/Referrer/Permissions PASS; **CSP tylko Report-Only** ([CSP-REPORT-ONLY]) |
| Bezpieczeństwo — XSS | PARTIAL | React escaping; `dangerouslySetInnerHTML` statyczny; JSON-LD bez escapowania `<` ([DANGEROUS-HTML]) |
| Bezpieczeństwo — CSRF | PASS | supabase-js (Authorization), brak Server Actions, cookies SSR |
| Bezpieczeństwo — open redirect | PARTIAL | guard `next` obchodzalny ([OPEN-REDIRECT], LOW, bramka tokenu) |
| Bezpieczeństwo — rate limiting | PARTIAL | obecny, ale klucz spoofowalny + per-instance ([RATE-LIMIT-XFF]) |
| **Prywatność — model danych** | PASS | zero-knowledge E2E (AES-256-GCM, PBKDF2 600k) |
| Prywatność — polityka vs kod | PASS | polityka zgodna; ujawnia Vercel/TelemetryDeck |
| Prywatność — zgody/analityka | PARTIAL | brak bramki zgody; podstawa prawna — ocena IOD ([ANALYTICS-CONSENT]) |
| Prywatność — storage/logout | PARTIAL | klucz IndexedDB czyszczony; kolejka sync nie zawsze ([LOGOUT-QUEUE-RESIDUE]) |
| Prywatność — usuwanie konta | PASS | self-service + Edge Function (cascade) |
| **Dostępność (WCAG 2.2 AA)** | PARTIAL/NOT ASSESSED | etykiety niepowiązane ([A11Y-FORM-LABELS]); pełny runtime audyt NOT ASSESSED |
| **Wydajność (CWV)** | NOT ASSESSED | brak danych terenowych; bundlе `/demo` 304 kB, `/settings` 223 kB |
| **SEO** | PASS | robots blokuje prywatne, sitemap tylko publiczne, metadata OK |
| SEO — preview noindex | NOT ASSESSED | zależne od Vercel ([PREVIEW-INDEX]) |
| **Deployment — env prod/preview** | NOT ASSESSED | brak dostępu do dashboardu Vercel |
| Deployment — odtwarzalność/DR z migracji | FAIL | dryf schematu ([SYNC-SCHEMA-DRIFT]) łamie zapisy sync w środowisku z migracji |
| Deployment — CI/CD, branch protection, OIDC | NOT ASSESSED | brak dostępu |
| **Monitoring/observability** | FAIL | brak SDK błędów/awarii ([NO-ERROR-REPORTING]); tylko `console.*`+CSP report |
| **Backup / DR / PITR** | NOT ASSESSED | zależne od planu Supabase; nietestowane odtworzenie |
| **Rollback** | NOT ASSESSED | zależne od Vercel; migracje wstecznie-zgodne — częściowo (patrz dryf) |
| **Testy — pokrycie krytyczne** | PARTIAL | silnik/sync/RLS-smoke mocne; brak a11y i regresji dla 2 findings |
| **Dokumentacja** | PARTIAL | README, AGENTS/CLAUDE, komentarze bogate; brak runbooka incydentów |
| **Reagowanie na incydenty** | FAIL | brak procesu/alertów (wynika z braku monitoringu) |
| **Płatności** | NOT APPLICABLE | brak integracji płatności |
| **CAPTCHA/bot** | PARTIAL | honeypot na waitlist; brak ochrony bot na auth (Supabase server-side) |

## Podsumowanie gotowości
Rdzeń (bezpieczeństwo danych, authz, obliczenia, build/testy) jest **produkcyjnie solidny**. Do domknięcia przed pełną gotowością: **odtwarzalność z migracji (DR)**, **monitoring błędów**, **egzekwowanie CSP**, **a11y formularzy**, **podstawa prawna analityki** oraz potwierdzenie **izolacji preview**. Stąd rekomendacja **CONDITIONAL GO**.
