# Onboarding Zecca Web — projekt

Data: 2026-07-03
Status: zatwierdzony w brainstormingu

## Cel

Po pierwszym logowaniu (rejestracja odbywa się wcześniej, standardową ścieżką web)
użytkownik przechodzi przez wizard, który: (1) tłumaczy, czym jest Zecca,
(2) oprowadza po najważniejszych elementach interfejsu na żywych komponentach
zasilonych przykładowymi danymi, (3) kończy się konfiguracją synchronizacji
z aplikacją natywną (macOS/iOS).

Uwaga: onboarding natywny (z zaszytą rejestracją) to osobny temat w repo
`/Users/jacek/Desktop/Zecca` — poza zakresem tego projektu.

## Wybrane podejście

Dedykowana trasa-wizard `/onboarding` (wariant B). Odrzucone: overlay
coach-marks na realnych trasach (A) i hybryda (C) — użytkownik wybrał pełną
kontrolę narracji w osobnym wizardzie osadzającym realne komponenty.

## Przepływ — 6 kroków

1. **Witaj w Zecca** — czym jest aplikacja: prywatny tracker całego majątku
   (akcje/ETF, obligacje, lokaty, gotówka). Pełnoekranowy hero z grafikami
   dostarczonymi przez użytkownika.
2. **Dashboard** — osadzony realny KPI strip (`KpiCard`/`getKpiTiles`) +
   wykres historii wartości (`portfolio-value-chart`) na sample data.
   Narracja: wartość portfela, MWR/XIRR, wynik realny po inflacji.
3. **Alokacja i portfele** — donut alokacji (`allocation-donut`) + lista
   portfeli (IKE/IKZE itd.). Narracja o organizacji majątku.
4. **Pozycje i transakcje** — podgląd tabeli pozycji na sample data:
   skąd bierze się P/L, historia zakupów.
5. **Twoje dane, Twój klucz** — jak działa sync: dane wpisuje się w natywnej
   Zecca, web czyta zaszyfrowany E2E snapshot; nikt poza użytkownikiem ich
   nie odczyta. Prawa kolumna: grafika/ilustracja.
6. **Połącz swoje dane** — finał, trzy stany:
   - sync odblokowany → gratulacje + „Przejdź do dashboardu",
   - snapshot istnieje, nieodblokowany → osadzony `SyncUnlockPanel`,
   - brak danych → instrukcja pobrania Zecca na macOS/iOS + linki/QR.

Nawigacja: pasek postępu `01 / 06` (mono), Wstecz/Dalej, klawiatura ←/→,
„Pomiń — przejdź do aplikacji" zawsze widoczny.

## Wygląd

Spójny z design systemem „Investor v2" (projekt Claude Design
`Investor Design System.html`; tokeny w `src/lib/v2-design.ts` i
`src/lib/design-tokens.ts`):

- Tło trasy: papierowe `--page`, bez sidebara/topbara aplikacji. Cienki pasek
  u góry: znak Zecca / postęp / „Pomiń".
- Layout kroku „editorial split": lewa kolumna narracji (~40%) — eyebrow,
  nagłówek serif Newsreader z kursywnym akcentem w kolorze brand, 2–3 zdania
  body, przyciski; prawa kolumna (~60%) — panel `--card` z żywym komponentem.
- Kroki 1 i 5 bez komponentu — grafiki użytkownika; krok 1 wycentrowany hero.
- Mobile: kolumny stackują się, przyciski przyklejone do dołu.
- Przejścia: subtelny fade/slide (CSS, bez nowych bibliotek).
- Komponenty w krokach 2–4 interaktywne (okres wykresu, hover), ale bez
  nawigacji poza wizard. Plakietka „Dane przykładowe" w rogu panelu.

## Stan i dane

- Flaga ukończenia: localStorage `zecca.onboarding.completed` + pole w
  profilu (`profile-store`), żeby login na innym urządzeniu nie pokazywał
  wizardu ponownie.
- Bramka: layout `(app)` po zalogowaniu sprawdza flagę; brak → redirect na
  `/onboarding`. „Pomiń" ustawia flagę.
- Replay: linki „Zobacz wprowadzenie" w FAQ i Ustawieniach →
  `/onboarding?replay=1` (nie nadpisuje flagi, nie redirectuje).
- Dane kroków 2–4: zawsze `sampleSnapshot` z
  `src/features/dashboard/sample-data.ts` — narracja odwołuje się do
  konkretnych liczb („428 940 PLN", „+3,38%"); nigdy realne dane użytkownika.

## Struktura plików

```
app/(app)/onboarding/page.tsx        — trasa, tylko montaż wizardu
src/features/onboarding/
  onboarding-wizard.tsx              — layout, pasek postępu, nawigacja, przejścia
  steps.tsx                          — deklaratywne definicje 6 kroków (treść + panel)
  onboarding-state.ts                — flaga ukończenia, hook useOnboardingGate
```

Poza tym tylko: redirect w layoucie `(app)`, linki replay w FAQ i
Ustawieniach. Zero zmian w istniejących komponentach osadzanych.

## Obsługa błędów

- Panel kroku nie renderuje się (np. Chart.js/SSR) → statyczny fallback
  graficzny dla tego kroku.
- Wizard nigdy nie blokuje wejścia do aplikacji: błąd krytyczny → flaga
  ustawiona, redirect na dashboard.

## Testy

- Unit (Vitest): logika bramki (redirect / replay / skip), wybór stanu
  kroku 6.
- E2E (Playwright, config fake-sync): przejście całego wizardu; weryfikacja,
  że po ukończeniu drugie wejście nie pokazuje wizardu.

## Zależności / materiały od użytkownika

- Grafiki i screenshoty do kroków 1 i 5 (dostarczy użytkownik).
- Ostateczne teksty narracji do akceptacji podczas implementacji.
