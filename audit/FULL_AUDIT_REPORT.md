# Zecca Web — Pełny raport audytu

**Data:** 2026-07-21 · **Tryb:** read-only · **Metoda:** analiza kodu + uruchomione lokalnie: typecheck, lint, 334 testy jednostkowe, produkcyjny build. Brak testów aktywnych na produkcji.

Statusy dowodu: `CONFIRMED` (potwierdzone kodem/testem) · `HIGHLY LIKELY` · `POTENTIAL` · `NOT ASSESSED` · `NOT APPLICABLE`.

---

## 1. Inwentaryzacja systemu (Faza 1)

| Element | Wartość | Dowód |
| --- | --- | --- |
| Next.js | ^15.3.1 (build: 15.5.18) | package.json:37, build.log |
| React | 19.1.0 | package.json:38 |
| TypeScript | 5.8.3, `strict: true` | package.json:60, tsconfig.json:7 |
| Node (lokalnie) | 25.3.0 | `node -v` |
| Router | App Router (`app/`) | struktura `app/` |
| Renderowanie | Marketing/auth: statyczne (`○`); app + `/api/*` + `/auth/*`: dynamiczne (`ƒ`) | build.log |
| Package manager | npm (`package-lock.json`) | root |
| Backend | Supabase: Auth + Postgres(RLS) + Realtime + Edge Function | middleware.ts, migracje, `supabase/functions/delete-account` |
| Uwierzytelnianie | Supabase Auth (hasło + OAuth Google/Apple + magic/OTP) | login-form.tsx, auth/callback, auth/confirm |
| Autoryzacja | Postgres RLS (`auth.uid() = user_id`) | migracje 0001/0003/0006 |
| Sesja | Cookies Supabase SSR, walidacja `getUser()` | middleware.ts:77 |
| Szyfrowanie | AES-256-GCM + PBKDF2-SHA256 (600k), zero-knowledge | aes-gcm.ts, key-backup.ts |
| Dane rynkowe | Yahoo, NBP, GUS, finwire, obligacjeskarbowe (serwerowo) | `src/market-data/providers/*` |
| Analityka | TelemetryDeck (opt-out), Vercel Analytics, Speed Insights | layout.tsx, telemetry/* |
| Error reporting | **Brak** (tylko `console.*` + CSP report) | grep — NO-ERROR-REPORTING |
| Płatności | **Brak** (lista beta przez Airtable) | NOT APPLICABLE |
| Testy | 334 unit (vitest) + Playwright (fake-sync/auth/staging) | tests/, playwright.*.config.ts |

**Diagram przepływu (granice zaufania):**

```
Browser (untrusted)
  │  cookies (Supabase session), form input, URL params
  ▼
CDN / Vercel  ──►  Next.js middleware  ── getUser() (walidacja JWT) ──► redirect gate
  │                                    └─ CSP-Report-Only + nonce
  ▼
┌─ Route Handlers /api/market-data/*  (public, rate-limited, walidacja, stałe hosty) ──► Yahoo/NBP/GUS
├─ /api/sync/bootstrap  (getUser → RLS)  ──► Supabase encrypted_records (tylko szyfrogram)
├─ /api/beta-waitlist   (public, honeypot+zod+rate-limit) ──► Airtable (token serwerowy)
└─ app/(app)/*  (force-dynamic, getUser, klient-shell) ──► /api/sync/bootstrap
        │  odszyfrowanie w pamięci karty (userDataKey z IndexedDB)   ◄── GRANICA E2E
        ▼
   Silnik obliczeniowy (src/domain/*) — czysty, deterministyczny
```

**Granica E2E:** serwer i baza przechowują wyłącznie szyfrogram + metadane (id, typ, znaczniki czasu, device_id). Odszyfrowanie następuje tylko w przeglądarce. Potwierdzone: `app/api/sync/bootstrap/route.ts` selektuje `encrypted_payload/nonce/...`, nigdy plaintextu.

---

## 2. Build i testy (Faza 2)

| Polecenie | Wynik | Kod | Uwagi |
| --- | --- | --- | --- |
| `tsc --noEmit` | PASS | 0 | brak błędów typów |
| `eslint .` | PASS | 0 | 1 warning (LINT-WARN) |
| `vitest run` | PASS | 0 | 334 testy / 63 pliki, 7.66 s |
| `next build` | PASS | 0 | 30 stron statycznych, middleware 89.1 kB |

Ostrzeżenie buildu: `--localstorage-file was provided without a valid path` (środowiskowe, nieistotne). Sam zielony build/testy nie są dowodem poprawności całości — patrz Faza 5.

---

## 3. Architektura Next.js i React (Faza 3)

**Mocne strony (CONFIRMED):**
- Czysty podział: `src/domain` (obliczenia, bez zależności od sync/UI), `src/sync` (E2E), `src/market-data` (proxy), `src/features` (UI). Zależności idą w jedną stronę.
- Obrona w głąb autoryzacji: `middleware.ts` (gate) + `app/(app)/layout.tsx` `force-dynamic` z `getUser()` i `redirect('/login')` + RLS. Middleware **nie jest** jedyną warstwą.
- Wszystkie trasy uwierzytelnione są `ƒ` (dynamiczne) → brak statycznego utrwalania danych użytkownika. Serwer przekazuje do klienta tylko `{id, email, onboardingCompleted}` (layout).
- `use client` na liściach (formularze, panele), nie wysoko w drzewie.
- Brak importu sekretów w modułach klienta (grep czysty; sekrety tylko w route’ach serwerowych i Edge Function).

**Uwagi:** brak egzekwowanego CSP (patrz [CSP-REPORT-ONLY]); jeden `getSession()` wyłącznie w UI ([GETSESSION-UI], INFO).

Szczegóły tras, cache i renderowania: `NEXTJS_ARCHITECTURE_AND_CACHE.md`.

---

## 4. TypeScript i jakość kodu (Faza 4)

- `strict: true`, `noEmit`, brak `any`-wycieków w warstwie domenowej; dane zewnętrzne walidowane runtime przez **zod** (yahoo.ts, envelope.ts, market-data, beta-waitlist). TypeScript nie jest mylony z walidacją — schematy zod są obecne na granicach (API, formularze, bootstrap).
- Daty liczone w UTC (`startOfUtcDay`, `addMonths` z korektą końca miesiąca) — spójne, niezależne od strefy.
- Jedno ostrzeżenie lint (INFO).

---

## 5. Silnik obliczeniowy (Faza 5)

Pełny raport: `CALCULATION_ENGINE_AUDIT.md`. Skrót:
- **Wiarygodny i deterministyczny.** XIRR (Newton-Raphson + bisekcja, Actual/365 — [XIRR-DAYCOUNT]), max drawdown, zwrot nominalny/realny, rozstrzyganie ceny (manual→market→transaction→missing), FX (historia→transakcja→konwersja), akrual obligacji detalicznych wg reguł polskich (inflacja m-2, marża, ujemna inflacja jako 0). Parytet z aplikacją natywną w testach.
- **Zastrzeżenie [BOND-STALE-FALLBACK, MEDIUM]:** brak danych makro → „sama marża" (zaniżenie). Detektor `treasuryBondMacroGaps` istnieje; potwierdzić ekspozycję ostrzeżenia w UI.
- **[PARSE-AMOUNT-SEP, LOW]:** separatory tysięcy odrzucane/mylone; parytet z natywnym.

---

## 6–7. Bezpieczeństwo API i webowe (Fazy 6–7)

- **SSRF:** brak. Hosty dostawców zaszyte na stałe; symbol Yahoo walidowany regexem `^[A-Z0-9.^=_-]{1,32}$`, query `encodeURIComponent`. (yahoo.ts:32,177,242)
- **Authz/IDOR:** RLS `auth.uid() = user_id` na każdej tabeli i operacji; brak polityk DELETE (soft-delete) i INSERT dla profiles → deny-by-default. Edge Function usuwania konta weryfikuje własny JWT (`admin.auth.getUser(token)`), usuwa tylko właściciela tokenu — mimo `CORS: *` nie da się usunąć cudzego konta.
- **CSRF:** operacje mutujące idą przez supabase-js (nagłówek `Authorization`/`apikey`, nie ambient cookie w cross-site), cookies Supabase SSR. Server Actions nie są używane. Ryzyko niskie.
- **Open redirect [OPEN-REDIRECT, LOW]:** obejście guardu `next` w `/auth/callback` i `/auth/confirm` (`/\evil.com`, `/\t//evil.com` → `https://evil.com/`, CONFIRMED node); bramkowane ważnym jednorazowym tokenem, login ignoruje `next`.
- **XSS [DANGEROUS-HTML, LOW]:** `dangerouslySetInnerHTML` na statycznym landingu/FAQ; JSON-LD bez escapowania `<`. Brak żywego exploitu.
- **Nagłówki:** HSTS(preload), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy — obecne (next.config.ts). CSP tylko Report-Only [CSP-REPORT-ONLY, MEDIUM]. Szczegóły: `SECURITY_HEADERS_AND_BROWSER_CONTROLS.md`.
- **Rate limiting [RATE-LIMIT-XFF, LOW]:** klucz na spoofowalny lewy `X-Forwarded-For`, in-memory per-instance.
- **Upload/import:** parsowanie xlsx/csv w kliencie na własnym pliku; brak `eval`/`Function`/`__proto__` (grep czysty). Biblioteka xlsx z CDN [XLSX-CDN, INFO].

---

## 8. Sekrety i env (Faza 8)

- Brak sekretu w kodzie/bundlu klienta (grep). `NEXT_PUBLIC_*` tylko: URL/ANON_KEY Supabase (publiczne z założenia), FAKE_SYNC*, TELEMETRYDECK_APP_ID (publiczny identyfikator), APP_VERSION/BUILD_SHA, BETA_WAITLIST_ENABLED, TELEMETRY_DISABLED.
- Sekrety serwerowe: `AIRTABLE_*` (route), `SUPABASE_SERVICE_ROLE_KEY` tylko w Edge Function (Deno), `SUPABASE_TEST_SERVICE_ROLE_KEY` w testach. `.env.example` jawnie ostrzega: *"service-role key … must never use a NEXT_PUBLIC_ prefix"*.
- `.env.local` **nie jest** w gitcie (`git ls-files` — brak; `.gitignore` obejmuje `.env*`). CONFIRMED.
- `FAKE_SYNC` bypass auth działa tylko gdy `NODE_ENV !== 'production'` (middleware.ts:32, env.ts:20) → w produkcyjnym buildzie wyłączony. CONFIRMED.

---

## 9. Dane lokalne w przeglądarce (Faza 9)

Szczegóły: `DATA_FLOW_AND_PRIVACY.md`. Skrót:
- **localStorage:** kolejka sync (tylko szyfrogram + metadane), profil, język, preferencje UI, id urządzenia web. **Brak** tokenów i jawnych danych finansowych.
- **sessionStorage:** app-lock PIN jako słaby hash ([APP-LOCK-PIN, LOW], jawnie „nie jest granicą bezpieczeństwa").
- **IndexedDB:** `userDataKey` (CryptoKey nieeksportowalny), usuwany przy wylogowaniu.
- **Token sesji:** cookies Supabase, niedostępne dla JS (HttpOnly ustawiane przez Supabase SSR — do potwierdzenia w runtime).
- **[LOGOUT-QUEUE-RESIDUE, LOW]:** wylogowanie z paska bocznego nie czyści kolejki sync (czyści ją tylko wylogowanie z Ustawień) → resztkowe metadane na współdzielonym urządzeniu.

---

## 10. Prywatność (Faza 10)

- Polityka prywatności (`app/privacy-policy/page.tsx`) **zgodna z kodem**: ujawnia TelemetryDeck (Augsburg, EU), Vercel Analytics i Speed Insights, klucz w IndexedDB usuwany przy wylogowaniu, tylko niezbędne cookies Supabase.
- Data minimization mocna: serwer nie widzi treści portfela; telemetria bez kwot/tickerów/e-maili (ephemeral anon id).
- **[ANALYTICS-CONSENT, MEDIUM]:** analityka ładowana bez bramki zgody — kwestia podstawy prawnej dla UE → **wymaga oceny prawnika/IOD** (nie orzekamy prawnie).
- Usuwanie konta: self-service w Ustawieniach + Edge Function (cascade delete). Eksport/poprawianie: opisane w polityce.

---

## 11. Klasyfikacja produktu finansowego (Faza 11)

Klasyfikacja: **kalkulator/analityka portfela + symulacja** (kategorie 1, 4, 5). Brak wykonywania transakcji, pośrednictwa, personalizowanej rekomendacji. Do weryfikacji prawnej (nie orzekamy):
- Czy prezentacja wyników nie sugeruje gwarantowanego zysku (przegląd landingu/copy).
- Disclaimer „nie stanowi porady inwestycyjnej" i jawność założeń (inflacja, brak/uwzględnienie opłat i podatków).
- Rozróżnienie danych historycznych / prognoz / symulacji w UI (patrz `UX` — Faza 15 w tym raporcie skrótowo, pełny audyt UX runtime NOT ASSESSED).

---

## 12. Uwierzytelnianie i UX konta (Faza 12)

- `getUser()` (walidacja z serwerem auth) używany wszędzie dla decyzji serwerowych. Login pokazuje generyczny błąd Supabase (brak enumeracji). OAuth `redirectTo=/auth/callback`.
- Wylogowanie: czyści klucz z IndexedDB + `signOut()`. **Ale** pasek boczny nie czyści kolejki sync ([LOGOUT-QUEUE-RESIDUE]).
- Konfiguracja Supabase Auth (polityka haseł, MFA, allowlista redirect, limity) — **NOT ASSESSED** (dashboard).

---

## 13. Płatności (Faza 13) — **NOT APPLICABLE**

Brak integracji płatności/subskrypcji w kodzie. Jedyny zewnętrzny zapis to lista beta (Airtable) z honeypotem, zod i rate-limitem, token serwerowy.

---

## 14. Dostępność WCAG 2.2 AA (Faza 14)

- **[A11Y-FORM-LABELS, MEDIUM] CONFIRMED:** etykiety formularzy auth niepowiązane z polami (brak `htmlFor`/`id`), prawdopodobnie systemowo. WCAG 1.3.1 / 4.1.2.
- `lang="pl"` ustawiony (layout). `aria-*`/`role` w ~21/50 komponentów — częściowa świadomość, nie kompletna.
- **Pełny audyt WCAG 2.2 AA (klawiatura, focus, kontrast, live regions, wykresy Chart.js, zoom/reflow, cele dotykowe) — NOT ASSESSED** (wymaga uruchomionej aplikacji + axe + testów manualnych). Chart.js domyślnie nie daje alternatywy tabelarycznej — do weryfikacji.

---

## 15. UX finansowy (Faza 15) — częściowo, runtime NOT ASSESSED

- `parseAmount` — separatory ([PARSE-AMOUNT-SEP]). `formatCurrency` ukrywa grosze ([CURRENCY-FMT, INFO]).
- Ostrzeżenie o starych/niepełnych danych obligacji ([BOND-STALE-FALLBACK]) — potwierdzić ekspozycję.
- Dark patterns / prezentacja ryzyka / jawność opłat — wymaga przeglądu treści na uruchomionej aplikacji (NOT ASSESSED).

---

## 16. Wydajność (Faza 16) — orientacyjnie (bez danych terenowych)

- First Load JS: `/demo` 304 kB (publiczne), `/settings` 223 kB, `/forgot-password`/`/login`/`/register` ~190 kB, wspólne 103 kB. Chart.js dokłada wagi.
- Trasy app dynamiczne (`ƒ`) — koszt SSR + `getUser()` na żądanie; middleware `getUser()` na każdy request (koszt sieciowy).
- **Rzeczywiste Core Web Vitals / dane terenowe — NOT ASSESSED.** Rekomendacja: zmierzyć CWV (Speed Insights już zbiera), rozważyć dynamic import ciężkich widoków (import/settings) i lazy Chart.js.

---

## 17. SEO (Faza 17)

- `robots.ts` blokuje wszystkie trasy prywatne i `/api/`, `/auth/`; `sitemap.ts` zawiera tylko `/`, `/demo`, `/faq`, `/privacy-policy` — brak wycieku prywatnych URL. Metadata bazowa ustawiona (`metadataBase=https://zecca.pl`).
- `noindex` na preview i izolacja env preview — **[PREVIEW-INDEX, NOT ASSESSED]**.
- FAQ ma JSON-LD (structured data) — patrz [DANGEROUS-HTML] co do escapowania.

---

## 18. Stabilność i odporność (Faza 18)

- Route’y danych rynkowych zwracają 400 (walidacja), 502 (błąd dostawcy), 429 (limit); zod chroni przed złym JSON od Yahoo. Bootstrap: 401 bez sesji, 500 na błąd DB.
- Kolejka sync z retry + rozwiązywaniem konfliktów (`SyncConflictError`, testy `sync-conflict-resolution`).
- Zmiana konta w drugiej karcie / wielokrotne kliknięcia / offline — częściowo pokryte kolejką; [LOGOUT-QUEUE-RESIDUE] to jedyny wykryty resztkowy stan.

---

## 19. Logowanie, monitoring, observability (Faza 19)

- **[NO-ERROR-REPORTING, MEDIUM]:** brak SDK błędów/awarii; tylko `console.warn/error` + `/api/csp-report`. Brak korelacji, alertów, wykrywania anomalii (5xx, awaria dostawcy, błędne wyceny).
- Route’y nie logują payloadów/tokenów/e-maili (przegląd `console.*` — logują status + skróconą treść błędu dostawcy, w waitlist detale tylko poza produkcją). Dobra higiena logów w route’ach.

---

## 20. Deployment / infrastruktura (Faza 20)

- **[SYNC-SCHEMA-DRIFT, HIGH]:** `onConflict:"id"` vs deklarowany PK złożony → środowisko z migracji nie zapisuje sync. DR/rebuild zagrożone.
- Migracje wersjonowane, utwardzane. Edge Function `delete-account` `verify_jwt=false` z własną weryfikacją (uzasadnione preflightem CORS).
- CI/CD, ochrona branchy, OIDC, provenance, backup/DR, izolacja preview — **NOT ASSESSED** (brak dostępu do dashboardów).

---

## 21. Supply chain (Faza 21)

Szczegóły: `DEPENDENCY_AND_SUPPLY_CHAIN.md`. Lockfile obecny (`package-lock.json`), wersje przypięte (poza xlsx z CDN — [XLSX-CDN]). `overrides.postcss`. Brak jawnych `postinstall` w bezpośrednich zależnościach do potwierdzenia skanerem (bez modyfikacji projektu).

---

## 22. Testy i jakość procesu (Faza 22)

Szczegóły: `TEST_PLAN.md`. 334 testy jednostkowe realnie testują zachowanie (parytet, wartości brzegowe obligacji, RLS-smoke, market-data, sync). Braki: brak testów a11y, brak testu regresyjnego dla open-redirect i logout-queue, E2E zależne od stagingu.

---

## Katalog znalezisk (szczegóły)

Format pól zgodny z wymaganiem. Pełne dane maszynowe: `FINDINGS.json`.

### [SYNC-SCHEMA-DRIFT] Rozjazd klucza `encrypted_records` między kodem a migracją
- **Obszar:** deployment / warstwa danych
- **Ryzyko:** HIGH
- **Status dowodu:** CONFIRMED (sprzeczność kod↔migracja); wpływ produkcyjny HIGHLY LIKELY
- **Pewność:** wysoka
- **Standard:** OWASP ASVS V1 (architektura/odtwarzalność), praktyki IaC/DR
- **Lokalizacja:** `src/sync/records/supabase-sync-store.ts:167` vs `supabase/migrations/0001_initial_sync.sql:38`
- **Opis:** upsert używa `onConflict:"id"`, migracja deklaruje `primary key (user_id, record_type, id)` bez unikatu na `id`.
- **Dowód:** `.upsert([payload], { onConflict: "id" })`; PK złożony w 0001. Produkcja działa tylko dzięki zdryfowanemu żywemu schematowi (PK/unikat na `id`).
- **Scenariusz:** rebuild stagingu/DR/nowy region z migracji → każdy zapis sync kończy się błędem 42P10.
- **Wpływ:** brak odtwarzalności; DR faktycznie niesprawne.
- **Rekomendacja:** migracja ustawiająca realny unikat/PK na `id` **albo** zmiana upsertu na `onConflict:"user_id,record_type,id"`; `supabase db diff` w CI.
- **Test poprawki:** świeży projekt z samych migracji → zapis sync przechodzi.
- **Test regresyjny:** CI `supabase db diff` = pusty względem produkcji.
- **Szacowana trudność:** M

### [CSP-REPORT-ONLY] CSP tylko w trybie Report-Only
- **Obszar:** nagłówki bezpieczeństwa / XSS · **Ryzyko:** MEDIUM · **Dowód:** CONFIRMED · **Pewność:** wysoka
- **Standard:** OWASP ASVS 14.4, CSP Level 3 · **Lokalizacja:** `middleware.ts:41`
- **Opis/Dowód:** ustawiany jest wyłącznie `Content-Security-Policy-Report-Only`; brak egzekwowanego CSP w `next.config.ts`.
- **Scenariusz:** przyszły sink (kompromitacja skryptu third-party, dynamiczny wpis do dangerouslySetInnerHTML) wykonuje się bez blokady.
- **Wpływ:** brak obrony w głąb przed wstrzyknięciem skryptu.
- **Rekomendacja:** po analizie raportów przełączyć na egzekwowanie z nonce+strict-dynamic; potwierdzić Vercel/TelemetryDeck.
- **Test poprawki:** wstrzyknięty inline `<script>` zablokowany; brak naruszeń dla funkcji first-party.
- **Test regresyjny:** e2e sprawdzający nagłówek `Content-Security-Policy` (nie -Report-Only) i brak naruszeń.
- **Trudność:** M

### [NO-ERROR-REPORTING] Brak raportowania błędów/awarii
- **Obszar:** observability · **Ryzyko:** MEDIUM · **Dowód:** CONFIRMED · **Pewność:** wysoka
- **Standard:** OWASP ASVS V7 (logging/monitoring) · **Lokalizacja:** `app/layout.tsx:4` (brak SDK błędów)
- **Opis/Dowód:** grep bez Sentry/Bugsnag/Rollbar/OTel; route’y logują `console.*`.
- **Scenariusz:** produkcyjna awaria (zła wycena, dostawca offline, wyjątek) niewidoczna do zgłoszenia użytkownika.
- **Wpływ:** brak wykrywania i reakcji na incydenty.
- **Rekomendacja:** SDK błędów (klient+serwer) z redakcją PII; alerty 5xx / 502 dostawców / wolumen CSP.
- **Test poprawki:** testowy wyjątek widoczny w narzędziu, bez PII.
- **Test regresyjny:** syntetyczny błąd → alert.
- **Trudność:** M

### [A11Y-FORM-LABELS] Etykiety niepowiązane z polami
- **Obszar:** dostępność · **Ryzyko:** MEDIUM · **Dowód:** CONFIRMED (formularze auth) · **Pewność:** wysoka
- **Standard:** WCAG 2.2 — 1.3.1, 4.1.2 · **Lokalizacja:** `src/features/auth/login-form.tsx:183`, `signup-form.tsx:133+`
- **Opis/Dowód:** `<label>` jako rodzeństwo `<input>`, brak `htmlFor`/`id`/opakowania.
- **Scenariusz:** czytnik ekranu nie ogłasza etykiety pola na ścieżce logowania/rejestracji.
- **Wpływ:** bariera dla użytkowników AT na krytycznej ścieżce.
- **Rekomendacja:** powiązać `htmlFor`/`id` (lub opakować/`aria-label`); przegląd wszystkich formularzy.
- **Test poprawki:** axe bez naruszeń etykiet; VoiceOver ogłasza pole.
- **Test regresyjny:** test komponentu sprawdzający accessible name pól.
- **Trudność:** M

### [ANALYTICS-CONSENT] Analityka bez bramki zgody
- **Obszar:** prywatność · **Ryzyko:** MEDIUM · **Dowód:** HIGHLY LIKELY · **Pewność:** średnia
- **Standard:** GDPR/ePrivacy — **wymaga oceny prawnika/IOD** · **Lokalizacja:** `app/layout.tsx:31`
- **Opis/Dowód:** `<Analytics/>`+`<SpeedInsights/>` w root layout dla wszystkich; ujawnione w polityce, bezcookie, ale przetwarzają dane pochodne IP.
- **Scenariusz:** analityka uznana za nie-niezbędną bez ważnej podstawy prawnej dla UE.
- **Wpływ:** ekspozycja prawna (do oceny przez IOD).
- **Rekomendacja:** sign-off IOD / ocena uzasadnionego interesu albo bramka zgody.
- **Test poprawki:** pisemna akceptacja IOD; brak zapisu w device storage przed zgodą.
- **Test regresyjny:** e2e brak żądań analityki przed zgodą (jeśli wybrana bramka).
- **Trudność:** S

### [BOND-STALE-FALLBACK] Cichy fallback wyceny obligacji
- **Obszar:** silnik obliczeniowy · **Ryzyko:** MEDIUM · **Dowód:** HIGHLY LIKELY · **Pewność:** średnia
- **Standard:** aplikacje finansowe — brak wprowadzania w błąd co do aktualności · **Lokalizacja:** `src/domain/valuation/bond-rates.ts:137,129`
- **Opis/Dowód:** przy braku CPI/stopy NBP zwraca `max(0, marża)`; tabele fallback kończą się 2026-06 (CPI) / 2026-03 (NBP).
- **Scenariusz:** awaria bootstrapu danych → późniejsze okresy wyceniane samą marżą → zaniżenie.
- **Wpływ:** wartość obligacji zaniżona, potencjalnie mylące.
- **Rekomendacja:** potwierdzić, że `treasuryBondMacroGaps` daje widoczne ostrzeżenie na każdym widoku; nie prezentować fallbacku jako aktualnej wyceny.
- **Test poprawki:** obligacja bez CPI pokazuje wskaźnik „wycena przybliżona" na dashboard/pozycjach/raportach.
- **Test regresyjny:** test propagacji flagi luki makro do UI.
- **Trudność:** M

### [OPEN-REDIRECT] Obejście guardu `next` (LOW)
- **Obszar:** bezpieczeństwo (CWE-601) · **Ryzyko:** LOW · **Dowód:** CONFIRMED · **Pewność:** wysoka
- **Standard:** OWASP ASVS 5.1, CWE-601 · **Lokalizacja:** `app/auth/callback/route.ts:8`, `app/auth/confirm/route.ts:23`
- **Opis/Dowód:** `!startsWith('//')` omija `/\evil.com` i `/\t//evil.com` → `https://evil.com/` (test WHATWG URL). Bramkowane ważnym jednorazowym tokenem; login ignoruje `next`.
- **Scenariusz:** przekierowanie na obcy origin po poprawnym callbacku, jeśli atakujący złoży URL z ważnym tokenem i złośliwym `next`.
- **Wpływ:** phishing; niska realność (wymóg tokenu).
- **Rekomendacja:** odrzucać backslash/znaki sterujące; wymagać `new URL(next, origin).origin === origin`. Zweryfikować allowlistę Redirect URLs w Supabase.
- **Test poprawki:** zestaw wektorów rozwiązuje się do ścieżki same-origin.
- **Test regresyjny:** unit na guard z wektorami `/\`, `/\t//`, `//`, `https:`.
- **Trudność:** S

### [RATE-LIMIT-XFF] Limiter na spoofowalnym XFF (LOW)
- **Obszar:** bezpieczeństwo API · **Ryzyko:** LOW · **Dowód:** CONFIRMED · **Pewność:** wysoka
- **Standard:** OWASP API4 (resource consumption) · **Lokalizacja:** `src/market-data/rate-limit.ts:22`
- **Opis/Dowód:** klucz = lewy wpis `X-Forwarded-For` (kontrolowany przez klienta na Vercel); stan in-memory per-instance.
- **Scenariusz:** rotacja spoofowanego XFF resetuje licznik → obejście limitu, palenie limitów dostawców.
- **Wpływ:** ograniczony (proxy danych publicznych, brak stanu użytkownika).
- **Rekomendacja:** klucz na `x-real-ip`/IP platformy; dla trwałości KV/Redis.
- **Test poprawki:** rotujący spoof XFF nadal throttlowany po realnym IP.
- **Test regresyjny:** test limitera ignorującego lewy XFF.
- **Trudność:** S

### [LOGOUT-QUEUE-RESIDUE] Wylogowanie z paska nie czyści kolejki sync (LOW)
- **Obszar:** prywatność / współdzielone urządzenie · **Ryzyko:** LOW · **Dowód:** CONFIRMED · **Pewność:** wysoka
- **Standard:** OWASP ASVS 8.2 (ochrona danych klienta) · **Lokalizacja:** `src/components/layout/app-shell.tsx:155`
- **Opis/Dowód:** `handleLogout` czyści klucz IndexedDB, ale nie `clearPendingSyncOperations()`; Ustawienia czyszczą (settings-page.tsx:463). Klucz kolejki globalny, nie per-user. RLS blokuje zapis międzykontowy — resztka to szyfrogram + metadane.
- **Scenariusz:** użytkownik B na tej samej przeglądarce widzi w localStorage metadane operacji użytkownika A (typy/liczba/czas).
- **Wpływ:** drobny wyciek metadanych + mylące błędy sync; brak plaintextu.
- **Rekomendacja:** wywołać `clearPendingSyncOperations()` w wylogowaniu paska; rozważyć namespacing klucza po user id.
- **Test poprawki:** po wylogowaniu z paska brak wpisu `investor-web-pending-sync-v1`.
- **Test regresyjny:** test jednostkowy flow wylogowania.
- **Trudność:** XS

### [PARSE-AMOUNT-SEP] Separatory w `parseAmount` (LOW)
- **Obszar:** obliczenia / UX · **Ryzyko:** LOW · **Dowód:** CONFIRMED · **Pewność:** wysoka
- **Standard:** UX finansowy — jednoznaczność liczby · **Lokalizacja:** `src/lib/parse-amount.ts:24`
- **Opis/Dowód:** `replace(',', '.')` tylko pierwszy przecinek; grupowanie odrzucane, `1,234`→1.234. Parytet z natywnym.
- **Scenariusz:** użytkownik wpisuje `1 234,56` → odrzucone; `1,234` → 1000× za mało.
- **Wpływ:** ograniczony (konwencja pl-PL), ale mylący.
- **Rekomendacja:** jeśli kontrakt pozwala, usuwać spacje/grupowanie i jawnie odrzucać niejednoznaczne z podpowiedzią.
- **Test poprawki/regresji:** tabela wektorów z oczekiwaniami.
- **Trudność:** S

### [DANGEROUS-HTML] Wstrzykiwanie HTML/JSON-LD (LOW)
- **Obszar:** bezpieczeństwo (XSS) · **Ryzyko:** LOW · **Dowód:** CONFIRMED · **Pewność:** wysoka
- **Standard:** OWASP XSS Prevention · **Lokalizacja:** `app/page.tsx:115`, `app/_landing/landing-hero.tsx:21`, `app/faq/page.tsx:189`
- **Opis/Dowód:** źródła statyczne (build-time); JSON-LD `JSON.stringify` bez escapowania `<`.
- **Scenariusz:** brak żywego exploitu; latentny XSS gdyby sink dostał dane dynamiczne.
- **Wpływ:** brak obecnie.
- **Rekomendacja:** escapować `<`→`<` w JSON-LD; reguła lint zakazująca dynamiki w stałych landingu.
- **Test poprawki/regresji:** snapshot JSON-LD bez surowego `<`.
- **Trudność:** XS

### [APP-LOCK-PIN] Słaby hash PIN app-lock (LOW)
- **Obszar:** bezpieczeństwo (obrona w głąb) · **Ryzyko:** LOW · **Dowód:** CONFIRMED · **Pewność:** wysoka
- **Lokalizacja:** `src/features/auth/app-lock.tsx:17`
- **Opis/Dowód:** „prosty deterministyczny hash" w sessionStorage, jawnie „nie granica bezpieczeństwa"; nie chroni szyfrogramu ani klucza.
- **Rekomendacja:** nie prezentować jako ochrony danych; opcjonalnie wyprowadzić blokadę z KDF gatując klucz.
- **Trudność:** S

### INFO
`GETSESSION-UI`, `XIRR-DAYCOUNT`, `CACHE-INMEM`, `CURRENCY-FMT`, `XLSX-CDN`, `LINT-WARN`, `PREVIEW-INDEX` — szczegóły w `FINDINGS.json`.
