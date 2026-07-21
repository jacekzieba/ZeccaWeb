# Zecca Web — Plan naprawczy

Priorytety: **P0** przed uznaniem za produkcyjnie dojrzałe · **P1** bezpośrednio po · **P2** kolejny etap · **P3** długoterminowo. Właściciele: FE (frontend), BE/DB (backend/Supabase), QA, DevOps, SEC (security), PROD (produkt), LEGAL (prawnik/IOD).

## P0 — przed wdrożeniem (warunki CONDITIONAL GO)

| Znalezisko | Właściciel | Zakres | Kryterium ukończenia | Test | Ryzyko wdrożenia / rollback |
| --- | --- | --- | --- | --- | --- |
| SYNC-SCHEMA-DRIFT (HIGH) | BE/DB | Migracja pogadzająca żywy schemat (unikat/PK na `encrypted_records.id`) **lub** zmiana upsertu na `onConflict:"user_id,record_type,id"`; `supabase db diff` w CI | Świeży projekt z migracji zapisuje sync; `db diff` pusty vs prod | Provision throwaway + e2e sync write; RLS-smoke | Migracja addytywna, wstecznie zgodna; rollback = drop dodanego constraintu |
| NO-ERROR-REPORTING (MEDIUM) | DevOps/FE | SDK błędów (klient+serwer) z redakcją PII; alerty 5xx / 502 dostawców | Testowy wyjątek widoczny bez PII; alert na syntetyczny błąd | Iniekcja błędu → wpis+alert | Dodatek obserwowalny; rollback = usunięcie SDK |
| ANALYTICS-CONSENT (MEDIUM) | LEGAL/FE | Ocena podstawy prawnej Vercel Analytics/Speed Insights; bramka zgody lub udokumentowany uzasadniony interes | Pisemny sign-off IOD; brak zapisu device storage przed zgodą | Przegląd sieci + dokument | Jeśli bramka: rollback = przywrócenie bezwarunkowego ładowania |
| CSP-REPORT-ONLY (MEDIUM) | SEC/FE | Analiza raportów → egzekwowany CSP (nonce+strict-dynamic) | Nagłówek `Content-Security-Policy` egzekwuje; brak naruszeń first-party | e2e nagłówka + brak naruszeń; inline `<script>` zablokowany | Najpierw staging; rollback = powrót do Report-Only |
| PREVIEW-INDEX (NOT ASSESSED) | DevOps | Potwierdzić izolację preview (osobny Supabase/Airtable, noindex, brak sekretów prod) | `X-Robots-Tag: noindex` na preview; env preview = non-prod | curl preview + audyt env | Konfiguracyjne; rollback konfiguracji |

## P1 — bezpośrednio po P0

| Znalezisko | Właściciel | Kryterium | Test |
| --- | --- | --- | --- |
| A11Y-FORM-LABELS (MEDIUM) | FE | Etykiety powiązane we wszystkich formularzach | axe bez naruszeń; component test accessible name |
| BOND-STALE-FALLBACK (MEDIUM) | FE/PROD | Ostrzeżenie `treasuryBondMacroGaps` widoczne na dashboard/pozycjach/raportach | test propagacji flagi |
| OPEN-REDIRECT (LOW) | FE/SEC | Guard wymaga `new URL(next,origin).origin===origin`; odrzuca backslash/CTRL | unit z wektorami |
| RATE-LIMIT-XFF (LOW) | BE | Klucz na `x-real-ip`/IP platformy; (opcjonalnie KV) | test ignorujący lewy XFF |
| LOGOUT-QUEUE-RESIDUE (LOW) | FE | `clearPendingSyncOperations()` w wylogowaniu paska; rozważyć namespacing per-user | test flow wylogowania |
| Cache-Control private/no-store | FE | Nagłówek na `/api/sync/bootstrap` i `/auth/*` | e2e nagłówka |

## P2 — kolejny etap

| Znalezisko | Właściciel | Kryterium |
| --- | --- | --- |
| DANGEROUS-HTML (LOW) | FE | JSON-LD escapuje `<`; reguła lint na landing HTML |
| PARSE-AMOUNT-SEP (LOW) | FE/PROD | Obsługa/odrzucanie separatorów z podpowiedzią (jeśli kontrakt pozwala) |
| APP-LOCK-PIN (LOW) | FE/PROD | Copy nie sugeruje ochrony danych; opcjonalnie KDF gatujący klucz |
| FX `missing=1` oznaczenie | FE | Kurs `missing` widoczny jako „brak kursu" w UI |
| COOP/CORP nagłówki | FE | Dodać `same-origin` |
| Pełny audyt WCAG 2.2 AA (runtime) | QA | axe + klawiatura + czytnik + wykresy Chart.js (alternatywa tabelaryczna) |
| CWV / wydajność | FE | Zmierzyć CWV; dynamic import ciężkich widoków; lazy Chart.js |
| Cookies flags (runtime) | SEC | Potwierdzić HttpOnly/Secure/SameSite/`__Host-` |

## P3 — długoterminowo

| Element | Właściciel | Kryterium |
| --- | --- | --- |
| Rate-limit/cache na KV/Redis (trwałość) | DevOps | Limit spójny między instancjami |
| Reprezentacja kwot w groszach dla eksportów/podatków | BE/FE | Jeśli pojawią się bardzo duże kwoty |
| Runbook incydentów + syntetyki + health w monitoringu | DevOps | Udokumentowany proces |
| Backup/DR test odtworzenia (RPO/RTO) | DevOps/BE | Udokumentowane, przetestowane |
| Umowy powierzenia / rejestr przetwarzania | LEGAL | Kompletne dla Supabase/Vercel/TelemetryDeck/Airtable |

## Zależności
- CSP egzekwowany zależy od domknięcia [DANGEROUS-HTML] i inwentaryzacji źródeł.
- Testy DR ([SYNC-SCHEMA-DRIFT]) muszą poprzedzać jakikolwiek rebuild środowiska.
- Bramka zgody ([ANALYTICS-CONSENT]) zależy od decyzji IOD.
