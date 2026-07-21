# Zecca Web — Zależności i supply chain

Lockfile: **`package-lock.json` obecny** (npm). Wersje bezpośrednie przypięte zakresami `^` (typowe dla Next/React ekosystemu) — patrz uwaga o odtwarzalności. `overrides: { postcss: "$postcss" }`.

## Zależności produkcyjne (bezpośrednie)

| Pakiet | Wersja | Rola | Uwaga bezpieczeństwa/prywatności |
| --- | --- | --- | --- |
| next | ^15.3.1 (build 15.5.18) | framework | utrzymywać aktualne (patche bezpieczeństwa Next) |
| react / react-dom | ^19.1.0 | UI | — |
| @supabase/ssr | ^0.6.1 | sesja SSR/cookies | krytyczne dla auth — pinować dokładniej |
| @supabase/supabase-js | ^2.49.4 | klient DB/Auth | — |
| @tanstack/react-query, react-table | ^5.74 / ^8.21 | dane/tabele | — |
| chart.js / react-chartjs-2 | ^4.4 / ^5.3 | wykresy | waga bundle; a11y wykresów |
| zod | ^3.24 | walidacja runtime | filar walidacji danych zewn. |
| zustand | ^5.0 | stan | — |
| **xlsx** | **CDN tarball 0.20.3** | import/eksport | poza npm; integrity w lockfile; śledzić SheetJS ([XLSX-CDN]) |
| read-excel-file | ^9.0 | import | alternatywa dla części ścieżek xlsx |
| fflate | 0.8.3 (pinned) | kompresja | dobrze przypięte |
| @telemetrydeck/sdk | ^2.0 | analityka | prywatność — ephemeral id |
| @vercel/analytics, speed-insights | ^2.0 | analityka/perf | [ANALYTICS-CONSENT] |
| daisyui | ^4.12 | UI (Tailwind) | dev-oriented |
| clsx, lucide-react | ^2.1 / ^0.488 | util/ikony | — |

## Zależności deweloperskie (istotne)
`eslint` + `eslint-config-next`, `@playwright/test`, `vitest`, `@testing-library/react`, `jsdom`, `typescript`, `tailwindcss`, `postcss`, `autoprefixer`, `@types/*`. Nieużywane w produkcji → poza bundlem.

## Ocena ryzyka (reachability)
- **xlsx (CDN 0.20.3)**: SheetJS opuścił npm; to ich oficjalny kanał. 0.20.3 postdatuje znane CVE (prototype pollution CVE-2023-30533, ReDoS CVE-2024-22363). **Reachability:** parsowanie po stronie klienta na **własnym pliku użytkownika** → blast radius = własna karta. `npm audit` nie obejmie źródła CDN — śledzić ręcznie. Integralność zapewnia hash w lockfile (`npm ci`).
- **@supabase/ssr / supabase-js**: na ścieżce auth/sesji — najwyższy priorytet aktualizacji i dokładnego pinowania.
- **chart.js**: brak znanej krytycznej podatności; głównie waga.
- Brak wykrytych zależności z gałęzi Git, prywatnych rejestrów, ani dynamicznego pobierania kodu w runtime. Skrypty CDN third-party: Vercel Analytics/Speed Insights ładowane z **tego samego origin** (`/_vercel/*`) → SRI nie dotyczy; TelemetryDeck przez SDK (connect-src ograniczony).

## Braki / rekomendacje
1. **Przypiąć dokładniej** kluczowe pakiety bezpieczeństwa (Next, @supabase/*) lub polegać na lockfile + `npm ci` w CI (zweryfikować, że CI używa `npm ci`, nie `npm install`).
2. **Dependency scanning** w CI (np. `npm audit --production`, Dependabot/Renovate) z polityką: aktualizacje bezpieczeństwa priorytetowo, xlsx śledzony osobno (poza audit).
3. **SBOM** i weryfikacja integralności lockfile w pipeline.
4. **Skrypty instalacyjne**: zweryfikować (bez modyfikacji projektu) czy któreś zależności mają `postinstall`/`preinstall` z dostępem do środowiska build; w razie potrzeby `--ignore-scripts` + allowlista.
5. **Polityka aktualizacji**: kwartalny przegląd + natychmiastowe patche krytyczne; regresja przez pełny zestaw testów (334+) przed mergem.
6. **Nie aktualizować** zależności w ramach tej sesji audytowej (zgodnie z zakresem) — powyższe to rekomendacje do osobnego zadania.

## Licencje
Nie zweryfikowano licencji per-pakiet w tej sesji (NOT ASSESSED). Rekomendacja: uruchomić `license-checker` i potwierdzić kompatybilność (większość ekosystemu to MIT/Apache-2.0; potwierdzić xlsx (Apache-2.0) i daisyui (MIT)).
