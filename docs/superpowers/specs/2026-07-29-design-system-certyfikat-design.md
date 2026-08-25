# Design system „Certyfikat" — kierunek wizualny i warstwa tokenów

Data: 2026-07-29
Status: ODRZUCONY 2026-08-05 — zastąpiony przez [kierunek „Próba"](2026-08-05-design-system-proba-design.md).
Powody odrzucenia opisane w sekcji 1 nowego dokumentu.

---

## 1. Problem

Zecca dostała feedback, że strona i aplikacja wyglądają na wygenerowane przez AI. Diagnoza po
przeglądzie kodu i renderu:

**Warstwa estetyczna.** Landing stoi na kremowym tle `#EBEADC` z szeryfem w nagłówkach i złotym
akcentem `#8A6429` — to jest jeden z trzech domyślnych looków, w które zsuwa się generowany design,
i nie wynika z niczego, co dotyczy Zecci. Nagłówki jadą na `Georgia, "Times New Roman", serif`,
a w `app/layout.tsx` nie ma żadnego `next/font` — `--font-inter` w `tailwind.config.ts` wskazuje na nic.
Cała typografia produktu to font systemowy plus Georgia.

**Warstwa systemowa — SPROSTOWANIE (2026-07-30).** Pierwotna wersja tej sekcji twierdziła,
że design systemu nie ma. **To była nieprawda.** W `src/lib/v2-design.tsx` istnieje paleta `V2`
z dwudziestoma tokenami, używana **728 razy w 21 plikach**, plus wyekstrahowane komponenty
`V2Card`, `V2Eyebrow`, `V2Badge`, `V2ScreenHead`, `V2Button`, `V2Kpi` oraz wspólne style
`v2InputStyle`, `v2SelectStyle`, `v2Glass`.

Mój audyt szukał systemu w `tailwind.config.ts`, motywie daisyUI i zmiennych CSS — znalazł tam
same martwe warstwy i wyciągnął z tego zły wniosek. Nie sprawdziłem `src/lib/`.

Prawdziwy stan: **system istnieje, jest nieudokumentowany, ubogi w komponenty i koduje stary
kierunek wizualny** (krem `#E4E6E2`, szkło z `backdrop-filter` i cieniami). Konsekwencje:

- podmiana wartości w `V2` propaguje się na 728 miejsc automatycznie — migracja jest tańsza,
  niż zakładałem
- prawdziwym wyciekiem jest **108 literałów hex** w TSX, i to jest liczba do wyzerowania
- sześć prymitywów już istnieje; lista dwunastu z sekcji 7 częściowo wyważała otwarte drzwi
- `v2Glass` (backdrop-filter + dwa cienie) jest wprost sprzeczne z regułą „zero cieni” i musi zginąć

Poniższa lista martwych warstw pozostaje aktualna — to są rzeczy równoległe do `V2`, nie zamiast niego:

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
- Gilosz generujemy matematycznie w SVG (hipotrochoida) — bez zależności od fotografii.

### Sygnatura: rozeta w tle (potwierdzone 2026-07-30)

Rozważana była alternatywa — **bordiura**, czyli ornament biegnący po obwodzie panelu, zamiast
rozety w tle. Odrzucona; zostaje rozeta.

**Reguła umiejscowienia, która z tego wynika.** Rozeta leży *pod* treścią, więc konkuruje z nią
o czytelność. Żeby to nie stało się problemem:

- rozeta **wolno** na powierzchniach o niskiej gęstości: hero z jedną wielką liczbą,
  pusty stan, ciemny pas landingu, OG-image
- rozeta **nie wolno** pod tabelą, listą pozycji ani żadnym widokiem wielowierszowym
- krycie bez zmian: 14% na papierze, 9% na atramencie

To jest jedyny warunek, pod którym wariant z rozetą w tle jest bezpieczny. Bez niego wiersze
tabeli położone na ornamencie tracą kontrast.

**Uczciwe źródło.** Wstępny ogląd kolekcji PWPW wskazuje, że obiekty mają **ornament brzegowy,
a nie rozetę tokarską**. Nasza rozeta jest więc **własnym rysunkiem z rodziny giloszowej**,
a nie przerysem z archiwum — i tak należy o niej mówić. Potwierdzone z archiwum:
**zieleń jako kolor druku**. Przyjęty rodowód: **obligacja powstańcza z 1863** — jako historia
opowiadana w tekście, nie jako źródło geometrii.

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

### Paleta danych — wartości finalne (2026-07-30, poprawione po teście na dwusetnym ekranie)

**Klas aktywów jest pięć, nie cztery.** Pierwsza wersja scalała lokaty z gotówką; aplikacja
trzyma je osobno (`V2.deposit` i `V2.cash`), więc paleta musiała zostać przeliczona.

| klasa | ciemny | jasny | marker |
|---|---|---|---|
| Akcje / ETF | `#3E7FB8` | `#20507E` | kwadrat |
| Obligacje | `#C9A24F` | `#8F6B24` | romb |
| Lokaty | `#B0A294` | `#7A6E63` | sześciokąt |
| Gotówka | `#8FA6B8` | `#4A5A68` | koło |
| Kryptowaluty | `#B6A2E4` | `#8A6FD0` | trójkąt |
| Zysk | `#35A87A` | `#1E7A55` | `▲` |
| Strata | `#D9463A` | `#AE1F14` | `▼` |

Lokaty dostają **ciepły kamienny neutral** — semantycznie „nudne bezpieczne pieniądze”,
a technicznie jedyne wolne pasmo, które nie wchodzi ani w zielony chrom, ani w parę zysk/strata.
Wszystkie kontrasty ≥ 3,0 (najniższy: krypto 3,88 w jasnym, akcje 3,58 w ciemnym).
Minimalny dystans przy CVD wynosi 18,6 w jasnym i 16,4 w ciemnym — mimo że przy markerach
kształtowych nie musiał przekraczać progu.

**Dobór ręczny wygrał z optymalizacją.** Trzy przebiegi wyszukiwania maksymalizującego dystans
CVD produkowały wartości łamiące projekt: lokaty i gotówkę w zieleniach (kolor marki i zysku),
gotówkę o L\* 18 lub 90 (kolor tekstu), a ostrzeżenie jako `#F7F70A`. Ograniczenie doboru
**znaczeniem** dało lepszy wynik niż optymalizacja metryki.

### Nie ma koloru ostrzeżenia — i nie będzie

Ekran importu maluje wiersze czterema stanami: błąd, ostrzeżenie, pominięte, gotowe.
Dziś mapuje je na `V2.loss`, `V2.gold`, `V2.muted`, `V2.profit`.

Osobna barwa ostrzeżenia **nie może współistnieć z bursztynowymi obligacjami** — zmierzone
dE przy CVD wynosi **6,0 w jasnym i 13,8 w ciemnym**, a w normalnym widzeniu tylko 11,2.
Każdy bursztyn spełniający kontrast wpada w kolor obligacji.

Rozwiązanie jest takie samo jak przy parze zysk/strata: **stan niesie słowo i glif, nie barwa.**
Kolumna statusu w tabeli importu i tak zawiera pełny tekst („Gotowe”, „Pominięte”, albo zdanie
z opisem błędu), więc kolor był tam ozdobą, a nie informacją. Konsekwencje:

- **błąd** → prymityw `Alert`, z własnym traktowaniem, nie kolor komórki
- **ostrzeżenie** → glif + słowo w atramencie
- **pominięte** → `--ink-muted`
- **gotowe** → atrament

Kolor pozostaje zarezerwowany dla **klas aktywów** (pięć, wsparte kształtem) i dla **pary
zysk/strata**. Paleta jest zamknięta i nie przyjmuje trzeciego ciepłego tonu obok akcentu i straty.

**Każda klasa ma marker kształtowy, nie tylko barwę.** Kwadrat, romb, koło i trójkąt zastępują
jednakowe kropki w tabelach i legendach. Dzięki temu klasa aktywu nie zależy od koloru w ogóle,
a kolor pozostaje przyspieszaczem. To była osobna decyzja, podjęta po zobaczeniu symulacji.

**Akcent w ciemnym: `#C4715A` → `#C9765F`.** Przesunięcie dE 1,9, czyli wizualnie niewykrywalne;
podnosi kontrast z 4,25 do 4,53 i domyka wymóg dla eyebrow, który jest małym tekstem.

**Zysk i strata nie zmieniają barwy — zmienia się to, co jest pokolorowane.**
Liczba renderuje się w atramencie (`--ink`), a barwę niesie **glif strzałki**. Wtedy kolor
przestaje być tekstem i staje się grafiką, gdzie próg kontrastu to 3,0 zamiast 4,5 —
a `#D9463A` osiąga 3,55 na obu ciemnych tłach. Rozwiązanie wynika wprost z decyzji, że nośnikiem
znaczenia jest strzałka: skoro tak, to ona ma być kolorowa, a liczba ma być czytelna.
Przy okazji liczby zyskują pełny kontrast atramentu (13,45) zamiast 3,55.

Alternatywa, którą odrzuciłem: rozjaśnienie straty do progu 4,5 wymaga przesunięcia
o dE ≥ 9 i psuje jej odległość CVD zarówno od akcentu, jak i od zysku.

**Strata jest świadomie przesunięta w chłodniejszą, czystszą czerwień**, żeby odsunąć ją od
terakotowego akcentu.

**Wyniki weryfikacji (2026-07-30).** Kontrast WCAG i symulacja CVD policzone numerycznie
(macierze Machado, severity 1.0, w przestrzeni liniowej):

| Sprawdzenie | Jasny | Ciemny | Werdykt |
|---|---|---|---|
| Kontrast wszystkich barw wobec obu teł | ≥ 4,75 | akcent 4,25 / strata 3,55 na `--surface` | ciemny **do poprawy** |
| Akcent vs strata, deuteranopia (dE76) | 11,2 | 14,9 | **oblane** (próg 15) |
| Akcje vs krypto, deuteranopia (dE76) | 6,1 | 4,7 | **oblane** |
| Zysk vs strata, deuteranopia | 29,2 | 28,3 | zdane |

Dwie usterki kontrastu w ciemnym dotyczą małego tekstu (procenty w tabelach), nie grafiki —
do podniesienia jasności przy implementacji tokenów.

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

**Ciemny pas to sekcja „Zbudowane pod polskie realia"** (potwierdzone 2026-07-30). IKE, IKZE,
obligacje detaliczne, NBP, GUS, podatek Belki — jedyna sekcja, której zagraniczny konkurent
nie skopiuje, więc to jej należy się podkreślenie. Rozeta w tle jest tam dozwolona,
bo to sekcja o niskiej gęstości.

**Sekcja funkcji zostaje przy dziewięciu pozycjach.** Pierwotnie planowaliśmy zejście do trzech,
ale to wymaga wiedzy z rozmów z betatesterami, a tej jeszcze nie ma. Dziewięć równorzędnych kafli
jest złe, kiedy wiesz, co jest najważniejsze, i tego nie pokazujesz — kiedy naprawdę nie wiesz,
jest po prostu uczciwe. Sekcję budujemy więc z **flagą `featured` w `copy.ts`**, tak żeby późniejsze
wypromowanie trzech pozycji było zmianą danych, nie przeprojektowaniem.

**Jak zdobyć brakującą odpowiedź.** Aplikacja ma już telemetrię ekranową: `ScreenView` emituje
`*_viewed` na pięciu widokach (dashboard, pozycje, transakcje, zarobki, ustawienia). To rozstrzygnie
najbardziej niepewną pozycję z dziewiątki — czy **„Moduł Zarobki"** zasługuje na landing, bo
śledzenie dochodów w aplikacji inwestycyjnej jest albo ukrytym hitem, albo martwym kodem.
Brakuje telemetrii na **imporcie**, raportach, porównaniu i instrumentach; import warto oznaczyć,
bo to drugi kandydat na najmocniejszą funkcję.

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

**Kolizja terakoty ze stratą — test oblany, decyzja podjęta świadomie.** Zmierzone dE76 przy
deuteranopii: 11,2 w jasnym i 14,9 w ciemnym, przy progu 15. Przetestowano cztery warianty
korekty w obrębie ciepłej rodziny — **każdy pogarszał wynik** (do 4,4). Przyczyna jest
strukturalna: deuteranopia zwija terakotę i czerwień na tę samą oś, więc żadne przesunięcie
odcienia tego nie ratuje.

Decyzja (2026-07-30): **obie barwy zostają, a strzałka `▲`/`▼` przestaje być wzmocnieniem
i staje się właściwym nośnikiem znaczenia.** Kolor jest wtedy przyspieszaczem dla tych,
którzy go widzą, a nie informacją. Konsekwencja dla implementacji: `Stat` i `Figure` **nie mogą**
renderować wartości zysku ani straty bez glifu — to jest niezmiennik komponentu, nie opcja stylu.

Skala problemu jest przy tym wąska: akcent żyje na eyebrowach, znaczniku nawigacji, focusie i CTA,
a strata na liczbach w tabelach. Stykają się realnie w jednym miejscu — w linii delty pod wielką liczbą.

**Kolizja akcji z kryptowalutami — nowy problem, poważniejszy od powyższego.** Zmierzone dE76
przy deuteranopii: 6,1 w jasnym i 4,7 w ciemnym, czyli praktycznie nierozróżnialne. Przyczyna:
obie barwy mają niemal identyczną jasność (L\* 41 i 41), a różnią się wyłącznie odcieniem — czyli tym,
co ślepota barw niszczy. Boli bardziej niż kolizja akcentu, bo wykres alokacji i kropki w tabeli
identyfikują klasę **wyłącznie kolorem**, a akcje to zwykle największa pozycja w portfelu.

Zweryfikowana korekta przez rozsunięcie po jasności podnosi wynik do **22,7 w jasnym i 17,6 w ciemnym**:

| | jasny | ciemny |
|---|---|---|
| Akcje / ETF | `#2C6394` → `#20507E` | `#4A8FC7` → `#3E7FB8` |
| Kryptowaluty | `#6B52A3` → `#8A6FD0` | `#9B84D4` → `#B6A2E4` |
| Gotówka | `#566A7C` → `#4A5A68` | bez zmian |

Status: **przyjęte 2026-07-30, wraz z markerami kształtowymi.** Wartości finalne w sekcji 4.
Obie usterki kontrastu w ciemnym też zamknięte: akcent przesunięty o dE 1,9, a zysk i strata
rozwiązane przez przeniesienie barwy z liczby na glif. Paleta nie ma już otwartych pozycji.

**~~Wartości palety danych nie są zweryfikowane.~~** Zamknięte 2026-07-30 — patrz sekcja 4.

**~~Ciemny pas na landingu nie został zaprojektowany.~~** Zamknięte — sekcja „Zbudowane pod polskie realia".

**Trzy najmocniejsze funkcje — zablokowane brakiem danych, nie decyzją.** Zostaje dziewięć pozycji
plus flaga `featured`. Odblokuje to telemetria (patrz sekcja 8) albo pierwsze rozmowy z betatesterami.

**Znak nadal nie ma źródła ani wykonawcy.** Wiadomo, że rozeta zostaje jako sygnatura i że jest
naszym własnym rysunkiem, nie przerysem. Otwarte: czy zamawiamy znak u projektanta giloszy,
i który obiekt z archiwum jest punktem wyjścia. Placeholder w lookbooku jest słaby i o tym wie.

**~~Test na dwusetnym ekranie nie został przeprowadzony.~~** Wykonany 2026-07-30 na
`import-page`, `add-transaction-modal` i `settings-page`. Znalazł: błąd w diagnozie (sekcja 1),
piątą klasę aktywów, brak osi statusu i sześć brakujących prymitywów. Wszystko naprawione powyżej
poza prymitywami — patrz niżej.

**Sześć prymitywów do dopisania, znalezionych na brzydkich ekranach.** Lista z sekcji 7 powstała
z widoków, które da się uładnić, i dlatego jest niepełna. Brakuje:

| prymityw | gdzie występuje |
|---|---|
| `Alert` | `role="alert"` w imporcie — komunikaty błędu i wyniku |
| `Toggle` | `role="switch"` w ustawieniach |
| `RadioGroup` | `role="radiogroup"` w ustawieniach |
| `Tabs` | 13 wystąpień w trzech plikach |
| `Stepper` | wieloetapowy przepływ importu z paskiem postępu |
| `Disclosure` | `<details>/<summary>` w modalu transakcji |

`Select` i `Badge` **nie są brakami** — istnieją już jako `v2SelectStyle` i `V2Badge`.

**`DataTable` był zaprojektowany pod liczby, a musi unieść prozę.** Tabela podglądu importu ma
kolumnę statusu o `minWidth: 240` wypełnioną pełnymi zdaniami („Nieznany instrument, brak kursu
na 2024-03-11”). Specyfikacja mówiła „liczby do prawej, tabelarycznie” i nic o kolumnie tekstowej,
która się łamie i ma `verticalAlign: top`.

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
