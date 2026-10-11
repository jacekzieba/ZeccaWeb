# Plan: co zostało w webie (stan 2026-10-11)

Kolejność = kolejność realizacji. Każdy krok: osobna gałąź/PR, TDD, bramka `typecheck` + `test` + `lint`.

| # | Zakres | Kto | Weryfikacja |
|---|--------|-----|-------------|
| 1 | Docelowa vs aktualna (Faza 0+1 z `PLAN_DRIFT_REBALANCING.md`) | Claude | unit + fake-sync E2E |
| 2 | Rebalansing `buyOnly` (Faza 2a), tylko prezentacyjny | Claude | unit, brak zapisu do sync |
| 3 | Brakujące wykresy dashboardu: podział walut, dywidendy, odsetki, P&L w czasie, drawdown, benchmark vs inflacja | Claude | unit na seriach + widok |
| 4 | Dashboard: drag-and-drop i resize sekcji (`zecca.dashboard.sections.v1`) | Claude | unit na reducerze układu + e2e |
| 5 | WebAuthn/passkey jako odblokowanie App Lock | Claude (+ test na realnym urządzeniu: użytkownik) | unit + ręczny test |
| 6 | Odświeżenie `ROADMAP.md`, usunięcie nieaktualnego `parity-gaps-todo.md` | Claude | review |
| 7 | Staging (Etap 7): deploy `delete-account`, parytet web↔native, tombstone native→web, inspekcja sieci providerów | **użytkownik** | `docs/STAGING_VALIDATION.md` |

Pkt 7 jest blokerem produkcyjnym i wymaga dostępu, którego Claude nie ma (deploy funkcji Supabase, natywna aplikacja, passphrase) – równolegle do 1–6.
