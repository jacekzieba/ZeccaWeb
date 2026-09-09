# Design system „Skarbiec" — paleta i typografia

Data: 2026-09-07
Status: zatwierdzony, wdrożony na landingu i w powłoce aplikacji

Nie zastępuje [kierunku „Próba"](2026-08-05-design-system-proba-design.md), tylko podmienia w nim
warstwę koloru i typografii. Struktura, szyna i reguła cechowania z „Próby" **obowiązują dalej**.

---

## 1. Co się stało

Landing po serii iteracji zszedł z warstwy tokenów: dostał własną ciemną paletę (`--vault`,
`--amber`) i własne kroje (Bodoni Moda, Archivo) ładowane wyłącznie w `app/page.tsx`. Aplikacja
została przy zieleni z terakotą i Space Grotesk / Newsreader. Przez kilka tygodni produkt miał
dwie tożsamości, a pliki systemu opisywały tylko jedną z nich.

Decyzja właściciela z 2026-09-07: **kanoniczny jest kierunek landingu.** Aplikacja przechodzi na
skarbiec, pliki systemu zostają przepisane.

## 2. Dwa błędy, które przy okazji wyszły

1. **Nazwy ról znaczyły na obu powierzchniach coś przeciwnego.** W aplikacji `--font-display` był
   groteskiem, a `--font-text` szeryfem; na landingu odwrotnie. Warstwa zgodności
   (`TYPOGRAPHY.serif → var(--font-display)`) była zgodna z landingiem, więc alias „serif" wskazywał
   w aplikacji na krój bezszeryfowy. Naprawione: nazwa trzyma **rolę**, nie krój.
2. **Landing zgubił mono**, mimo że reguła systemu brzmi „każda liczba mono". Przywrócone.

## 3. Tokeny — kolor

Kanoniczny jest motyw **ciemny**. Motyw jasny to ten sam bursztyn przyciemniony do kontrastu na
papierze — odpowiednik, nie osobny kierunek. Źródło: `src/design/tokens.css` + `src/design/tokens.ts`,
pilnowane przez `tests/unit/design-tokens.test.ts`.

| token | ciemny (kanoniczny) | jasny |
|---|---|---|
| `--ground` | `#020A0B` | `#FAF8F4` |
| `--surface` | `#06110F` | `#FFFFFF` |
| `--surface-2` | `#0B1917` | `#F2EFE9` |
| `--ink` | `#ECEFEC` | `#1A1712` |
| `--ink-muted` | `#9FB0AA` | `#5E574C` |
| `--ink-faint` | `#80958E` | `#8C857A` |
| `--line` | `rgba(198,232,222,.11)` | `rgba(26,23,18,.14)` |
| `--accent` | `#F0A43C` | `#A9682A` |
| `--on-accent` | `#160C02` | `#FFF8EF` |
| `--rail` | `rgba(198,232,222,.22)` | `rgba(26,23,18,.22)` |
| `--up` / `--down` | `#4FC79A` / `#E2685A` | `#1E7A55` / `#AE1F14` |

Bursztyn ma **zamkniętą listę zadań**: cechy źródła, linki, akcja główna. Nic więcej — dlatego
żadna klasa aktywów nie używa bursztynu, mimo że wizualnie by pasował.

Klasy aktywów (ciemny): equity `#63A594`, bonds `#C9A24F`, deposit `#8A9E97`, cash `#5C7E93`,
crypto `#B6A2E4`. Pięć, nie cztery.

## 4. Typografia

**Bodoni Moda** 400/500 + italic (nagłówki) · **Archivo** 300/400/500 (proza, etykiety, przyciski)
· **IBM Plex Mono** 400/500 (cechy i liczby).

Reguła podziału ról: **nagłówki Didone, proza i etykiety groteskiem, każda liczba mono.**

Nazwa trzyma rolę, nie krój — `--font-display` to nagłówkowy Didone na obu powierzchniach,
`--font-text` to grotesk na obu. Ten invariant był złamany i jest warunkiem, żeby dowolny komponent
dało się przenieść między landingiem a aplikacją bez podmiany krojów.

Kroje ładuje `app/layout.tsx` dla całego produktu. `app/page.tsx` ładuje te same rodziny lokalnie
dla landingu — to redundancja do posprzątania, nie druga decyzja.

## 5. Promienie

Skarbiec jest ostro cięty. Skala zeszła z 4/10/14/20/28 na **2/3/4/8/12** (`--r-xs` … `--r-xl`),
plus `--r-pill`. Przyciski `--r-sm`, panele `--r-md`, karty podglądu `--r-lg`.

## 6. Co zostaje z „Próby" bez zmian

- **Szyna z podziałką** (`--rail-step: 12px`) jako sygnatura: cechy po lewej, treść po prawej,
  nic nie przekracza szyny. Poniżej 900 px szyna znika, a cecha wraca nad zdanie.
- **Na szynie stoją wyłącznie rzeczy weryfikowalne** — źródło, data, jednostka, liczba obserwacji.
  Nigdy hasło marketingowe.
- **Cienie nie istnieją** — głębię niesie powierzchnia i krawędź. Pilnowane testem.
- **Treść leży na panelach**, cecha zostaje obok na papierze.
- Dziewięciostopniowa skala odstępów.

## 7. Stan wdrożenia

| powierzchnia | stan |
|---|---|
| landing | wdrożony |
| powłoka aplikacji (tokeny, kroje, motyw domyślny) | wdrożone |
| Pulpit — rejestr KPI na szynie | wdrożony |
| Pozycje, Transakcje, Instrumenty, Zarobki, Raporty, Portfele, Import, Ustawienia, Porównanie | **czekają** — układ nadal kaflowy |

## 8. Rzeczy otwarte

- **Dziewięć widoków aplikacji** nie ma jeszcze szyny ani cech przy liczbach.
- **`KpiCard` ma `boxShadow`** — łamie regułę „cienie nie istnieją". Używają go Portfel i Raporty.
- **Zrzuty ekranu na landingu** pokazują aplikację sprzed przejścia na skarbiec. Do wymiany, kiedy
  widoki wejdą na nowy układ — dopiero wtedy landing i produkt zaczną się zgadzać.
- **Landing ma własne nazwy lokalne** (`--vault`, `--amber`, `--hair`) zamiast aliasować tokeny.
  Do scalenia, żeby paleta miała jedno źródło.
