# Zecca Web — Executive Summary

**Data audytu:** 2026-07-21 · **Tryb:** read-only (bez zmian w kodzie produkcyjnym) · **Zakres:** frontend Next.js + migracje RLS Supabase + serwerowe proxy danych rynkowych + klient E2E-sync. Backend zarządzany przez Supabase, dashboardy Vercel/CI, żywy schemat DB oraz pełna dostępność runtime/CWV — **NOT ASSESSED**.

## Ogólna ocena

Zecca Web to **dojrzale i świadomie zaprojektowana** aplikacja. Model danych jest zero-knowledge: rekordy portfela są szyfrowane na kliencie (AES-256-GCM, nonce 96-bit, klucze nieeksportowalne), a klucz użytkownika chroniony PBKDF2-SHA256 z 600 000 iteracji — serwer nigdy nie widzi jawnych danych. Autoryzacja opiera się na Postgres RLS z obroną w głąb (middleware → serwerowy layout `getUser()` → RLS), migracje są utwardzane (optymalizacja initplan, zablokowany `handle_new_user`, polityki `to authenticated`). Sekrety nie wyciekają do klienta, proxy danych rynkowych mają walidację wejścia, rate limiting i stałe hosty (brak SSRF), a polityka prywatności jest **zgodna z rzeczywistym kodem** (uczciwie ujawnia Vercel Analytics/Speed Insights i TelemetryDeck).

Weryfikacja przeszła w całości: **typecheck PASS, lint PASS (1 ostrzeżenie), 334 testy jednostkowe PASS (63 pliki), produkcyjny build PASS (Next.js 15.5.18, 30 stron statycznych).** Wszystkie trasy uwierzytelnione renderują się dynamicznie (`ƒ`) — żadne dane użytkownika nie są utrwalane statycznie.

**Nie znaleziono żadnego znaleziska BLOCKER ani CRITICAL.** Nie wykryto wycieku danych między użytkownikami ani sekretu w bundle klienta. Silnik obliczeniowy jest wiarygodny (parity-tested względem natywnej aplikacji), z jednym zastrzeżeniem dotyczącym cichego fallbacku wyceny obligacji przy braku danych makro.

## Rekomendacja: **CONDITIONAL GO**

Aplikacja może działać produkcyjnie w bieżącym (już zdryfowanym) środowisku, ale przed uznaniem jej za produkcyjnie dojrzałą należy spełnić warunki P0 poniżej. Najpoważniejsze ryzyko nie dotyczy bieżącej produkcji, lecz **odtwarzalności/DR**: kod i migracje nie zgadzają się co do klucza tabeli `encrypted_records`.

## Znaleziska według poziomu

| Poziom | Liczba |
| --- | --- |
| BLOCKER | 0 |
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 5 |
| LOW | 6 |
| INFO | 7 |
| **Razem** | **19** |

## Warunki wdrożenia produkcyjnego (P0)

1. **SYNC-SCHEMA-DRIFT (HIGH)** — pogodzić migracje z żywym schematem `encrypted_records` (PK na `id` vs deklarowany klucz złożony) tak, aby środowisko odtworzone z migracji poprawnie zapisywało dane. Dodać `supabase db diff` w CI.
2. **NO-ERROR-REPORTING (MEDIUM)** — wdrożyć raportowanie błędów/awarii (klient + serwer) z redakcją PII oraz alerty na 5xx / awarie dostawców danych.
3. **ANALYTICS-CONSENT (MEDIUM)** — uzyskać akceptację prawnika/IOD dla podstawy prawnej Vercel Analytics/Speed Insights (albo bramka zgody).
4. **CSP-REPORT-ONLY (MEDIUM)** — po analizie raportów przełączyć CSP z Report-Only na egzekwowanie.
5. Potwierdzić izolację środowisk **preview** (osobny projekt Supabase/Airtable, noindex, brak sekretów produkcyjnych) — **PREVIEW-INDEX (NOT ASSESSED)**.

## Pięć najważniejszych działań

1. Naprawić dryf schematu `encrypted_records` (kod ↔ migracja) i dodać kontrolę dryfu w CI.
2. Dodać monitoring błędów/awarii i alerty (obecnie tylko `console.*`).
3. Domknąć a11y formularzy (etykiety niepowiązane z polami — WCAG 1.3.1/4.1.2) i zaplanować pełny audyt WCAG 2.2 AA na uruchomionej aplikacji.
4. Przełączyć CSP na tryb egzekwowania po obserwacji raportów.
5. Zweryfikować podstawę prawną analityki (IOD) oraz izolację środowisk preview.

## Obszary niezaudytowane (NOT ASSESSED)

- Żywy schemat produkcyjnej bazy (dryf wywnioskowany z kodu i migracji, nie z zapytania).
- Konfiguracja Supabase Auth (polityka haseł, allowlista Redirect URLs, limity, szablony e-mail).
- Runtime dostępności (axe/klawiatura/czytnik ekranu), pełne WCAG 2.2 AA.
- Rzeczywiste Core Web Vitals / dane terenowe.
- CI/CD, ustawienia projektu Vercel, scoping zmiennych preview vs production, ochrona preview.
- Backupy / DR / PITR (zależne od planu Supabase).
- Płatności — **NOT APPLICABLE** (brak integracji płatności; jedynie lista beta przez Airtable).

## Czy silnik obliczeniowy jest wiarygodny?

**Tak, z jednym zastrzeżeniem.** Metryki (XIRR Newton-Raphson + bisekcja, max drawdown, zwrot nominalny/realny) i wycena (rozstrzyganie ceny, FX, akrual obligacji detalicznych wg reguł polskich) są czyste, deterministyczne i pokryte 334 testami z parytetem względem natywnej aplikacji. Zastrzeżenie: wycena obligacji indeksowanych/zmiennych po cichu spada do „sama marża" przy braku danych makro — istnieje detektor luk (`treasuryBondMacroGaps`), ale należy potwierdzić, że każdy widok faktycznie ostrzega użytkownika (**BOND-STALE-FALLBACK, MEDIUM**).
