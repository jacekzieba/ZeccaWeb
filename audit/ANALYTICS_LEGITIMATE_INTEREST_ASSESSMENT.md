# Ocena uzasadnionego interesu (LIA) — analityka webowa Zecca

> **STATUS: PROJEKT do akceptacji przez prawnika / IOD.** To NIE jest opinia prawna. Dokument przygotowano na podstawie faktów z kodu, aby ułatwić decyzję o podstawie prawnej przetwarzania (art. 6 ust. 1 lit. f RODO) dla Vercel Analytics i Vercel Speed Insights. Ostateczną ocenę i podpis musi złożyć osoba odpowiedzialna (IOD/prawnik).

## Kontekst techniczny (fakty z kodu)
- Ładowane bezwarunkowo w `app/layout.tsx`: `@vercel/analytics/next` (`<Analytics/>`) i `@vercel/speed-insights/next` (`<SpeedInsights/>`) — dla wszystkich odwiedzających, także na stronach marketingowych, przed jakąkolwiek interakcją.
- Oba są **bezcookie** w trybie domyślnym; nie zapisują danych w cookies/localStorage/sessionStorage/IndexedDB (potwierdzić w runtime — patrz „Do weryfikacji").
- Przetwarzane dane (wg dokumentacji Vercel): ścieżka URL, referrer, przybliżona lokalizacja/kraj (z IP), typ urządzenia/przeglądarki, metryki wydajności (Core Web Vitals). **Adres IP** jest przetwarzany do wyprowadzenia kraju, ale wg Vercel nie jest przechowywany w surowej formie.
- **Nie** zawierają treści portfela, kwot, tickerów, e-maili, identyfikatorów konta (osobno potwierdzone dla TelemetryDeck w polityce prywatności).
- Odbiorca/podmiot przetwarzający: **Vercel Inc.** (wymaga umowy powierzenia / DPA i oceny transferu poza EOG).

## Test trójstopniowy (wg EDPB/ICO)

### 1. Test celu (czy interes jest uzasadniony?)
Cel: pomiar odwiedzin, wydajności i stabilności aplikacji web, aby wykrywać i naprawiać problemy (regresje wydajności, błędy ładowania) oraz utrzymywać jakość usługi. To **uznany, zgodny z prawem interes** administratora (utrzymanie i poprawa własnej usługi). Interes jest bieżący i rzeczywisty (produkt w fazie beta/produkcyjnej).

### 2. Test niezbędności (czy przetwarzanie jest konieczne i proporcjonalne?)
- Analityka bezcookie, zagregowana, pseudonimowa — **minimalny** zakres danych do osiągnięcia celu (brak śledzenia międzywitrynowego, brak profilowania osób, brak reklamy).
- Nie istnieje istotnie mniej inwazyjny sposób uzyskania tych samych metryk technicznych (logi serwera nie dają Core Web Vitals z realnych przeglądarek).
- Zakres ograniczony do metryk technicznych — proporcjonalny do celu.

### 3. Test równowagi (czy interes administratora przeważa nad prawami osób?)
Za przetwarzaniem: dane pseudonimowe, bezcookie, brak treści wrażliwych (finansowych), brak śledzenia międzywitrynowego, brak decyzji zautomatyzowanych wobec osoby.
Przeciw / ryzyka: przetwarzanie IP (dane osobowe), brak zgody, brak realnej możliwości sprzeciwu w UI, transfer do Vercel (USA) — wymaga podstawy transferu (SCC/DPF).
Środki równoważące (rekomendowane):
- Jawna informacja w polityce prywatności (już jest — sekcja „Telemetria produktowa").
- Umowa powierzenia (DPA) z Vercel + potwierdzenie mechanizmu transferu (EU-US DPF lub SCC).
- Mechanizm sprzeciwu / opt-out (do rozważenia — patrz „Decyzje").
- Potwierdzenie bezcookie i braku przechowywania surowego IP.

**Wstępny wniosek (do akceptacji IOD):** uzasadniony interes wydaje się **obronny** dla analityki technicznej bezcookie, pod warunkiem domknięcia DPA/transferu i utrzymania jawnej informacji. Jeśli IOD uzna analitykę za wymagającą zgody (ePrivacy/interpretacja krajowa), należy wdrożyć **bramkę zgody** (mogę zaimplementować).

## ePrivacy (cookies/„storage or access")
Jeśli Vercel Analytics/Speed Insights **nie** zapisują ani nie odczytują danych na urządzeniu (bezcookie), przesłanka zgody z art. 5(3) dyrektywy ePrivacy (odpowiednik art. 173 Prawa telekomunikacyjnego PL) **może nie mieć zastosowania**. To wymaga potwierdzenia technicznego (runtime) + oceny prawnej. RODO (podstawa dla IP) rozstrzyga się przez uzasadniony interes powyżej.

## Do weryfikacji (techniczne, przed podpisem)
1. Runtime: potwierdzić, że `/_vercel/insights` i Speed Insights **nie** ustawiają żadnych cookies ani wpisów w Web Storage (DevTools → Application). 
2. Potwierdzić region przetwarzania Vercel i mechanizm transferu (DPF/SCC).
3. Zawrzeć/zweryfikować DPA z Vercel; dodać Vercel do rejestru czynności i listy podmiotów przetwarzających w polityce prywatności (obecnie polityka wymienia Vercel Analytics/Speed Insights opisowo — potwierdzić, że to wystarcza jako informacja).

## Decyzje do podjęcia przez administratora/IOD
- [ ] Zaakceptować uzasadniony interes jako podstawę (art. 6.1.f) — czy TAK.
- [ ] Czy wymagana bramka zgody (jeśli tak — implementacja po stronie web gotowa do wykonania).
- [ ] Potwierdzić DPA + transfer (Vercel).
- [ ] Zaktualizować rejestr czynności przetwarzania.

## Ślad rozliczalności
Data sporządzenia projektu: 2026-07-21. Podstawa: przegląd kodu (`app/layout.tsx`, `app/privacy-policy/page.tsx`, `src/lib/telemetry/*`). Wymaga daty i podpisu IOD/prawnika po akceptacji.
