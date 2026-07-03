# Onboarding Zecca Web — projekt

Data: 2026-07-03 (rewizja: tour na realnym UI zamiast wizardu)
Status: zatwierdzony w brainstormingu

## Cel

Po pierwszym logowaniu (rejestracja odbywa się wcześniej, standardową ścieżką web)
użytkownik przechodzi przez onboarding, który: (1) tłumaczy, czym jest Zecca,
(2) oprowadza po najważniejszych elementach **prawdziwego interfejsu** — tak,
by po zakończeniu wiedział, gdzie co jest, (3) kończy się konfiguracją
synchronizacji z aplikacją natywną (macOS/iOS).

Uwaga: onboarding natywny (z zaszytą rejestracją) to osobny temat w repo
`/Users/jacek/Desktop/Zecca` — poza zakresem tego projektu.

## Wybrane podejście

Overlay coach-marks na realnym UI (wariant A). Wcześniej wybrano dedykowany
wizard `/onboarding` (B), ale po przeglądzie mockupu użytkownik zdecydował,
że tour ma się odbywać w prawdziwej aplikacji — nauka realnego układu
interfejsu jest ważniejsza niż pełna kontrola narracji.

## Przepływ

**Intro (2 pełnoekranowe karty, modal nad przyciemnionym dashboardem):**

1. **Witaj w Zecca** — czym jest aplikacja: prywatny tracker całego majątku
   (akcje/ETF, obligacje, lokaty, gotówka). Grafika hero od użytkownika.
2. **Twoje dane, Twój klucz** — dane wpisuje się w natywnej Zecca, web czyta
   zaszyfrowany E2E snapshot; nikt poza użytkownikiem ich nie odczyta.
   Ilustracja od użytkownika. Przycisk „Zacznij tour" / „Pomiń".

**Tour (spotlight + karta z opisem, na realnym UI):**

3. **KPI portfela** (dashboard) — wartość całego portfela, MWR (XIRR),
   wynik realny po inflacji. Spotlight na KPI strip.
4. **Wykres historii i alokacja** (dashboard) — jak wartość zmieniała się
   w czasie, jak majątek rozkłada się na klasy aktywów. Spotlight na sekcję
   wykresów.
5. **Portfele** (sidebar) — lista portfeli (IKE, IKZE, maklerski…) z bieżącymi
   wartościami. Spotlight na sekcję „Portfele" w sidebarze.
6. **Pozycje i transakcje** — tour nawiguje na `/positions`; spotlight na
   tabelę pozycji: co posiadasz, skąd bierze się P/L; wzmianka o zakładce
   Transakcje.
7. **Połącz swoje dane** (finał) — karta centralna, trzy stany:
   - sync odblokowany → gratulacje + „Przejdź do dashboardu",
   - snapshot istnieje, nieodblokowany → osadzony `SyncUnlockPanel`,
   - brak danych → instrukcja pobrania Zecca na macOS/iOS + linki/QR.

Nawigacja: postęp `krok x / y` na karcie kroku, Wstecz/Dalej, klawiatura ←/→,
Esc lub „Pomiń tour" zawsze dostępne. Kroki mogą nawigować między trasami
(dashboard → positions); przejście czeka na zamontowanie elementu-kotwicy.

## Mechanika spotlight

- Elementy UI oznaczone atrybutem `data-tour="<id>"` (KPI strip, sekcja
  wykresów, grupa „Portfele" w sidebarze, tabela pozycji, status synca).
- Overlay: przyciemnienie całej strony z „wycięciem" wokół elementu-kotwicy
  (box-shadow trick albo SVG mask), podświetlony element pozostaje widoczny
  i nieinteraktywny podczas touru.
- Karta kroku (styl design systemu: `--card`, serif Newsreader w nagłówku,
  eyebrow z numerem kroku) pozycjonowana obok wycięcia, ze strzałką.
- Scroll-into-view przed pokazaniem kroku; reposition przy resize.
- Mobile: spotlight bez zmian, karta kroku jako bottom-sheet przyklejony
  do dołu ekranu; kotwice wskazują elementy mobilnego layoutu.

## Stan i dane

- Flaga ukończenia: localStorage `zecca.onboarding.completed` + pole w
  profilu (`profile-store`), żeby login na innym urządzeniu nie pokazywał
  touru ponownie.
- Bramka: layout `(app)` po zalogowaniu sprawdza flagę; brak → start
  onboardingu na dashboardzie. „Pomiń" ustawia flagę.
- Replay: linki „Zobacz wprowadzenie" w FAQ i Ustawieniach uruchamiają tour
  ponownie (bez czyszczenia flagi).
- **Tryb demo**: gdy użytkownik nie ma zsynchronizowanych danych, dashboard
  i pozycje działają na `sampleSnapshot` z
  `src/features/dashboard/sample-data.ts`, z plakietką „Dane przykładowe".
  Tour działa na tych danych; narracja odwołuje się do konkretnych liczb
  („428 940 PLN", „+3,38%"). Gdy użytkownik ma własne dane (replay), tour
  działa na nich, a narracja unika konkretnych liczb — treść kroku wspólna,
  liczby tylko w warstwie wizualnej.

## Struktura plików

```
src/features/onboarding/
  intro-cards.tsx        — 2 pełnoekranowe karty intro (modal)
  tour.tsx               — silnik: overlay, spotlight, karta kroku, nawigacja
  steps.ts               — deklaratywne definicje kroków (id kotwicy, trasa,
                           tytuł, treść, pozycja karty)
  onboarding-state.ts    — flaga ukończenia, hook useOnboardingGate
```

Poza tym: atrybuty `data-tour` w istniejących komponentach (app-shell,
dashboard-overview, KPI strip, tabela pozycji), start bramki w layoucie
`(app)`, linki replay w FAQ i Ustawieniach. Bez zmian logiki istniejących
komponentów.

## Obsługa błędów

- Brak elementu-kotwicy (np. zmiana UI, wolny mount) → retry przez ~2 s,
  potem krok jest pomijany; tour idzie dalej.
- Onboarding nigdy nie blokuje aplikacji: błąd krytyczny → flaga ustawiona,
  overlay zdjęty.

## Testy

- Unit (Vitest): logika bramki (redirect / replay / skip), sekwencja kroków
  z pomijaniem brakujących kotwic, wybór stanu kroku finałowego.
- E2E (Playwright, config fake-sync): przejście całego touru łącznie z
  nawigacją dashboard → positions; weryfikacja, że po ukończeniu drugie
  wejście nie pokazuje touru.

## Zależności / materiały od użytkownika

- Grafika hero (karta intro 1) i ilustracja prywatności (karta intro 2).
- Ostateczne teksty narracji do akceptacji podczas implementacji.
