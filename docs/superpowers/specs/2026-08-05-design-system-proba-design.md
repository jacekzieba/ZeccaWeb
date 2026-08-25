# Design system „Próba" — kierunek wizualny landingu

Data: 2026-08-05
Status: zatwierdzony, wdrożony na landingu (aplikacja czeka na drugą turę)

Zastępuje [kierunek „Certyfikat"](2026-07-29-design-system-certyfikat-design.md).

---

## 1. Dlaczego „Certyfikat" upadł

Wdrożenie dało stronę, o której właściciel powiedział, że „zmieniła tylko kolory". Trzy przyczyny,
wszystkie potwierdzone na renderze:

1. **Spec sam zamroził strukturę.** Sekcja 8 poprzedniego dokumentu brzmiała: „Układ i copy zostają.
   Zmienia się wyłącznie warstwa wizualna." Przy zamrożonym układzie jedyne, co zostaje do zmiany,
   to paleta — i dokładnie to było widać.
2. **Paleta trafiła w domyślny look.** Krem `#FBFCFA` + szeryf display + terakota `#A0512F` to
   najczęstszy zestaw generowanego designu. Poprzedni spec sam przed nim ostrzegał i sam w niego wszedł.
3. **Sygnatura była niewidoczna.** Rozeta giloszowa leżała pod treścią przy 14% krycia. Unikatowość
   wydana przy 14% krycia to unikatowość niedostarczona.

## 2. Teza kierunku

Mennica nie zdobiła — **ważyła i sprawdzała próbę**. Zecca robi z liczbami to samo: każda ma źródło,
jednostkę i moment sprawdzenia. Rejestr jest rzeczowy i techniczny. Spokój bierze się z tego, że
wszystko jest ocechowane, nie ze zmiękczania kształtów.

## 3. Sygnatura: szyna z podziałką

Pionowa linia z podziałką (`--rail-step: 12px`) biegnie przez całą stronę na stałej pozycji.
Po lewej stronie szyny stoją cechy, po prawej treść. Nic nie przekracza szyny.

**Reguła, która robi z tego system, a nie ornament: na szynie stoją wyłącznie rzeczy weryfikowalne** —
źródło, data, jednostka, liczba obserwacji. Nigdy hasło marketingowe. Czego nie da się ocechować,
nie ma prawa stać na szynie. Konsekwencja jest dla treści, nie tylko dla wyglądu: strona nie może
napisać „najlepsza aplikacja", bo tego nie da się opatrzyć cechą.

Nagłówki sekcji zostawiają lewą kolumnę **pustą** — i to jest zgodne z regułą, nie wyjątek od niej.

Poniżej 900 px szyna znika, a cecha wraca nad zdanie, którego dotyczy.

## 4. Tokeny — kolor

Jasny domyślny, ciemny przez inwersję tych samych zmiennych. Źródło:
`src/design/tokens.css` + `src/design/tokens.ts`, pilnowane przez `tests/unit/design-tokens.test.ts`.

**Decyzja właściciela z 2026-08-05:** paleta zostaje przy **zieleni z terakotą** z poprzedniego
kierunku. Propozycja „cynk + ultramaryna" (`#E2E3DD` / `#23409A`) została odrzucona i nie ma
jej w kodzie — kierunek „Próba" niesie tu strukturę i typografię, nie kolor.

| token | jasny | ciemny |
|---|---|---|
| `--ground` | `#FBFCFA` | `#0B1A14` |
| `--surface` | `#FFFFFF` | `#122A20` |
| `--ink` | `#123B2B` | `#EDF2EE` |
| `--ink-muted` | `#55665C` | `#8FAE9C` |
| `--line` | `rgba(18,59,43,.14)` | `rgba(159,191,174,.16)` |
| `--accent` | `#A0512F` | `#C9765F` |
| `--rail` | `rgba(18,59,43,.22)` | `rgba(159,191,174,.16)` |

Terakota ma **zamkniętą listę zadań**: cechy źródła, linki, akcja główna. Nic więcej.
Token `guilloche` zniknął razem z rozetą; jego miejsce zajął `rail`.

## 5. Typografia

Space Grotesk 500/700 (display) · Newsreader 400/500 (proza) · IBM Plex Mono (cechy i liczby).

**Reguła podziału ról:** proza szeryfem, etykiety i przyciski groteskiem, każda liczba mono.
Bez niej szeryf trafi do gęstych tabel aplikacji i zrobi się ciasno. W `landing.css` nazwy lokalne
trzymają rolę, nie krój: `--display`, `--text`, `--mono`.

## 6. Struktura landingu — co się zmieniło

| przed | po |
|---|---|
| hero: 3 CTA, badge'y sklepów, 4 kafle zaufania | **Otwarcie**: nagłówek, lead, jedno CTA; cecha platform na szynie |
| `hero.sources` + `hero.trust` | **Rejestr**: 5 wierszy liczonych z portfela demo, każdy z cechą źródła |
| karty produktu z przechyłem 3D | **Podgląd demo** bez kart, cieni i przechyłu |
| `howItWorks` | bez zmian; **numeracja 01/02/03 zostaje tylko tutaj**, bo to jedyna prawdziwa sekwencja |
| `features` — 9 kafli z ikonami | **Zakres** — 9 pozycji listy, tagi stały się cechami na szynie |
| `investor` — 6 kafli | **Polskie realia** — jedyny ciemny pas, badge'e stały się cechami |
| `showcase` — ramka okna, orbita, chip | **Podgląd platform** — zrzut na papierze, zakładki mono; badge'y sklepów tutaj |
| `faq` | pytania na szynie, odpowiedzi po prawej |
| `betaList` + `feedback` (dwa formularze) | jeden formularz zapisów; kontakt i Discord w stopce |

Eyebrow'y `01 · FUNKCJE`, `02 · DLA POLSKIEGO INWESTORA`, `04 · FAQ` zniknęły — numerowały coś,
co nie jest sekwencją.

## 6a. Korekta po pierwszym renderze (2026-08-05)

Pierwsze wdrożenie było zbyt ascetyczne: płaskie powierzchnie, włosowe linie, proste kanty i dużo
pustki. Właściciel to odrzucił. Korekta, która obowiązuje:

- **Treść leży na panelach** (`--surface`, krawędź `--line`, promień `--r-md`), cecha zostaje obok
  na papierze. Szyna jest znakiem, nie gorsetem.
- **Promienie wracają z tokenów** — przyciski `--r-sm`, panele `--r-md`, karty podglądu `--r-lg`.
- **Gęściej:** sekcje 60 px zamiast 72, nagłówki sekcji 28 px zamiast 44.
- **Cienie nadal nie istnieją** — głębię niesie powierzchnia i krawędź.

## 7. Rzeczy otwarte

- **Zrzuty ekranu w sekcji „Aplikacje" pokazują starą skórę aplikacji.** Zostaną wymienione, kiedy
  kierunek wejdzie do produktu — do tego czasu landing i zrzuty się nie zgadzają.
- **SEO:** `h1` zmienił się z frazy „Wszystkie Twoje inwestycje w jednym miejscu" na tezę kierunku.
  Słowa kluczowe przeniosły się do ledu. Do zweryfikowania na pozycjach.
- **Aplikacja** dostaje tokeny automatycznie (`V2`/`COLORS` aliasują do zmiennych), ale jej układ
  jest wciąż kaflowy. Szyna wchodzi tam w drugiej turze.
