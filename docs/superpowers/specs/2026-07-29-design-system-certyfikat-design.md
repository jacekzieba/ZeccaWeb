# Design system „Certyfikat" — kierunek wizualny i warstwa tokenów

Data: 2026-07-29
Status: zatwierdzony w brainstormie, gotowy do planu wdrożenia

---

## 1. Problem

Zecca dostała feedback, że strona i aplikacja wyglądają na wygenerowane przez AI. Diagnoza po
przeglądzie kodu i renderu:

**Warstwa estetyczna.** Landing stoi na kremowym tle `#EBEADC` z szeryfem w nagłówkach i złotym
akcentem `#8A6429` — to jest jeden z trzech domyślnych looków, w które zsuwa się generowany design,
i nie wynika z niczego, co dotyczy Zecci. Nagłówki jadą na `Georgia, "Times New Roman", serif`,
a w `app/layout.tsx` nie ma żadnego `next/font` — `--font-inter` w `tailwind.config.ts` wskazuje na nic.
Cała typografia produktu to font systemowy plus Georgia.

**Warstwa systemowa.** Design systemu nie ma:

- 77 różnych hardkodowanych hexów w `app/` i `src/`
- kolory z `tailwind.config.ts` (`ink`, `paper`, `sand`, `amber`, `profit`, `loss`, `equity`, `bonds`) — użyte zero razy w TSX
- motyw daisyUI `investor` z granatowym primary `#0A84FF` i neutral `#1C3144`, sprzeczny z zieloną marką `#234D38`
- zmienne `--inv-*` w `globals.css` — używane w jednym pliku
- ~900 inline `style={{}}` (136 w samym `dashboard-overview.tsx`)
- **22 różne wartości `border-radius` w CSS + 281 deklaracji `borderRadius` w TSX** obejmujących kolejne 22 wartości

Kluczowe rozróżnienie, które porządkuje cały projekt: **design system naprawia niespójność,
ale „wygląda na AI" to problem charakteru.** Idealnie stokenizowany obecny wygląd byłby spójnym
wyglądem AI. Dlatego kolejność to najpierw kierunek, potem tokeny.

---

## 2. Persona i rejestr

**Spokojny właściciel — „w końcu wiem, ile mam".** Ktoś z IKE, IKZE i paroma ETF-ami, kto zagląda
raz na kwartał i nie chce się uczyć finansjery.

Obecne copy adresuje dwie różne osoby naraz: „Jeden spokojny widok na cały Twój majątek" obok
„Statystyki jak u profesjonalisty". Design próbujący obsłużyć oba rejestry ląduje w bezpiecznym
środku — i to jest dokładnie ten środek, który model wybiera, gdy nie ma zdania.

Pułapka do uniknięcia: „spokojnie" domyślnie interpretuje się jako miękko, kremowo, zaokrąglono
i szeryfowo — czyli jako to, co już jest. Spokój budujemy **redukcją liczby elementów**, nie
zmiękczaniem ich wyglądu.

---

## 3. Kierunek: „Certyfikat"

Atmosferę niesie **druk zabezpieczony** — giloszowe rozety z banknotów i świadectw udziałowych.
Ogromna, bardzo blada rozeta za jedną wielką liczbą. Przekaz: *to jest twoje świadectwo posiadania*.

Uzasadnienia, które to spinają:

- **Zieleń jest kanonicznym kolorem druku zabezpieczonego** — papiery wartościowe ryto w zieleni,
  bo ówczesna fotografia była monochromatyczna i zielony pigment nie dawał się podrobić przez odbitkę.
  Obecna zieleń marki i ten kierunek trafiają się nawzajem.
- **Terakota ma rodowód wenecki** — zielone okiennice, terakotowe dachy. Zecca to weneckie słowo
  (mennica) i weneckie miejsce.
- Gilosz generujemy matematycznie w SVG (hipotrochoida, 14 płatków, 9 warstw) — bez zależności
  od fotografii.

Odrzucone kierunki: makrofotografia bitego metalu („Bicie"), krajobraz i horyzont („Długi horyzont").
Konsekwencja: **budżet na fotografię jest wolny** — najlepsze zastosowanie to zamówienie prawdziwego
giloszu jako znaku firmowego (logo i tak jest do wymiany).

---

## 4. Tokeny — kolor

Motyw **jasny jest domyślny**, ciemny wyprowadzony przez inwersję. Jeden plik tokenów,
jedna inwersja, ta sama rodzina barwna i ta sama chłodna oś po obu stronach.

### Jasny (domyślny) — „papier"

| token | wartość | zastosowanie |
|---|---|---|
| `--ground` | `#FBFCFA` | tło strony |
| `--surface` | `#FFFFFF` | panel, tabela, karta |
| `--surface-2` | `#F1F4F1` | wiersz podświetlony, input |
| `--line` | `#123B2B @14%` | włos rozdzielający |
| `--ink` | `#123B2B` | tekst główny, liczby |
| `--ink-muted` | `#55665C` | etykiety, opisy |
| `--ink-faint` | `#8A9890` | osie wykresów, placeholder |
| `--accent` | `#A0512F` | znak, eyebrow, pieczęć, CTA |
| `--guilloche` | `#123B2B @14%` | rozeta |

### Ciemny (motyw do wyboru) — „atrament"

| token | wartość |
|---|---|
| `--ground` | `#0B1A14` |
| `--surface` | `#122A20` |
| `--surface-2` | `#1A382A` |
| `--line` | `#9FBFAE @16%` |
| `--ink` | `#EDF2EE` |
| `--ink-muted` | `#8FAE9C` |
| `--ink-faint` | `#5E7A6B` |
| `--accent` | `#C4715A` |
| `--guilloche` | `#9FBFAE @9%` |

**Zero cieni w całym systemie.** Wysokość buduje wartość powierzchni plus włos, nigdy rozmycie.
To jedna reguła likwidująca dzisiejszy problem „karta na karcie na karcie".

### Rozwiązanie konfliktu zieleni

Zieleń jest jednocześnie kolorem marki i kolorem zysku — stąd dzisiejsze rozmycie dashboardu.
Rozdzielamy je **na skali jasności**:

- **zieleń chromu żyje wyłącznie na skrajach skali** — jako tło albo jako atrament
- **zieleń danych żyje wyłącznie w środku** — nigdy jako powierzchnia ani jako tekst interfejsu

Sześćdziesiąt punktów jasności różnicy sprawia, że nie da się ich pomylić, a marka zostaje zielona.

### Paleta danych

| klasa | ciemny | jasny |
|---|---|---|
| Akcje / ETF | `#4A8FC7` | `#2C6394` |
| Obligacje | `#C9A24F` | `#8F6B24` |
| Gotówka / lokaty | `#8FA6B8` | `#566A7C` |
| Kryptowaluty | `#9B84D4` | `#6B52A3` |
| Zysk | `#35A87A` | `#1E7A55` |
| Strata | `#D9463A` | `#AE1F14` |

**Strata jest świadomie przesunięta w chłodniejszą, czystszą czerwień**, żeby odsunąć ją od
terakotowego akcentu. To najkruchszy punkt całej palety — patrz sekcja 10.

### Zamknięta lista zadań akcentu

Kolor buduje tożsamość częstotliwością na małej powierzchni, nie wielkością plamy. Akcent ma
**dokładnie pięć zadań i nic poza nimi**: eyebrow i etykiety daty, znacznik aktywnej sekcji,
obwódka focusa, jedno główne CTA na widok, znak i pieczęć. Bez tej listy akcent w trzy miesiące
rozlezie się po interfejsie.

---

## 5. Tokeny — promień, przestrzeń, ruch

### Promień

| token | wartość | zastosowanie |
|---|---|---|
| `--r-xs` | `4px` | znaczniki, próbki w legendzie |
| `--r-sm` | `10px` | przyciski, pola, małe kontrolki |
| `--r-md` | `14px` | panele, kafle KPI, tabele |
| `--r-lg` | `20px` | hero, modale, duże karty |
| `--r-xl` | `28px` | arkusze, nakładki pełnoekranowe |
| `--r-pill` | `999px` | segmenty, przełączniki, statusy |

**Reguła koncentryczna jako funkcja, nie zalecenie:**
`--r-inner: max(var(--r-xs), calc(var(--r-outer) - var(--pad)))`, gdzie `--pad` to padding
pojemnika nadrzędnego, brany ze skali odstępów poniżej. Komponent zagnieżdżony sam wylicza
swój promień — nie ma miejsca na decyzję ręczną.

**Rogi ciągłe:** `corner-shape: squircle` dokładany progresywnie. Zweryfikowane jako wspierane
w Chrome 148; tam, gdzie przeglądarka go nie zna, zostaje zwykły promień i nic się nie psuje.

### Przestrzeń

Skala czwórkowa: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96. Nic pomiędzy.

### Ruch

Jeden sygnaturowy: **rozeta obraca się o ok. 2° na minutę** — zauważalna dopiero, gdy się na nią
patrzy. Poza tym 120 ms na stany i nic więcej. Przy `prefers-reduced-motion` rozeta stoi.

---

## 6. Typografia

Trzy role, twarde granice:

- **Display — Source Serif 4.** Nagłówki i wszystkie liczby, które coś znaczą: suma portfela,
  wartości KPI, nagłówki raportów. Cyfry tabelaryczne i lining.
- **Tekst — IBM Plex Sans.** Interfejs, akapity, etykiety, nazwy instrumentów, nagłówki tabel.
- **Mono — IBM Plex Mono.** Wyłącznie identyfikatory maszynowe: ISIN, seria obligacji,
  hash eksportu. Nigdzie indziej.

**Wyrównanie kolumn robi `font-variant-numeric: tabular-nums`, nie krój monospace.** Pierwsza
wersja prymitywów używała mono do wszystkich liczb i etykiet — efekt czytał się jak terminal
fosforowy, zwłaszcza na ciemnej zieleni. Mono było niewłaściwym narzędziem: potrzebne są cyfry
tabelaryczne, które sans ma na pokładzie.

**Ścieżka płatna (opcjonalna):** Signifier (Klim, ok. 300–500 USD za web) zamiast Source Serif 4 —
ma celowo nadgryzione złącza, wygląda jak wycięty. Kupujesz głównie warianty optyczne stopnia
i odklejenie od IBM Plex, który jest mocno rozpoznawalny. **Söhne odradzam** mimo naturalnego
parowania z Signifierem — jest dziś krojem OpenAI i połowy SaaS-u, czyli niesie dokładnie to
skojarzenie, od którego uciekamy.

**Kryterium odrzucające przy każdym zakupie:** polskie diakrytyki, zwłaszcza `ł` i ogonki
(`ą ć ę ł ń ó ś ź ż`). W krojach o wysokim kontraście ogonek bywa doklejony byle jak.

---

## 7. Prymitywy

Dwanaście komponentów zastępujących ~900 inline styli:

`Eyebrow` · `Rule` · `Surface` · `Stat` · `Figure` · `DataTable` · `ChartFrame` · `Seal` ·
`Button` · `Field` · `Modal` · `Empty`

Decyzje zaszyte w interfejsach:

- **`Stat` to jedyny sposób pokazania liczby.** Sam decyduje o wariancie display kontra roboczy
  i sam dokłada nośnik nie-kolorowy (`▲`/`▼`). Nie da się obejść i wpisać kwoty w dowolnym stylu.
- **`ChartFrame` posiada osie, siatkę i legendę.** Dziś każdy z sześciu wykresów ma własne kolory
  osi wpisane w komponent; po zmianie wykres dostarcza tylko dane.
- **`Empty` jest zaproszeniem, nie komunikatem o braku** — nagłówek, jedno zdanie, przycisk.
- **`Button` ma trzy warianty i koniec:** primary (akcent), quiet (włos), ghost.

Element „rant" (ząbkowana krawędź monety) **nie wchodzi** — należał do odrzuconego kierunku
„Bicie". Rozdzielacz sekcji to włos albo jednoliniowy pasek wyprowadzony z giloszu.

---

## 8. Zakres — landing

**Układ i copy zostają.** Zmienia się wyłącznie warstwa wizualna, czyli przepisanie
`app/_landing/landing.css` (2828 linii) na nowe tokeny. Struktura HTML w `content.ts` nie jest ruszana.

Dwa wyjątki:

1. **Usuwamy sekcję porównawczą z MyFund.** Porównanie do konkurenta z nazwy przemawia do kogoś,
   kto już zna rynek i wybiera — czyli do analityka, nie do naszej persony. Zweryfikowane jako
   czyste do wycięcia: sekcja nie jest linkowana z nawigacji, JSON-LD korzysta tylko z `features`
   i `faq`. Do usunięcia: blok w `content.ts:308`, obiekt `comparison` w `copy.ts:227`,
   49 linii w `landing.css`, ikony `COMPARE_ROW_ICONS`.
2. **Podgląd produktu wychodzi z karty.** Dziś siedzi w prostokącie z cieniem — w tym samym
   opakowaniu, w którym każdy landing SaaS pokazuje screenshot. Panele schodzą ~90px poza prawą
   krawędź i są przycięte: nie oglądasz obrazka produktu, tylko widzisz jego kawałek.
   Zmiana wyłącznie w CSS (pozycjonowanie i `overflow`), bez ruszania HTML.

Landing idzie na **jasny** motyw, spójnie z aplikacją — ciemna strona prowadząca do jasnej
aplikacji to przykry przeskok. Ciemny zostaje jako **jeden świadomy pas na landingu plus OG-image**.

---

## 9. Zakres — dashboard

Aplikacja: elementy można modyfikować, byle zachować ich przekaz.

Kluczowe odkrycie: **mechanizm już istnieje.** `dashboard-overview.tsx:120` ma pełny rejestr sekcji
z widocznością, kolejnością i rozmiarem, zapisywany w localStorage, plus panel „Dostosuj".
Problem jest w `section-customization.ts:102`, gdzie `defaultConfig` ustawia
`visibleSections: [...ids]` — czyli **domyślnie włączone jest wszystko: 18 sekcji naraz.**

**Zmiana to inny domyślny preset, nie przebudowa.**

Widoczne domyślnie (6): `summary`, `kpiInvested`, `kpiUnrealized`, `kpiRealReturn`,
`allocation`, `portfolios`.

Ukryte domyślnie, dostępne w „Dostosuj" (12): `kpiXirr`, `kpiTwr`, `kpiCagr`, `kpiMaxDd`,
`kpiRealized`, `kpiDividends`, `kpiOpenPositions`, `valueVsDeposits`, `holdings`, `monthly`,
`transactions`, `cash`.

Uzasadnienie doboru trzech wskaźników: spokojny właściciel ma trzy pytania — ile włożyłem,
ile z tego urosło, czy to bije inflację. **Wynik realny zostaje na wierzchu z premedytacją**,
bo to jedyna metryka, której nie ma prawie żaden konkurent (wymaga danych GUS).

Dochodzi jawne wyjście **„Pokaż wszystkie wskaźniki · 12"** — żeby schowanie nie było ukryciem.

**Migracja:** obecni betatesterzy mają zapisany `zecca.dashboard.sections.v1`, a config czyta się
z localStorage, więc zmiana domyślnej wartości ich nie dotknie. Nowy preset zobaczą tylko nowi
użytkownicy. **Nie bumpujemy klucza na `v2`** — to skasowałoby ich własne ustawienia.

---

## 10. Egzekwowanie i weryfikacja

Bez tego jest to dokument o design systemie, a nie design system.

**Jedno źródło:** `src/design/tokens.css` — właściwości CSS w `:root` plus nadpisanie
w `[data-theme="dark"]`. Tailwind czyta ze zmiennych, więc `bg-surface` to dosłownie `var(--surface)`.

**Testy blokujące (vitest):**

1. Żaden literał hex poza `tokens.css`.
2. Żaden `border-radius` / `borderRadius` poza `tokens.css`.

Oba startują ograniczone do katalogów już zmigrowanych i zaciskają się z każdym kolejnym.

**Trasa `/kit`** — wszystkie prymitywy na jednej stronie, w obu motywach. Podpięta pod
istniejącą konfigurację Playwrighta; zrzut `/kit` w obu motywach łapie regresje wizualne.

**Kryteria odbioru dla palety (obowiązkowe przed wypuszczeniem):**

- kontrast APCA każdej pary barw danych wobec `--ground` i `--surface`, w obu motywach
- symulacja protanopii i deuteranopii na widoku tabeli pozycji
- weryfikacja pary akcent/strata na stopniu 11px, bo tam są najbliżej siebie
- **nośnik nie-kolorowy (`▲`/`▼` plus znak) przy każdej wartości zysku i straty** — obowiązkowy,
  nie opcjonalny; to on sprawia, że test na ślepotę barw przestaje być bramką
  typu przejdź-albo-przeprojektuj

---

## 11. Kolejność wdrożenia

1. `tokens.css` + podpięcie Tailwinda + usunięcie martwych warstw
   (motyw daisyUI `investor`, nieużywane kolory Tailwinda, `--inv-*`, cztery cienie,
   `color-scheme: light` na sztywno) → weryfikacja: `npm run build` przechodzi, nic wizualnie
   nie regresuje poza intencjonalnymi zmianami
2. Załadowanie krojów przez `next/font` → weryfikacja: brak FOUT, diakrytyki renderują się poprawnie
3. Dwanaście prymitywów + trasa `/kit` + testy blokujące (na razie tylko dla `src/design/`)
   → weryfikacja: zrzuty `/kit` w obu motywach
4. Landing: przepisanie `landing.css`, usunięcie sekcji porównawczej, wyjście podglądu z karty
   → weryfikacja: zrzuty landingu, `npm run test:e2e`
5. Migracja aplikacji feature po feature, od najgęstszego:
   `dashboard-overview` (136 inline styli) → `earnings` (110) → `import` (79) →
   `add-transaction-modal` (65) → reszta. Każdy feature to osobny commit, po każdym
   test blokujący obejmuje kolejny katalog
6. Nowy domyślny preset dashboardu → weryfikacja: nowy użytkownik widzi 6 sekcji,
   istniejący config w localStorage nietknięty
7. `src/domain/identity/rosette.ts` + test właściwościowy (sekcja 13.1) → weryfikacja:
   dla `petals ∈ 4..9` liczba maksimów promienia równa się `petals`; podpięcie do `Seal`
8. Przechwycenie `no` z NBP (sekcja 13.2) → weryfikacja: numer tabeli widoczny na rewersie
   i pochodzi z odpowiedzi API, nie z literału. Dopiero potem rewers w UI, z `aria-expanded`
   i wariantem dla `prefers-reduced-motion`

---

## 12. Ryzyka i rzeczy otwarte

**Kolizja terakoty ze stratą jest realna.** W ciemnym akcent `#C4715A` i strata `#D9463A`,
w jasnym `#A0512F` i `#AE1F14` — w obu motywach ta sama para leży w tym samym paśmie.
Rozjeżdżają się temperaturą i nasyceniem, ale przy małych stopniach w tabeli zbliżają się
do siebie, a przy protanopii i deuteranopii oba schodzą w ten sam brąz. Decyzja została podjęta
świadomie; zabezpieczeniem jest obowiązkowy nośnik nie-kolorowy z sekcji 10. **Jeśli test na
symulacji ślepoty barw nie przejdzie mimo strzałek, wariantem zapasowym jest odbarwienie pary
zysk/strata do atramentu** — kolor zostaje wtedy wyłącznie dla klas aktywów.

**Wartości palety danych nie są zweryfikowane.** To propozycja wyjściowa; część odcieni najpewniej
drgnie po przepuszczeniu przez APCA.

**Ciemny pas na landingu nie został jeszcze zaprojektowany.** Wiadomo, że ma być, nie wiadomo,
która sekcja.

**Trzy najmocniejsze funkcje na landingu nie zostały wybrane.** Dzisiejsza lista dziewięciu
równorzędnych kafli komunikuje „sami nie wiemy, co jest najważniejsze", ale wybór wymaga wiedzy
z rozmów z betatesterami, a nie analizy kodu. Do rozstrzygnięcia przy sekcji 4 planu.

**Zamówienie giloszu jako znaku firmowego** — uzgodnione co do zasady, niezaplanowane co do wykonania.

---

## 13. Charakter — dwa przyjęte mechanizmy

Diagnoza, która do tego doprowadziła: gilosz w wersji z sekcji 3 jest **tapetą**. W prawdziwym druku
zabezpieczonym rozeta różnicuje emisje i nominały — coś koduje. Nasza nic nie robiła, więc czytała się
jako ozdoba. Do tego interfejs wyglądał u każdego identycznie, a certyfikat jest *wystawiony komuś*.

### 13.1 Rozeta jest funkcją portfela

Parametry giloszu przestają być stałą i stają się wyliczeniem z danych użytkownika. Rozeta staje się
wizualizacją, a przy okazji robi to, co gilosz robi na banknocie.

**Seam:** czysta funkcja w `src/domain/identity/rosette.ts`, bez zależności od Reacta ani DOM.

```
rosetteParams(portfolio) → { petals, layers, phaseDeg }

petals   = clamp(3 + liczba kont, 4, 9)
layers   = clamp(3 + liczba klas aktywów, 5, 11)
phaseDeg = f(data założenia portfela)      // NIE dzisiejsza data
```

`phaseDeg` liczymy z **daty założenia portfela**, nie z dnia dzisiejszego — inaczej rysunek zmieniałby
się codziennie i przestałby być tożsamością. Ambientowy obrót 2°/min z sekcji 5 zostaje osobno,
jako ruch, i przy `prefers-reduced-motion` nie działa.

**Geometria — zweryfikowana pomiarem, nie założona:**

```
R = 210
r = R / (petals − 1)      // liczba płatków hipotrochoidy = R/r + 1
d = r × 1,1               // d MUSI być proporcjonalne do r
próbkowanie: 2880 punktów, zapis z precyzją 2 miejsc
```

Pomyliłem się w tym dwa razy przy prototypowaniu, dlatego zapisuję oba błędy:

1. Pierwszy wzór miał `r = R/(petals + 1)` i dawał konsekwentnie **o dwa płatki za dużo**.
2. `d` było stałą absolutną niezależną od `r`, co przy małej liczbie płatków tworzyło
   **pętle wewnętrzne** i liczba płatków przestawała się zgadzać.

Po poprawce przemierzone 18 kombinacji `petals × d/r` — zero rozbieżności. Amplituda spada
od 0,71 przy czterech płatkach do 0,27 przy dziewięciu; wszystkie policzalne wzrokiem.
Limit dziewięciu jest **decyzją produktową** (nikt nie ma dziesięciu kont emerytalnych),
nie ograniczeniem geometrii.

**Test właściwościowy (obowiązkowy):** dla `petals ∈ 4..9` wygenerowana krzywa ma dokładnie
`petals` maksimów promienia. Ten test wyłapałby oba powyższe błędy i jest jedynym powodem,
dla którego wiem, że wzór jest teraz poprawny.

### 13.2 Rewers — certyfikat ma drugą stronę

Karta z sumą portfela odwraca się i pokazuje **skąd wzięła się ta liczba**. To nie jest gest
dekoracyjny: odpowiada na pytanie, które spokojny właściciel naprawdę ma („skąd to wiecie?”),
i jest jednocześnie jedynym zaplanowanym *momentem* w interfejsie.

Pola rewersu i ich faktyczny stan w kodzie:

| Pole | Stan |
|---|---|
| Kursy walut — numer tabeli NBP | **wymaga zmiany** — patrz niżej |
| Inflacja — źródło i miesiąc | **jest** — `CpiObservation { provider:"gus", date:"RRRR-MM-01", yoyRate }` |
| Obligacje — metoda wyceny | **jest** — `src/domain/valuation/` |
| Metoda liczenia wyniku realnego | tekst statyczny |
| Data przeliczenia i liczba transakcji | **jest** |

**Numer tabeli NBP wymaga jednej zmiany.** API NBP zwraca pole `no` w każdym wpisie `rates`
(potwierdzone na żywym endpoincie: `{"no":"146/A/NBP/2026","effectiveDate":"2026-07-30","mid":3.7644}`),
ale schemat w `src/market-data/providers/nbp.ts:4` tego pola nie parsuje, więc je tracimy.
Do zrobienia: `no: z.string()` w wewnętrznym obiekcie `rates` oraz odpowiadające pole w typie `FxRate`.
Dopóki tego nie ma, **numer tabeli w makietach jest zmyślony** — nie wolno go wypuścić jako danej.

**Dostępność jest tu warunkiem, nie dodatkiem.** Odwrócenie musi być prawdziwym `<button>`
z `aria-expanded`, obsługiwanym z klawiatury — nie `div` z `onclick`. Przy
`prefers-reduced-motion` zamiast obrotu 3D robimy przejście krzyżowe.

Treść rewersu warto powtórzyć w FAQ, bo to jest realna odpowiedź na powtarzalne pytanie.

### 13.3 Odrzucone w tej turze, dostępne później

**Mikrodruk** — włosowe linie rozdzielające sekcje jako powtórzony mikrotekst, czytelny dopiero
pod lupą. Klasyczne zabezpieczenie, zero kosztu dla interfejsu w skali 1:1. Nie wchodzi teraz,
ale można dołożyć w dowolnym momencie bez zmian w tokenach.

**Numer emisji** (`SERIA A · POZ. 0142 · 29.VII.2026`, z rzymskim miesiącem) i
**perforacja kuponowa** jako rozdzielacz sekcji — obie tanie, obie zgodne z kierunkiem.
Perforacja jest artefaktem obligacji (arkusze z odrywanymi kuponami odsetkowymi), więc
nie koliduje z odrzuconym „rantem”, który był krawędzią monety.
