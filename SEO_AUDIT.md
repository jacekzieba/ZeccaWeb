# Audyt SEO — Zecca (zecca.pl)

Data audytu: 2026-07-23
Zakres: landing page i strony marketingowe (`/`, `/faq`, `/privacy-policy`, `/demo`) w repozytorium Next.js `zecca-web`.
Metoda: analiza kodu źródłowego, build produkcyjny (`next build`), uruchomienie `next start` lokalnie i inspekcja realnego HTML/nagłówków HTTP, `tsc --noEmit`, `eslint`, inspekcja w przeglądarce (desktop + mobile viewport, konsola, DOM), Lighthouse (mobile + desktop) na zbudowanej aplikacji produkcyjnej.

**Aktualizacja po uruchomieniu Lighthouse:** lokalny test (`next start`) ujawnił, że ten sam błąd w middleware, który psuje obsługę 404 (P0-1), teoretycznie mógłby też blokować własne skrypty Vercel Analytics i Speed Insights.

**Aktualizacja po weryfikacji na produkcji (zecca.pl):** dzięki zrzutom ekranu z zakładki Sieć na `zecca.pl` oraz z panelu Vercel Speed Insights, **to podejrzenie się nie potwierdziło** — skrypty `/_vercel/insights/script.js` i `/_vercel/speed-insights/script.js` ładują się na produkcji poprawnie (status 200), a panel Speed Insights pokazuje realne dane o odwiedzinach (`/`: 39, `/demo`: 11, `/login`: 21 w 7 dni) i Real Experience Score per trasa. Zdegradowałem ten wątek do **P3** (patrz sekcja 2, dawne "P0-2") — Vercel najwyraźniej przechwytuje `/_vercel/*` na poziomie swojej platformy, zanim trafi do middleware tej aplikacji. **Jedynym pozostałym problemem P0 jest P0-1** (nieznane adresy URL → przekierowanie do `/login` zamiast 404), który nie ma nic wspólnego z Vercel Analytics i pozostaje w pełni aktualny.

## Status wdrożenia (2026-07-23, po audycie)

Priorytet: pomiar zapisu do bety. Wdrożono i zweryfikowano (`tsc --noEmit`, `eslint`, `next build`, `next start` + `curl`, `vitest run` — 346/346 testów przechodzi, ponowny Lighthouse):

| ID | Status | Zweryfikowane jako |
| --- | --- | --- |
| P1-5 | ✅ Wdrożone | `track()` z `@vercel/analytics` podłączony do zdarzenia zapisu do bety w `landing-interactions.tsx`; potwierdzone w skompilowanym buildzie |
| P0-1 | ✅ Wdrożone | `middleware.ts` przepisany z deny-listy na allow-listę chronionych tras; `curl` na nieznanej ścieżce zwraca teraz `404` (było `307`→`/login`) |
| P1-1 | ✅ Wdrożone | `/demo` usunięte z `sitemap.xml` |
| P1-2 | ✅ Wdrożone | `canonical` obecny na `/faq` i `/privacy-policy` |
| P1-3 | ✅ Wdrożone | Link "FAQ" dodany do stopki landing page'u |
| P2-1, P2-2 | ✅ Wdrożone | Hierarchia nagłówków poprawiona — potwierdzone w wygenerowanym HTML (H1→H2→H3, bez spłaszczeń) |
| P2-3 | ✅ Wdrożone | JSON-LD `availability` zmienione na `InStock` |
| P2-4 | ✅ Wdrożone | Link na 404 zmieniony z `/dashboard` na `/` |
| P2-5 | ✅ Wdrożone | Literówka "Zekki" → "Zecci" poprawiona |
| P2-6 | ✅ Wdrożone | Kontrast `.compare-foot` poprawiony — Lighthouse `color-contrast` z 0 → 1 (Accessibility: 97→100) |
| P3-1, P3-2, P3-3 | ✅ Wdrożone | Usunięto martwe `app/icon.png`/`app/apple-icon.png`, martwe odwołanie do `manifest.webmanifest`, `Footer` przestał być `"use client"` |
| P3-4 | ✅ Wdrożone przy okazji P0-1 | `/_vercel/insights/script.js` teraz poprawnie NIE jest przekierowywane do `/login` |
| **P1-4** | ✅ **Decyzja podjęta: bez zmian** | Świadomie zaakceptowano koszt (~129 KB) globalnego bundle'a Sentry na stronach marketingowych — priorytetem jest wykrywanie błędów na formularzu zapisu do bety (niski ruch obecnie, strona już przyspieszona do 95/100 mobile innymi poprawkami). Do rewizji, gdy ruch wyraźnie wzrośnie lub wydajność stanie się realnym problemem w danych produkcyjnych. |
| Sekcja 6 (architektura SEO) | ⏳ Nie wdrożone | Propozycje nowych podstron to decyzja produktowa/treściowa na później |

**Lighthouse mobile, `/`, przed → po:** Performance 85→95, Accessibility 97→100, Best Practices 92→96, SEO 100→100 (bez zmian). LCP 4,1 s → 2,9 s, TBT 100 ms → 50 ms.

Zmiany nie zostały jeszcze scommitowane ani wdrożone na produkcję — to celowo pozostawione do Twojej decyzji (`git status` pokazuje 14 zmodyfikowanych plików + 2 usunięte + nowy `SEO_AUDIT.md`).

---

## 1. Executive summary

Zecca to prywatna aplikacja (macOS, iOS, web) do śledzenia portfela inwestycyjnego polskiego inwestora indywidualnego: akcje, ETF-y, obligacje skarbowe detaliczne, lokaty, IKE/IKZE, krypto i aktywa ręczne, z natywnym liczeniem XIRR/TWR/CAGR, wyniku realnego po inflacji GUS i kursów NBP. Produkt jest w fazie bety, częściowo darmowej, z listą zapisów beta i równoległą możliwością założenia konta.

**Stan ogólny: solidny fundament techniczny z jedną poważną usterką indeksowania.** Landing page, FAQ i polityka prywatności są w pełni statycznie generowane (SSG), treść jest realnie obecna w HTML bez JavaScriptu, nagłówki bezpieczeństwa i CSP są przemyślane, a treść marketingowa jest konkretna i dobrze dopasowana do polskiego inwestora (IKE/IKZE, NBP, GUS — realne wyróżniki, nie ozdobniki). Strona nie używa web fontów (same fonty systemowe) i respektuje `prefers-reduced-motion`.

**Największe ryzyko:** middleware (`middleware.ts`) traktuje każdy adres URL, który nie jest jawnie wymieniony na białej liście, jako chronioną trasę aplikacji i przekierowuje go (307) do `/login`. W praktyce oznacza to, że **każdy błędny/nieistniejący/przestarzały adres URL na zecca.pl zwraca przekierowanie do ekranu logowania zamiast 404** — potwierdzone bezpośrednim testem (`curl` na zbudowanej aplikacji produkcyjnej). To realnie utrudnia Google prawidłowe rozpoznawanie usuniętych/błędnych stron i psuje doświadczenie realnych użytkowników trafiających z uszkodzonych linków. (Lokalny test sugerował, że ten sam mechanizm mógłby też blokować skrypty Vercel Analytics/Speed Insights — **zweryfikowane na produkcji jako nieprawdziwe**, patrz sekcja 2, pozycja P3-4.)

**Największa szansa:** strona FAQ (`/faq`) zawiera już gotowy, dobrze napisany słownik metryk inwestycyjnych (XIRR, TWR, CAGR, wynik realny, drawdown) — to naturalny fundament pod treści z długiego ogona ("czym jest XIRR", "jak liczyć realny zwrot z inwestycji"), ale strona ta nie ma **żadnego linku wejściowego ze strony głównej** (nie ma jej w nawigacji ani w stopce landing page'a) — jest osierocona względem najważniejszej strony w serwisie.

**Gotowość do pozyskiwania ruchu organicznego: umiarkowana.** Fundament (rendering, treść, dane strukturalne) jest gotowy. Zanim warto inwestować w budowę ruchu, trzeba naprawić zachowanie przy nieznanych adresach URL (P0) i uporządkować sitemapę/kanoniczne adresy (P1), inaczej nowy ruch organiczny trafiający na stare/błędne linki będzie tracony na przekierowaniach do logowania.

### Oceny cząstkowe (0–10)

| Obszar | Ocena | Uzasadnienie |
| --- | --- | --- |
| Indeksowalność | 6/10 | robots.txt i sitemap.xml poprawne i absolutne, ale middleware zamienia nieznane URL-e w przekierowania do `/login` zamiast 404, a `/demo` jest w sitemapie mimo `noindex`. |
| Techniczne SEO (Next.js) | 6/10 | Static generation działa poprawnie dla wszystkich stron marketingowych (potwierdzone `next build`), ale middleware wykonuje wywołanie Supabase na **każdym** requeście do statycznych stron marketingowych, a globalny bundle Sentry (~129 kB, potwierdzone Lighthouse) ładuje się na każdej trasie. |
| On-page SEO (title/description/nagłówki) | 7/10 | Title/description strony głównej są konkretne i trafne (Lighthouse SEO = 100/100 dla `/`); brak canonical na `/faq` i `/privacy-policy`; hierarchia nagłówków miejscami spłaszczona (H2 użyte stylistycznie). |
| Treść | 8/10 | Jasna propozycja wartości, konkretne różnicowanie (IKE/IKZE, NBP, GUS), uczciwe porównanie z konkurencją, gotowy słownik metryk. Drobne potknięcia: literówka, dwa konkurujące CTA. |
| Wydajność | 6/10 | Lighthouse (produkcyjny build, `/`): **Performance 85/100 mobile, 98/100 desktop**. LCP 4,1 s / TBT 100 ms / CLS 0 na mobile (LCP 1,1 s na desktop) — CLS doskonały, ale mobilny LCP jest w strefie "wymaga poprawy". Brak web fontów, statyczne strony, rozsądne obrazy — ale ~129 kB (44% wagi strony, potwierdzone Lighthouse: `unused-javascript` i `bootup-time`) to pojedynczy chunk Sentry ładowany na każdej trasie marketingowej. Realne CWV z pola (RUM) częściowo dostępne w Speed Insights (Real Experience Score per trasa), ale granularne wykresy FCP/LCP/INP/CLS/TTFB pokazują "brak danych" — prawdopodobnie zbyt mały wolumen ruchu (patrz sekcja 8). |
| Mobile SEO | 8/10 | Viewport poprawny, brak poziomego scrolla, menu mobilne dostępne z klawiatury, tabela porównania ma wrapper scrollowalny. Lighthouse SEO = 100/100 na mobile. |
| Dane strukturalne | 7/10 | `SoftwareApplication` + `FAQPage`, generowane server-side, treść zgodna z widoczną — ale `availability: PreOrder` przeczy realnie dostępnym CTA "Załóż konto"/"Zobacz demo". |
| Międzynarodowe SEO | n/d | Serwis jednojęzyczny (pl-PL), świadomie skoncentrowany na polskim rynku — brak hreflang jest tu poprawny, nie błędem. |
| Pomiar i analityka | 5/10 | Potwierdzone na produkcji (panel Speed Insights): Vercel Analytics/Speed Insights realnie zbierają dane (odwiedziny i Real Experience Score per trasa) — obawa o blokadę przez middleware się nie potwierdziła. Brakuje jednak: pomiaru konwersji (CTA, zapis do bety) mimo gotowego, niepodłączonego haka w kodzie (P1-5), oraz granularnych metryk CWV (FCP/LCP/INP/CLS) w panelu Speed Insights — pakiet jest aktualny (2.0.0), więc to najpewniej efekt bardzo niskiego ruchu (71 wizyt/7 dni), nie błędu konfiguracji. |

---

## 2. Najważniejsze problemy

| ID | Priorytet | Problem | Dowód | Wpływ | Rekomendacja | Lokalizacja w kodzie |
| -- | --- | --- | --- | --- | --- | --- |
| P0-1 | **P0** | Nieznane/błędne adresy URL zwracają przekierowanie 307 do `/login` zamiast 404 | Zweryfikowane na zbudowanej aplikacji: `curl -I http://127.0.0.1:3100/this-page-does-not-exist` → `HTTP/1.1 307` `location: /login?next=%2Fthis-page-does-not-exist`. Ścieżki spoza białej listy (`isAppRoute`) trafiają w gałąź przekierowania. To jedyny problem P0 w tym audycie — pierwotne podejrzenie o drugi problem P0 (blokada Vercel Analytics) nie potwierdziło się na produkcji, patrz P3-4. | Każdy błędny/usunięty/przekierowany link zewnętrzny albo literówka w adresie trafia realnego użytkownika i Googlebota na ekran logowania zamiast na 404. Google Search Console zgłosi to jako przekierowania, nie jako braki 404; realni użytkownicy z linków zewnętrznych utkną na logowaniu. | Middleware powinien przepuszczać nieznane ścieżki do natywnego routingu Next.js (który poprawnie zwraca 404 — potwierdzone dla `/faq/doesnotexist` i `/demo/x/y`), zamiast zgadywać po prefiksie, że to "chroniona trasa aplikacji". Przy okazji warto dodać też wyjątek z P3-4. | `middleware.ts:110-137` (logika `isAppRoute` i przekierowanie) |
| P1-1 | P1 | `/demo` jest w `sitemap.xml` (priorytet 0.8), a jednocześnie ma `robots: {index:false, follow:false}` | `app/sitemap.ts:16-20` vs `app/demo/page.tsx:6-9`; potwierdzone w wygenerowanym `sitemap.xml` i w `<meta name="robots" content="noindex, nofollow">` na `/demo`. | Google Search Console zgłosi "Zgłoszony URL oznaczony jako noindex" — sprzeczny sygnał, marnowanie budżetu indeksowania, brak jasności co strona ma robić. | Usuń `/demo` z sitemapy (skoro ma zostać noindex) albo usuń `noindex`, jeśli demo ma być indeksowalne. | `app/sitemap.ts:16-20`, `app/demo/page.tsx:6-9` |
| P1-2 | P1 | Brak `canonical` na `/faq` i `/privacy-policy` | Zweryfikowane na wygenerowanym HTML: brak `<link rel="canonical">` na obu stronach (root layout też nie ustawia `alternates` domyślnie). | Brak jednoznacznego kanonicznego adresu na dwóch indeksowalnych, obecnych w sitemapie stronach — ryzyko przyszłych duplikatów (warianty z parametrami, wielkość liter itp.) bez sygnału konsolidującego. | Dodać `alternates: { canonical: "/faq" }` i `alternates: { canonical: "/privacy-policy" }` do `metadata` obu stron (analogicznie do `app/page.tsx:16-18`). | `app/faq/page.tsx:5-8`, `app/privacy-policy/page.tsx:4-7` |
| P1-3 | P1 | `/faq` jest osierocona względem strony głównej | `app/_landing/copy.ts:19-27` (nav.links) i `:409-427` (footer.columns) — żaden link nie prowadzi do `/faq`. Strona jest osiągalna wyłącznie przez sitemapę albo przejście przez `/privacy-policy`. | Strona z realnie wartościową, unikalną treścią (słownik metryk XIRR/TWR/CAGR) nie dostaje żadnego wewnętrznego "link equity" z najważniejszej strony serwisu — ogranicza to jej potencjał rankingowy mimo dobrej treści. | Dodać link "FAQ" do nawigacji lub stopki landing page'u. | `app/_landing/copy.ts:19-27, 409-427` |
| P1-4 | P1 | Globalny bundle Sentry (~128 kB gzip) ładowany na każdej trasie, w tym na statycznych stronach marketingowych | `instrumentation-client.ts` inicjalizuje pełne Sentry SDK globalnie; w `app-build-manifest.json` chunk `5857-*.js` (412 kB / ~128 kB gzip wg raportu `next build`) jest identyczny dla `/page`, `/faq/page`, `/demo/page` i `/(app)/dashboard/page` — potwierdzone grepem sygnatur "Sentry" w tym pliku. | Każdy odwiedzający landing page (w tym Googlebot renderujący JS i realni użytkownicy z organicznego ruchu) pobiera i parsuje ~128 kB kodu monitorowania błędów, który jest krytyczny dla zalogowanej aplikacji, ale zbędny na statycznej stronie marketingowej. Wpływa na czas do interaktywności (TBT/INP) na stronie, której szybkość ma największe znaczenie SEO. | Rozważyć: zmniejszenie `tracesSampleRate` dla tras marketingowych, warunkowe/leniwe ładowanie Sentry poza ścieżkami `/`, `/faq`, `/privacy-policy`, `/demo`, albo świadomą akceptację kosztu z dokumentacją decyzji. To zmiana architektoniczna, nie „quick win”. | `instrumentation-client.ts:1-15` |
| P1-5 | P1 | Zero pomiaru konwersji na landing page | `app/_landing/landing-interactions.tsx:279-283` wysyła `CustomEvent("zecca:beta-waitlist-signup")`, ale grep po całym repo nie znajduje żadnego nasłuchu na to zdarzenie. Brak jakiegokolwiek wywołania `track()` z `@vercel/analytics` w całym repo. | Nie da się zmierzyć, ile zapisów do bety / kliknięć "Zobacz demo" / "Załóż konto" pochodzi z ruchu organicznego — brak możliwości oceny ROI działań SEO (patrz sekcja 16 zakresu audytu). | Podłączyć istniejący hook zdarzenia (`zecca:beta-waitlist-signup`) do `track()` z `@vercel/analytics`, dodać analogiczne zdarzenia dla kliknięć głównych CTA. | `app/_landing/landing-interactions.tsx:279-283` |
| P2-1 | P2 | Hierarchia nagłówków spłaszczona: 4 elementy "trust band" jako `<h2>` na tym samym poziomie co realne sekcje strony | Wygenerowany HTML: `H2: Dane szyfrowane end-to-end`, `H2: Wybierz wersję offline...`, `H2: Aktualne kursy...`, `H2: Inflacja CPI z GUS` — wszystkie przed pierwszym realnym `H2` sekcji ("Zecca prezentuje dane..."). | Nagłówki używane do stylowania krótkich haseł zaufania zamiast do opisu struktury strony — utrudnia crawlerom i czytnikom ekranu odczytanie rzeczywistego szkieletu treści. | Zmienić te 4 elementy na np. `<p><strong>` lub `<h3>` zagnieżdżone pod sekcją hero, nie `<h2>`. | `app/_landing/landing-hero.tsx:290-296` (mapowanie `hero.trust` na `<h2>`) |
| P2-2 | P2 | Na `/faq` każde pytanie jest `<h2>`, siostrzane wobec nagłówka sekcji "Najczęstsze pytania" | Wygenerowany HTML strony `/faq` (9 dodatkowych `<h2>` zamiast `<h3>`). | Spłaszcza hierarchię — pytania FAQ powinny być podrzędne wobec sekcji, nie równorzędne. | Zmienić tag pytań FAQ z `h2` na `h3`. | `app/faq/page.tsx:326` |
| P2-3 | P2 | JSON-LD `availability: "https://schema.org/PreOrder"` przeczy widocznej treści | `app/page.tsx:81-86`; jednocześnie nawigacja i hero mają aktywne, działające CTA "Załóż konto" i "Zaloguj się" (`copy.ts:19-27`) oraz publiczne demo pod `/demo`. | Dane strukturalne sugerują wyszukiwarce, że produktu jeszcze nie można używać — sprzeczne z realną możliwością rejestracji/logowania. | Zmienić na `https://schema.org/InStock` (produkt jest używalny już teraz, w wersji beta) albo usunąć pole `availability`. | `app/page.tsx:81-86` |
| P2-4 | P2 | 404 (`not-found.tsx`) kieruje jedynym CTA z powrotem do `/dashboard` | `app/not-found.tsx:43-59` — jedyny link na stronie 404 to "Wróć do dashboardu" → `/dashboard`. | Anonimowy użytkownik, który trafił na prawdziwe 404 (np. `/faq/literowka`), po kliknięciu jedynego CTA zostanie odbity przez middleware do `/login` (bo `/dashboard` wymaga sesji) — ślepy zaułek zamiast powrotu na stronę główną. | Dla niezalogowanych dodać link do `/` zamiast (lub obok) `/dashboard`. | `app/not-found.tsx:43-44` |
| P2-5 | P2 | Literówka w treści FAQ ("Zekki" zamiast "Zecci") | Widoczna zarówno w akordeonie FAQ na stronie głównej, jak i w wygenerowanym JSON-LD `FAQPage` (ten sam string źródłowy). | Drobny błąd językowy w treści widocznej dla użytkowników i w danych strukturalnych. | Poprawić odmianę na "Zecci". | `app/_landing/copy.ts:342` |
| P3-1 | P3 | `app/icon.png` (512×512) i `app/apple-icon.png` (180×180) są martwe — budowane jako osobne trasy, ale nienidlinkowane w `<head>` | `next build` generuje `○ /icon.png` i `○ /apple-icon.png` jako samodzielne trasy, ale w wygenerowanym `<head>` widnieją tylko ręcznie zdefiniowane ikony z `public/` (`favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`) — ręczne pole `metadata.icons` w `app/layout.tsx:12-19` wyłącza automatyczną konwencję plikową. | Dwa równoległe systemy ikon, tylko jeden faktycznie używany — mylące przy przyszłej edycji. | Usunąć `app/icon.png`/`app/apple-icon.png` albo usunąć ręczne pole `icons` i polegać na konwencji plikowej — nie oba naraz. | `app/layout.tsx:12-19`, `app/icon.png`, `app/apple-icon.png` |
| P3-2 | P3 | Martwe odwołanie do `/manifest.webmanifest`, który nie istnieje w repo | `middleware.ts:97` i matcher `middleware.ts:144` wymieniają `manifest.webmanifest`; brak `app/manifest.ts` i brak pliku w `public/`. | Nieszkodliwe, ale mylące — sugeruje niedokończoną konfigurację PWA. | Usunąć odwołanie albo dodać plik manifestu, jeśli PWA jest planowane. | `middleware.ts:97, 144` |
| P2-6 | P2 | Niewystarczający kontrast tekstu przypisu pod tabelą porównawczą | Zmierzone Lighthouse: `p.compare-foot` — kontrast 4,28:1 (kolor `#606a5f` na tle `#e4e0d7`), wymagane 4,5:1 dla tekstu 12px. | Tekst przypisu (informacja o cenach konkurencji) jest trudniejszy do odczytania dla części użytkowników — wpływa na jakość/dostępność strony, nie bezpośrednio na ranking. | Pociemnić kolor tekstu albo rozjaśnić tło, żeby osiągnąć min. 4,5:1. | `app/_landing/landing.css:1977-1984` |
| P3-3 | P3 | `Footer` jest `"use client"` tylko dla efektu hover realizowanego przez JS | `src/components/layout/footer.tsx:1` + `onMouseEnter`/`onMouseLeave` w JSX zamiast CSS `:hover`. | Niepotrzebny JS na stronach w pełni statycznych (`/faq`, `/privacy-policy`). | Zastąpić `onMouseEnter`/`onMouseLeave` klasą CSS `:hover`, usunąć `"use client"`. | `src/components/layout/footer.tsx:1` |
| P3-4 | P3 (zdegradowane z P0) | Middleware nie ma jawnego wyjątku dla `/_vercel/*` w `isAppRoute` | Lokalnie (`next start`) `/_vercel/insights/script.js` i `/_vercel/speed-insights/script.js` dostają `307` → `/login`. **Na produkcji (zecca.pl) to się nie potwierdza** — zrzut ekranu z zakładki Sieć pokazuje oba żądania z `200` (z pamięci podręcznej), a panel Vercel Speed Insights pokazuje realne dane o odwiedzinach i Real Experience Score per trasa. Vercel najwyraźniej przechwytuje `/_vercel/*` na poziomie platformy, zanim trafi do middleware. | Brak potwierdzonego wpływu na produkcję. Mimo to warto dodać jawny wyjątek — to tania, zero-ryzykowna poprawka higieniczna, niezależna od (niedokumentowanego) zachowania platformy Vercel. | Dodać `/_vercel/` do wyjątków w `isAppRoute`, analogicznie do `/_next`, przy okazji naprawy P0-1. | `middleware.ts:110-131` |

---

## 3. Problemy według obszarów

### Indeksowanie
- P0-1 (przekierowanie zamiast 404), P1-1 (sitemap vs noindex na `/demo`).
- Pozytyw: `robots.txt` i `sitemap.xml` generowane dynamicznie (`app/robots.ts`, `app/sitemap.ts`), zawierają absolutne adresy `https://zecca.pl/...`, brak wycieku localhost/preview. Test lokalny na zbudowanej aplikacji potwierdza poprawne treści obu plików.
- Trailing slash jest poprawnie kanonizowany: `/faq/` → `308` → `/faq` (brak duplikatów slash/no-slash).
- HTTPS: wymuszany przez `Strict-Transport-Security` (`next.config.ts`); przekierowanie HTTP→HTTPS samo w sobie jest odpowiedzialnością Vercela (wymaga weryfikacji na produkcji — patrz sekcja 8).

### Metadata
- P1-2 (brak canonical na `/faq`, `/privacy-policy`).
- Strona główna ma kompletny zestaw: `title`, `description`, `alternates.canonical`, `openGraph`, `twitter`, `robots` z `googleBot` (`app/page.tsx:13-52`) — dobra jakość, konkretne treści, brak duplikatów między stronami.
- `metadataBase` poprawnie ustawiony w `app/layout.tsx:8` na `https://zecca.pl` — obrazy OG rozwiązują się do adresów absolutnych.
- Root layout nie ustawia domyślnych `openGraph`/`twitter`/`alternates` — nie jest to błędem samym w sobie, ale brak fallbacku ujawnił się właśnie jako P1-2.

### Rendering
- `/`, `/faq`, `/privacy-policy`, `/demo` są `○ (Static)` w wyniku `next build` — potwierdzone w output builda.
- Treść landing page jest budowana server-side jako string HTML (`content.ts`) i wstrzykiwana przez `dangerouslySetInnerHTML` — cała treść tekstowa jest obecna w initial HTML, zero zależności od hydracji dla treści (potwierdzone przez `curl` + parsowanie odpowiedzi serwera, bez wykonywania JS).
- Animowane liczniki (`AnimatedCurrencyMetric`/`AnimatedPercentMetric`, `app/_landing/animated-metric.tsx`) renderują docelową wartość w `<span className="sr-only">` po stronie serwera — dobra praktyka: crawler i czytnik ekranu widzą finalną liczbę, nawet zanim JS wykona animację.
- P1-4 (globalny bundle Sentry na każdej trasie).
- Middleware wykonuje `supabase.auth.getUser()` na **każdym** requeście pasującym do matchera — w tym do `/`, `/faq`, `/privacy-policy`, mimo komentarza w kodzie mówiącego, że strona główna "does no auth work" (`middleware.ts:104-108`). To dodaje serwerowe wywołanie przed zwróceniem w pełni statycznej odpowiedzi. **Wymaga weryfikacji na produkcji** (lokalny `next start` nie pokazuje realnej latencji sieciowej do Supabase — patrz sekcja 8).

### Treść
- Patrz sekcja 7 (rekomendacje dot. treści) poniżej.

### Nagłówki i HTML
- Dokładnie jeden `<h1>` na `/` — potwierdzone. P2-1, P2-2 (spłaszczenie hierarchii).
- Semantyka: `<header>`, `<nav>`, `<main>`, `<section>`, `<footer>` używane poprawnie w `content.ts`/`landing-hero.tsx`.
- Nawigacja to prawdziwe `<a href>` (nie `<div onClick>`) — crawler może po nich przejść.
- FAQ na landing page: `<details>/<summary>` — natywny, dostępny i crawlowalny komponent rozwijany, dobra praktyka (lepsza niż JS-owy akordeon na `div`ach).
- Tabela porównawcza ma poprawne `<th scope="col">`/`<th scope="row">` (`content.ts:324-343`).

### Linkowanie
- P1-3 (`/faq` osierocona względem strony głównej).
- `/privacy-policy` jest linkowana z stopki landing page'u (`copy.ts:409-427`, kolumna "Kontakt").
- Logo w nawigacji linkuje do `#top` (kotwica na tej samej stronie), nie do `/` — nieistotne funkcjonalnie na samej stronie głównej, ale warto pamiętać przy ewentualnym reużyciu tego komponentu nawigacji na innej podstronie w przyszłości.
- `/faq` linkuje do `/dashboard?tour=1` (`app/faq/page.tsx:199-204`) — trasa jest jednocześnie zablokowana w `robots.txt` (`Disallow: /dashboard`), więc zgodny ze standardem crawler i tak jej nie odwiedzi; niskie ryzyko, ale to link donikąd dla anonimowego użytkownika klikającego z ciekawości (P3, brak osobnego wiersza w tabeli ze względu na pomijalny wpływ).

### Schema
- P2-3 (`PreOrder` vs realna dostępność).
- `SoftwareApplication` i `FAQPage` są generowane server-side (te same dane co widoczna treść), połączone przez `@id` w jednym `@graph` (`app/page.tsx:63-101`) — poprawna struktura techniczna.
- `featureList` w schemacie jest zbudowany z tych samych danych co karty funkcji na stronie (`landingCopy.features.items`) — brak rozjazdu treści.
- Brak `Organization`/`Product`/`Offer` osobno — uzasadnione na tym etapie (brak jeszcze publicznego cennika, produkt w becie); nie rekomendujemy dodawania na siłę.

### Obrazy
- Zrzuty ekranu w formacie WebP, z jawnym `width`/`height` (dobre dla CLS), `loading="lazy"` (`content.ts:249-250`) — sekcja jest poniżej header, więc lazy-loading jest tu prawidłowy wybór, nie błąd.
- Alt teksty są opisowe i kontekstowe (np. "Pulpit natywnej aplikacji Zecca na macOS"), nie nazwami plików.
- Logo w nawigacji/stopce ma `alt=""` — poprawne, bo obok jest tekstowy wordmark "Zecca" niosący tę samą informację.
- Brak użycia `next/image` dla zrzutów ekranu landing page'u — obrazy są statycznymi `<img>` w stringu HTML (bo cała sekcja jest budowana jako string, nie JSX). Oznacza to brak automatycznego `srcset`/responsywnych rozmiarów — te same duże pliki (do ~2560×1640 px, do ~163 KB) są serwowane niezależnie od szerokości viewportu. Nie są to jednak obrazy LCP (są poniżej header), więc wpływ na Core Web Vitals jest ograniczony, głównie kosztowy dla transferu danych na mobile.

### Wydajność

**Potwierdzone pomiarem (Lighthouse 12, build produkcyjny, `next start`, `http://127.0.0.1:3100/`):**

| Metryka | Mobile | Desktop |
| --- | --- | --- |
| Performance | 85/100 | 98/100 |
| Accessibility | 97/100 | 97/100 |
| Best Practices | 92/100 | 92/100 |
| SEO | 100/100 | 100/100 |
| LCP | 4,1 s | 1,1 s |
| TBT | 100 ms | 0 ms |
| CLS | 0 | 0 |
| Speed Index | 2,9 s | 0,4 s |
| Waga strony (`total-byte-weight`) | 290 KiB | — |

- Największy pojedynczy zasób na stronie to chunk `5857-ec7c608298172d4e.js` — **129 KB, ~44% całkowitej wagi strony**, z czego Lighthouse (`unused-javascript`) szacuje **68 KB jako niewykorzystane**. To ten sam chunk zdominowany przez Sentry, zidentyfikowany wcześniej analizą kodu (P1-4) — teraz potwierdzony pomiarem. `bootup-time` pokazuje, że ten chunk zużywa ~331 ms czasu wykonania skryptu na głównym wątku (drugie miejsce po samym dokumencie, 362 ms).
- CLS = 0 na obu profilach — brak przesunięć layoutu, potwierdza poprawne `width`/`height` na obrazach i brak web fontów.
- Mobilny LCP 4,1 s jest w strefie "wymaga poprawy" (próg "dobry" Google to poniżej 2,5 s); desktopowy LCP 1,1 s jest bardzo dobry. Różnica wynika głównie z symulowanego throttlingu sieci/CPU w profilu mobilnym Lighthouse, nie z konkretnego ciężkiego obrazu (LCP nie jest obrazem — CLS=0 i brak `render-blocking-resources` w raporcie sugerują, że to raczej łączny czas do wykonania JS/CSS niż jeden winowajca).
- Brak jakichkolwiek web fontów — czysty stos systemowy (`--inv-font-system`, `landing.css`) — brak blokującego renderowanie żądania fontu, brak CLS z podmiany fontu. Mocna strona, potwierdzona przez CLS=0.

**Wynikające z analizy kodu:**
- P1-4 (Sentry na każdej trasie) — teraz dodatkowo potwierdzone pomiarem powyżej.
- CSS landing page'u to jeden plik `landing.css` (2826 linii) ładowany dla całej strony `/` — nie jest per-sekcja code-split, ale to typowy, akceptowalny kompromis dla pojedynczej, samodzielnej strony marketingowej.

**Wymaga weryfikacji na produkcji:**
- `next.config.ts` nie konfiguruje kompresji jawnie, ale `next start` lokalnie serwuje `Content-Encoding: gzip` domyślnie — zachowanie na Vercelu (który ma własną warstwę kompresji/CDN) wymaga weryfikacji na produkcji.
- Granularne CWV z pola (P75 FCP/LCP/INP/CLS/TTFB w panelu Speed Insights) — obecnie brak danych na tych wykresach; prawdopodobnie kwestia zbyt małego wolumenu ruchu (71 wizyt/7 dni), nie błędu konfiguracji (pakiet jest aktualny). Do ponownego sprawdzenia, gdy ruch wzrośnie.

### Dostępność (wpływ na jakość i konwersję, nie czynnik rankingowy wprost)
- Lighthouse (oba profile) zgłasza jeden konkretny, zmierzony błąd kontrastu: `p.compare-foot` (przypis pod tabelą porównawczą) ma kontrast **4,28:1** przy wymaganych **4,5:1** dla tekstu 12px (kolor tekstu `#606a5f` na tle `#e4e0d7`) — tuż poniżej progu WCAG AA. Lokalizacja stylu: `app/_landing/landing.css:1977-1984` (`color: var(--subtle)`).
- Poza tym jednym elementem accessibility jest mocną stroną strony: liczne poprawne ARIA (`role="tablist"`, `role="radiogroup"`, `aria-live`, `aria-selected`), semantyczne `<details>/<summary>` dla FAQ, `prefers-reduced-motion` respektowane, wynik Lighthouse Accessibility 97/100 na obu profilach.

### Mobile
- Viewport meta poprawny (`width=device-width, initial-scale=1`).
- Zrzut ekranu w widoku mobilnym (375×812): brak poziomego przewijania, czytelna typografia, menu hamburgerowe z `aria-expanded`/`aria-controls` (`content.ts:142-144`, `landing-interactions.tsx:190-222`).
- Tabela porównawcza ma wrapper `.compare-scroll` (przewijalny poziomo) zamiast łamania layoutu na wąskich ekranach.

### Lokalizację
- Nie dotyczy w praktyce — serwis świadomie jednojęzyczny (`lang="pl"`, treść i FAQ po polsku, ceny w PLN, dane z NBP/GUS). Brak hreflang jest tu poprawnym stanem, nie luką.

### Analitykę
- P1-5 (brak pomiaru konwersji).
- Vercel Analytics + Speed Insights zainstalowane w `app/layout.tsx:4-5, 31-32` — działają bez cookies, bez potrzeby bannera zgody.
- TelemetryDeck jest importowany wyłącznie w trasach `app/(app)/*` (dashboard, transactions, earnings, positions, settings) — potwierdzone grepem — **nigdy** na stronach marketingowych, zgodnie z deklaracją w polityce prywatności.
- Brak weryfikacji Google Search Console w kodzie (ani meta tag, ani plik weryfikacyjny) — weryfikacja została właśnie zrobiona poza kodem (domena dopiero co dodana do GSC); dane o indeksowaniu pojawią się z opóźnieniem (sekcja 8).

### Pozostałe
- CSP: enforced w produkcji, Report-Only w dev (`middleware.ts:26-40, 48-53`) — świadoma, udokumentowana decyzja o `'unsafe-inline'` zamiast nonce (bo część stron jest statycznie prerenderowana). Nagłówki bezpieczeństwa (`next.config.ts:5-19`) kompletne: HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy.
- P2-4 (404 kieruje do `/dashboard`).
- P3-1, P3-2, P3-3.

---

## 4. Quick wins

Poniższe da się wdrożyć w mniej niż godzinę, przy niskim ryzyku regresji:

1. **Dodaj wyjątek dla `/_vercel/` w `middleware.ts`** (`isAppRoute`) — higienicznie, mimo że problem nie potwierdza się na produkcji (P3-4) — jedna linijka, zero ryzyka.
2. **Dodaj `alternates.canonical`** do `metadata` w `app/faq/page.tsx` i `app/privacy-policy/page.tsx` (P1-2).
3. **Usuń `/demo` z `app/sitemap.ts`**, skoro strona ma zostać `noindex` (P1-1).
4. **Dodaj link "FAQ" do nawigacji lub stopki landing page'u** w `app/_landing/copy.ts` (P1-3).
5. **Zmień `availability` w JSON-LD** z `PreOrder` na `InStock` w `app/page.tsx:85` (P2-3).
6. **Popraw literówkę "Zekki" → "Zecci"** w `app/_landing/copy.ts:342` (P2-5).
7. **Zmień tag pytań FAQ z `h2` na `h3`** w `app/faq/page.tsx:326` (P2-2).
8. **Dodaj link do `/` na stronie 404** obok/zamiast linku do `/dashboard` w `app/not-found.tsx` (P2-4).
9. **Pociemnij kolor `.compare-foot`** do min. 4,5:1 kontrastu w `app/_landing/landing.css:1977-1984` (P2-6).
10. **Podłącz `zecca:beta-waitlist-signup` do `track()` z `@vercel/analytics`** w `landing-interactions.tsx` (P1-5, częściowo — pełne pokrycie zdarzeń to już zadanie większe).

---

## 5. Backlog wdrożeniowy

| Kolejność | Zadanie | Priorytet | Trudność | Zależności | Kryterium akceptacji |
| --- | --- | --- | --- | --- | --- |
| 1 | Napraw zachowanie middleware dla nieznanych ścieżek — nieznane URL-e mają zwracać natywne 404 Next.js zamiast przekierowania do `/login` (przy okazji dodać też higieniczny wyjątek dla `/_vercel/*`, P3-4) | P0 | M | brak | `curl -I` na dowolnej nieistniejącej ścieżce zwraca `404`, nie `307` do `/login` |
| 2 | Usuń `/demo` z sitemapy albo usuń jego `noindex` | P1 | XS | brak | sitemap.xml i meta robots na `/demo` są ze sobą spójne |
| 3 | Dodaj `alternates.canonical` na `/faq` i `/privacy-policy` | P1 | XS | brak | `<link rel="canonical">` obecny w HTML obu stron |
| 4 | Dodaj link do `/faq` w nawigacji/stopce landing page'u | P1 | XS | brak | `/faq` osiągalna linkiem z `/` |
| 5 | Zmierz zużycie JS z Sentry na trasach marketingowych i zdecyduj o strategii (mniejszy `tracesSampleRate` / leniwe ładowanie / akceptacja kosztu) | P1 | L | dane z produkcji (RUM/Speed Insights, wymaga wcześniejszej naprawy zadania 1) | Udokumentowana decyzja + (opcjonalnie) zmierzony spadek First Load JS na `/` (obecnie 129 KB w chunku `5857-*.js` wg Lighthouse) |
| 6 | Podłącz pomiar konwersji CTA (zapis do bety, "Zobacz demo", "Załóż konto") | P1 | S | brak | Zdarzenia widoczne w Vercel Analytics / wybranym narzędziu |
| 7 | Zmień `PreOrder` na `InStock` w JSON-LD | P2 | XS | brak | Walidator danych strukturalnych (Rich Results Test) nie zgłasza sprzeczności |
| 8 | Popraw hierarchię nagłówków (trust band, pytania FAQ) | P2 | S | brak | Outline nagłówków strony ma jeden H1, logiczne zagnieżdżenie H2→H3 |
| 9 | Zmień link 404 z `/dashboard` na `/` dla niezalogowanych | P2 | XS | brak | Kliknięcie CTA na 404 jako anonimowy użytkownik prowadzi na stronę główną |
| 10 | Popraw literówkę "Zekki" | P2 | XS | brak | Poprawiona pisownia w treści i JSON-LD |
| 11 | Popraw kontrast `.compare-foot` do min. 4,5:1 | P2 | XS | brak | Lighthouse `color-contrast` przechodzi (score 1) dla tego elementu |
| 12 | Uporządkuj system ikon (usuń nieużywane `app/icon.png`/`app/apple-icon.png` albo podłącz je i usuń ręczne `metadata.icons`) | P3 | S | brak | Jeden spójny system ikon, brak martwych plików |
| 13 | Usuń martwe odwołanie do `manifest.webmanifest` w middleware (lub dodaj realny manifest) | P3 | XS | brak | Brak odwołań do nieistniejącego zasobu |
| 14 | Zamień `Footer` z `"use client"` na komponent serwerowy z CSS `:hover` | P3 | XS | brak | Strony `/faq`, `/privacy-policy` nie ładują JS tylko dla hovera stopki |

---

## 6. Proponowana architektura SEO

Obecna strona to pojedynczy, mocny landing page pokrywający wiele intencji naraz (ogólne śledzenie portfela, IKE/IKZE, obligacje, porównanie z konkurencją). To rozsądne rozwiązanie na etapie bety — **nie rekomendujemy rozbijania go teraz na wiele stron pod pojedyncze frazy**. Poniżej propozycje, które mają uzasadnienie w realnej intencji wyszukiwania i istniejącej już treści, do rozważenia dopiero **po** naprawieniu problemów P0/P1 i po zakończeniu bety (gdy model cenowy/dostępność są ustabilizowane):

| Propozycja | Intencja użytkownika | Temat strony | Miejsce w lejku | Linkowanie z landing page'u |
| --- | --- | --- | --- | --- |
| Rozbudowa `/faq` w pełnoprawne centrum wiedzy o metrykach | "co to jest XIRR", "jak liczyć realny zwrot z inwestycji" — informacyjne, długi ogon | Wyjaśnienia metryk inwestycyjnych (już częściowo istnieją) | Top/middle funnel | Link z nawigacji (patrz Quick win #3) + linki kontekstowe z opisów funkcji na `/` |
| Strona `/vs/myfund` (lub podobna, dedykowana) | "Zecca vs MyFund", "alternatywa dla MyFund" — porównawcze, bottom funnel | Rozszerzenie istniejącej tabeli porównawczej z `/` do samodzielnej, głębszej strony | Bottom funnel (decyzja) | Link z sekcji porównania na `/` ("zobacz pełne porównanie") |
| Strona funkcji: "Śledzenie IKE i IKZE" | "jak śledzić IKE i IKZE", "aplikacja do kont emerytalnych" | Pogłębienie sekcji "Dla polskiego inwestora" z `/` | Middle funnel | Link z karty "Konta emerytalne" na `/` |
| Strona funkcji: "Obligacje skarbowe detaliczne (ROD, EDO, COI...)" | "jak liczyć odsetki od obligacji skarbowych", "kalkulator obligacji ROD/EDO" | Pogłębienie karty "Obligacje skarbowe detaliczne" | Middle funnel | Link z karty "Obligacje skarbowe detaliczne" na `/` |
| Strona cenowa (dopiero po zakończeniu bety i ustaleniu modelu cenowego) | "ile kosztuje Zecca", "cennik aplikacji do portfela" | Jasny, samodzielny cennik zamiast tylko wzmianki "bezpłatna w becie" | Bottom funnel | Link z nawigacji, gdy model cenowy będzie znany |

Nie rekomendujemy: stron doorway pod pojedyncze nazwy obligacji/instrumentów, automatycznie generowanych stron "Zecca vs [dowolny konkurent]" bez realnej treści porównawczej, ani mnożenia cienkich podstron przed ukończeniem bety.

---

## 7. Rekomendacje dotyczące treści

**Obecny H1** ("Wszystkie Twoje inwestycje w jednym miejscu") — ocena: dobry, jasny, skupiony na korzyści konsolidacji portfela. Nie zawiera nazwy marki ani najsilniejszego wyróżnika (IKE/IKZE/polski rynek), ale to świadomy wybór — marka i wyróżnik już są w `<title>` i w eyebrow tuż nad H1 ("Natywnie na macOS i iOS oraz przez przeglądarkę"). Nie wymaga pilnej zmiany.

**Kierunek ewentualnej zmiany H1** (opcjonalnie, do przetestowania, nie pilne): wariant mocniej sygnalizujący polską specyfikę wprost w H1, np. akcent na "portfel, IKE i IKZE w jednym miejscu" — do przetestowania A/B, nie do wdrożenia na ślepo.

**Sekcja hero** — ocena: mocna. Lede konkretnie wymienia klasy aktywów, `hero.sources` ("Kursy NBP · Inflacja GUS · XIRR / TWR") działa jak wiarygodny "stempel" metodologiczny tuż pod nagłówkiem, a podgląd produktu z realnymi (choć demonstracyjnymi) liczbami jest lepszy niż generyczny obrazek.

**Brakujące/warte wzmocnienia sekcje:**
- Sekcja hero ma **dwa konkurujące CTA** o różnej sile zobowiązania: "Zobacz demo" (niskie zobowiązanie) i "Dołącz do listy beta" (zapis na later), a w nawigacji dodatkowo "Załóż konto"/"Zaloguj się" (od razu rejestracja). To dobra drabinka konwersji, ale warto jawnie zdecydować, które CTA jest "głównym" — obecnie strona nie sygnalizuje jasno, czy oczekiwaną akcją jest zapis na listę, czy bezpośrednia rejestracja, co dotyczy przejrzystości UX/konwersji bardziej niż samego SEO.
- FAQ na landing page (7 pytań) nie pokrywa pytań o **eksport danych przy rezygnacji/usunięciu konta** i o **różnice względem natywnych aplikacji macOS/iOS w zakresie funkcji** (web jest opisana jako "podgląd" w niektórych miejscach, a jako pełnoprawna platforma w innych — np. `copy.ts:146-156` sugeruje pełny dostęp, FAQ landing (`copy.ts:337-339`) mówi "wersja webowa do podglądu portfela"). Warto ujednolicić komunikat o zakresie funkcji web vs. natywnych, żeby nie tworzyć niespójnych oczekiwań.
- Brak jawnej odpowiedzi na obiekcję "co się stanie z moimi danymi/kosztem, gdy beta się skończy i pojawi się cennik" poza ogólnikowym "poinformujemy z wyprzedzeniem" — to częsta obiekcja przy produktach finansowych w becie, warto rozważyć rozbudowanie.

**Tematy warte osobnych podstron** (patrz też sekcja 6): metryki inwestycyjne (już mają dobry fundament w `/faq`), IKE/IKZE, obligacje skarbowe detaliczne, porównanie z MyFund.

---

## 8. Kwestie wymagające danych zewnętrznych

Poniższego nie da się wiarygodnie potwierdzić z samego repozytorium — wymaga dostępu do produkcji lub narzędzi zewnętrznych:

| Kwestia | Jakie dane pozyskać | Jaką decyzję to umożliwi |
| --- | --- | --- |
| ~~Czy `/_vercel/*` jest blokowane na produkcji~~ | **Rozstrzygnięte w trakcie audytu** — zrzuty ekranu z `zecca.pl` (Sieć: oba żądania 200; panel Speed Insights: realne dane per trasa) potwierdzają, że **nie jest** blokowane. Patrz P3-4. | — |
| Realny TTFB strony głównej na produkcji (Vercel) | Pomiar TTFB z Vercel Speed Insights / WebPageTest na `https://zecca.pl` | Potwierdzi (lub obali) hipotezę, że wywołanie Supabase w middleware (P1-4 kontekst) realnie spowalnia statyczną stronę główną w warunkach produkcyjnych (Edge/Fluid Compute na Vercelu może zachowywać się inaczej niż `next start` lokalnie) |
| Rzeczywiste granularne Core Web Vitals użytkowników (P75 LCP, INP, CLS) z pola (RUM) | Dane z Vercel Speed Insights, po nagromadzeniu większego wolumenu ruchu (obecnie 71 wizyt/7 dni to za mało dla wykresów czasowych) | Potwierdzi, czy zmierzony w tym audycie mobilny LCP 4,1 s (laboratorium/Lighthouse) odpowiada realnemu doświadczeniu użytkowników w polu |
| Status weryfikacji w Google Search Console | **W trakcie** — domena została właśnie dodana do GSC (wg informacji z rozmowy); dane o indeksowaniu i błędach pojawiają się zwykle z kilkudniowym–kilkutygodniowym opóźnieniem po weryfikacji. Wróć do zakładki "Strony" i "Sitemapy" w GSC za 1–2 tygodnie. | Potwierdzi, czy problem P0-1 (przekierowania zamiast 404) już generuje zgłoszenia w GSC, i czy sitemapa/robots.txt zostały poprawnie odczytane |
| Profil linków zewnętrznych (backlinki) | Google Search Console → Linki, lub narzędzie typu Ahrefs/Semrush | Ujawni, czy jakiekolwiek zewnętrzne linki wskazują na nieistniejące już adresy — bezpośrednio ocenia skalę szkody z P0-1 |
| Wolumeny i trudność fraz kluczowych ("śledzenie inwestycji", "IKE IKZE tracker" itd.) | Narzędzie SEO (Ahrefs/Semrush/Google Keyword Planner) — nie mam dostępu | Priorytetyzacja, które przyszłe podstrony z sekcji 6 warto budować najpierw |
| Aktualne pozycje w wynikach wyszukiwania | Google Search Console → Wyniki wyszukiwania | Baseline do pomiaru skuteczności wdrożonych rekomendacji |
| CTR w wynikach wyszukiwania dla istniejących title/description | Google Search Console → Wyniki wyszukiwania (kolumna CTR) | Ocena, czy obecne title/description realnie zachęcają do kliknięcia, czy wymagają iteracji |
| Zachowanie użytkowników po wejściu z organicznego ruchu | Google Search Console + Vercel Analytics (po wdrożeniu pomiaru konwersji z P1-5) | Ocena, czy ruch organiczny faktycznie konwertuje na zapisy do bety/rejestracje |
| Realne działanie przekierowania HTTP→HTTPS i ewentualnego www→non-www | Test na `https://zecca.pl` i `http://zecca.pl` (konfiguracja Vercela, nie kodu repo) | Potwierdzenie, że warstwa platformy (Vercel) poprawnie wymusza HTTPS i kanoniczną domenę |

---

## 5 działań do wykonania jako pierwsze

1. **Napraw middleware: nieznane adresy URL mają zwracać 404 zamiast przekierowania do `/login`** (P0-1, `middleware.ts:110-137`) — jedyny problem P0 w audycie. Przy okazji dodaj też higieniczny wyjątek dla `/_vercel/*` (P3-4).
2. **Usuń `/demo` z sitemapy** albo usuń jego `noindex`, żeby sitemap i meta robots były spójne (P1-1).
3. **Dodaj `canonical` do `/faq` i `/privacy-policy`** oraz **link do `/faq` w nawigacji/stopce** — dwie proste zmiany usuwające realny brak sygnału i osierocenie ważnej strony treściowej (P1-2, P1-3).
4. **Podłącz istniejący (ale nieużywany) hak zdarzenia zapisu do bety do pomiaru konwersji**, żeby jakiekolwiek dalsze działania SEO dało się w ogóle ocenić — o ile punkt 1 nie zostanie naprawiony, i tak nic się nie zmierzy (P1-5).
5. **Zmierz realny wpływ globalnego bundle'a Sentry na strony marketingowe na produkcji** (obecnie zmierzone w Lighthouse: 129 KB / ~44% wagi strony, ~331 ms czasu wykonania JS) i podejmij świadomą decyzję o strategii ładowania dla tras `/`, `/faq`, `/privacy-policy`, `/demo` (P1-4).
