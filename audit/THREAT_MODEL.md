# Zecca Web — Model zagrożeń

## Aktywa
- **A1** Jawne dane portfela (kwoty, tickery, transakcje) — najwrażliwsze; chronione E2E (istnieją tylko w pamięci karty).
- **A2** Klucz szyfrujący `userDataKey` i fraza sync.
- **A3** Sesja/tokeny Supabase (cookies).
- **A4** E-mail/konto.
- **A5** Sekrety serwerowe (service-role, Airtable).
- **A6** Integralność wyników obliczeń.
- **A7** Dostępność i limity dostawców danych (Yahoo/NBP/GUS).

## Aktorzy zagrożeń
- Nieuwierzytelniony napastnik zewnętrzny.
- Uwierzytelniony użytkownik próbujący sięgnąć cudzych danych.
- Napastnik na współdzielonym urządzeniu/przeglądarce.
- Złośliwy/przejęty skrypt third-party (analityka, xlsx).
- Insider / kompromitacja dostawcy (Supabase/Vercel/TelemetryDeck/Airtable).

## Granice zaufania
`Przeglądarka (niezaufana) → Vercel/CDN → Next.js (middleware/route) → Supabase (RLS) / Edge Function / zewnętrzne API`. Granica E2E: dane jawne nigdy nie przekraczają przeglądarki.

## Scenariusze nadużyć i status

| # | Scenariusz | Wektor | Zabezpieczenie istniejące | Ryzyko rezydualne |
| --- | --- | --- | --- | --- |
| T1 | Nieautoryzowany dostęp do konta | kradzież hasła, credential stuffing | Supabase Auth (rate-limit serwerowy), OAuth; `getUser()` walidacja | MFA/limity — NOT ASSESSED (dashboard) |
| T2 | Odczyt danych innego użytkownika | IDOR/BOLA na `encrypted_records`/bootstrap | RLS `auth.uid()=user_id`; bootstrap `getUser`→RLS; nawet po odczycie — szyfrogram | Niskie (RLS + E2E) |
| T3 | Zapis do cudzych danych | manipulacja payloadem sync | RLS `with check (auth.uid()=user_id)` | Niskie |
| T4 | Manipulacja wynikiem obliczeń | podmiana danych wejściowych/API | walidacja zod, deterministyczny silnik, parytet | Fallback obligacji zaniża ([BOND-STALE-FALLBACK]) |
| T5 | Manipulacja danymi z API (MITM/zła odpowiedź) | zła odpowiedź Yahoo/NBP | zod na odpowiedziach, HTTPS, cache TTL | Niskie; FX `missing=1` do oznaczenia |
| T6 | Nadużycie kosztownego endpointu | flood proxy danych | rate-limit (per-IP), cache | Obejście przez spoof XFF ([RATE-LIMIT-XFF]) |
| T7 | Kradzież sesji | XSS → token | token w cookies (nie JS), CSP-planowany, React escaping | CSP nieegzekwowany ([CSP-REPORT-ONLY]) |
| T8 | XSS | wstrzyknięcie do DOM | React escaping; dangerouslySetInnerHTML statyczny | JSON-LD escaping ([DANGEROUS-HTML]); brak egzekwowanego CSP |
| T9 | CSRF | cross-site mutacja | supabase-js (Authorization), brak Server Actions, cookies SSR | Niskie |
| T10 | SSRF | proxy pobiera URL usera | hosty stałe, symbol regex, encodeURIComponent | Brak |
| T11 | Open redirect | `next` w callbacku | guard (obchodzalny) + wymóg tokenu | [OPEN-REDIRECT] LOW |
| T12 | Supply-chain compromise | zależność/CDN | lockfile, pinned; xlsx z CDN | [XLSX-CDN]; brak SRI dla /_vercel (same-origin) |
| T13 | Złośliwy skrypt third-party | analityka/perf | same-origin, connect-src ograniczony | Zależność od Vercel/TelemetryDeck; CSP nieegzekwowany |
| T14 | Wyciek sekretu | sekret w kliencie/repo | brak `NEXT_PUBLIC` na sekretach; `.env.local` poza gitem | Preview env — NOT ASSESSED ([PREVIEW-INDEX]) |
| T15 | Manipulacja cache | cache poisoning/leak między userami | trasy app dynamiczne; bootstrap per-user; brak cache prywatnego | Dodać `no-store` defensywnie |
| T16 | Scraping / automatyzacja | boty na waitlist/proxy | honeypot, zod, rate-limit | Limit obejścia ([RATE-LIMIT-XFF]) |
| T17 | Współdzielone urządzenie | dostęp do resztek po wylogowaniu | klucz IndexedDB czyszczony; twarda nawigacja | Kolejka/profil web ([LOGOUT-QUEUE-RESIDUE]) |
| T18 | Usunięcie cudzego konta | wywołanie Edge Function | weryfikacja własnego JWT; usuwa tylko właściciela | Niskie (CORS `*` bez wpływu) |

## Zabezpieczenia brakujące (priorytetowo)
- Egzekwowany CSP (T7/T8/T13).
- Monitoring/alerting (wykrycie T1/T4/T5/T6 w czasie rzeczywistym) — [NO-ERROR-REPORTING].
- Trwały, niespoofowalny rate-limit (T6/T16).
- Potwierdzenie izolacji preview i konfiguracji Auth (T1/T14).

## Ryzyko rezydualne (po obecnych kontrolach)
Ogólnie **niskie–umiarkowane**. Najsilniejsze filary (E2E + RLS) neutralizują najgroźniejsze klasy (T2/T3/T7-kradzież-danych). Rezydualne ryzyko koncentruje się w: obserwowalności (ślepota na incydenty), egzekwowaniu CSP, odtwarzalności DR (dryf) oraz higienie współdzielonego urządzenia.
