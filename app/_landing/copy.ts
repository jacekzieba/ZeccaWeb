// ─────────────────────────────────────────────────────────────────────────────
//  TEKSTY LANDING PAGE  (zecca.pl)
//
//  To jest JEDYNE miejsce, w którym edytujesz treść strony. Zmień dowolny napis
//  poniżej i odśwież stronę — układ, ikony i style zbudują się z tych danych
//  automatycznie (patrz content.ts, którego NIE musisz ruszać).
//
//  Zasady edycji:
//   • Możesz używać <b>…</b> (pogrubienie) i <em>…</em> (kursywa, zielony akcent).
//   • &nbsp; to twarda spacja (nie złamie wiersza w tym miejscu).
//   • Nie zmieniaj nazw pól (np. `title`, `href`) — tylko ich wartości w cudzysłowie.
//   • Nie usuwaj/nie dodawaj elementów list bez potrzeby — liczba kart funkcji,
//     pól FAQ itd. jest dopasowana do ikon. Edycja samych tekstów jest bezpieczna.
// ─────────────────────────────────────────────────────────────────────────────

import { INVESTMENT_DISCLAIMER } from "@/lib/investment-disclaimer";

export const landingCopy = {
  // ── Górna nawigacja ───────────────────────────────────────────────────────
  nav: {
    links: [
      { label: "Funkcje", href: "#funkcje" },
      { label: "Aplikacje", href: "#aplikacje" },
      { label: "Kontakt", href: "mailto:kontakt@jacekzieba.pl" },
      { label: "Zobacz demo", href: "/demo" },
      { label: "Zaloguj się", href: "/login" },
      { label: "Załóż konto", href: "/register" },
    ],
  },

  // ── Sekcja główna (hero) ──────────────────────────────────────────────────
  hero: {
    betaBanner: "",
    eyebrow: "macOS · iOS · przeglądarka",
    title: "Każda liczba<br>ma źródło.",
    lede: "Zecca zbiera w jednym miejscu Twoje IKE, IKZE, akcje, ETF-y, obligacje skarbowe, lokaty i gotówkę i odtwarza wartość portfela od pierwszej transakcji. Kursy z NBP, inflacja z GUS, wynik liczony na Twoim urządzeniu.",
    ctaPrimary: "Załóż konto",
    ctaPrimaryHref: "/register",
    ctaDemo: "Zobacz demo",
    ctaDemoHref: "/demo",
    // Realne wejścia silnika — krótki „stempel" pod ledem, nie ozdoba.
    sources: ["Kursy NBP", "Inflacja GUS", "XIRR / TWR"],
    // Rejestr: wiersz = jedna wartość z portfela demo plus cecha jej źródła.
    // Reguła kierunku: na szynie stoi wyłącznie to, co da się ocechować.
    register: {
      eyebrow: "Źródła danych",
      title: "Nie szacujemy.<br>Odtwarzamy.",
      note: "Liczby pochodzą z portfela demonstracyjnego — te same przeliczenia, które Zecca robi na Twoich danych.",
      rows: [
        { what: "Wartość portfela", source: "Kurs NBP", detail: "tabela A" },
        { what: "Wynik realny po inflacji", source: "Inflacja GUS", detail: "wskaźnik CPI" },
        { what: "Stopa zwrotu XIRR", source: "Liczone lokalnie", detail: "na Twoim urządzeniu" },
        { what: "Zysk niezrealizowany", source: "FIFO", detail: "wg kosztu nabycia" },
        { what: "Kapitał wpłacony", source: "Transakcje", detail: "od pierwszej wpłaty" },
      ],
    },
    proof:
      "Śledź główny portfel oraz konta&nbsp;<b>IKE</b> i <b>IKZE.</b>",
    storeBadges: [
      { top: "Pobierz w", main: "App Store", soon: "wkrótce" },
      { top: "Pobierz w", main: "Mac App Store", soon: "Wkrótce" },
    ],
    note: "Synchronizuj dane między urządzeniami lub korzystaj z trybu offline.",
    imageAlt: "Zecca na macOS — raporty i statystyki",
    trust: [
      { title: "Synchronizacja szyfrowana end-to-end", desc: "Włącz ją, gdy chcesz — dane szyfrujesz na swoim urządzeniu, zanim trafią na serwer" },
      { title: "Tryb offline albo synchronizacja online", desc: "Ty decydujesz, czy i jak synchronizować dane między urządzeniami" },
      { title: "Aktualne kursy walut, akcji, ETF-ów i obligacji", desc: "Kursy walut z tabel NBP, także historyczne" },
      { title: "Inflacja CPI z GUS", desc: "Oficjalne dane GUS o inflacji. Na ich podstawie Zecca liczy realny wynik inwestycji" },
    ],
  },

  // ── P1 · Jak działa ──────────────────────────────────────────────────────
  howItWorks: {
    eyebrow: "Obraz Twojego majątku",
    title: "Wszystkie Twoje inwestycje —<br>w liczbach i na wykresach.",
    desc: "Zecca nie zgaduje portfela na podstawie jednego salda. Odtwarza go z transakcji, wpłat, wycen i oficjalnych danych.",
    steps: [
      {
        label: "01",
        title: "Wpisujesz transakcje ręcznie albo importujesz pliki od brokera",
        desc: "Możesz cofnąć się do pierwszej obligacji, lokaty albo ETF-u.",
        meta: "Transakcje · import · aktywa ręczne",
      },
      {
        label: "02",
        title: "Zecca przelicza transakcje po kursach, dolicza odsetki i dywidendy, a potem liczy wynik realny po inflacji.",
        desc: "Kursy z tabel NBP, inflacja z GUS, koszt nabycia liczony metodą FIFO.",
        meta: "NBP · GUS · FIFO · XIRR",
      },
      {
        label: "03",
        title: "Wszystko w jednym miejscu",
        desc: "Koniec z logowaniem się do kilku serwisów, żeby zobaczyć IKE, IKZE, obligacje i resztę aktywów. Koniec z Excelem.",
        meta: "Portfele · alokacja · historia",
      },
    ],
  },

  // ── 01 · Funkcje (9 kart, w tej samej kolejności co ikony) ────────────────
  features: {
    eyebrow: "Funkcje",
    title: "Jeden spokojny widok na cały Twój majątek.",
    desc: "Obligacja kupiona lata temu i dzisiejszy ETF trafiają do jednej historii wartości, którą Zecca odtwarza od początku.",
    items: [
      {
        title: "Wiele portfeli i grup",
        desc: "IKE, IKZE, konto główne, grupy i subportfele. Widok łączny bez dublowania transakcji.",
        tags: ["IKE", "IKZE", "Grupy"],
      },
      {
        title: "Statystyki jak u profesjonalisty",
        desc: "MWR / XIRR, TWR, CAGR, max drawdown, zysk zrealizowany i niezrealizowany, dywidendy i odsetki.",
        tags: ["XIRR", "TWR", "CAGR"],
      },
      {
        title: "Wynik realny po inflacji",
        desc: "Dane CPI z GUS pokazują, ile naprawdę zarobiłeś: nominalnie i po inflacji, rok po roku.",
        tags: ["GUS", "CPI"],
      },
      {
        title: "Historia od pierwszej transakcji",
        desc: "Dodaj transakcje dowolnie wstecz, np. zakup ROD z 2019 r. Zecca odtworzy całą historię wartości portfela.",
        tags: ["FIFO"],
      },
      {
        title: "Moduł Zarobki",
        desc: "Osobny widok dochodów i obciążeń: wynagrodzenia, UoP/B2B, podsumowania miesięczne, średnie i najlepszy miesiąc. Inwestycje widzisz obok prywatnego cashflow.",
        tags: ["CASHFLOW", "UoP / B2B"],
      },
      {
        title: "Import od brokerów",
        desc: "Wczytaj historię z plików XLS/XLSX. Gotowe importery dla XTB i PKO Obligacje. Przed zapisem widzisz podgląd, a Zecca wykrywa duplikaty i dopasowuje instrumenty.",
        tags: ["XLSX", "PKO Obligacje"],
      },
      {
        title: "Eksport i kopie",
        desc: "Eksportuj do CSV transakcje, historię wartości, przychody i pozycje: całość albo jeden portfel. Do tego lokalna kopia zapasowa w JSON.",
        tags: ["CSV", "backup JSON"],
      },
      {
        title: "Konto i synchronizacja",
        desc: "Korzystaj bez konta albo włącz synchronizację przez iCloud lub prywatną, szyfrowaną Zecca Sync. Logowanie e-mailem, przez Apple lub Google, blokada Face&nbsp;ID / Touch&nbsp;ID.",
        tags: ["E2E", "Zecca Sync", "Face ID"],
      },
    ],
  },

  // ── Podgląd na danych demo ────────────────────────────────────────────────
  preview: {
    eyebrow: "Portfel demonstracyjny",
    title: "Zobacz to na<br>prawdziwych liczbach.",
    desc: "Te same przeliczenia, które Zecca wykonuje na Twoich danych. Bez konta, bez logowania, bez wysyłania czegokolwiek na serwer.",
  },

  // ── Klasy aktywów (własna sekcja z pierścieniem alokacji) ─────────────────
  assetClasses: {
    eyebrow: "Klasy aktywów",
    title: "Wszystko, co masz<br>w jednym rejestrze.",
    desc: "Akcje i ETF-y obok obligacji skarbowych, lokat, gotówki i krypto. Do tego aktywa, których żaden broker Ci nie policzy.",
    note: "Zecca obsługuje wszystkie te klasy. Portfel demonstracyjny ma akurat trzy z nich, więc tylko je pokazuje pierścień.",
    rows: [
      { name: "Akcje i ETF-y", detail: "wycena po kursie zamknięcia" },
      { name: "Obligacje skarbowe", detail: "ROD · EDO · COI · TOS · ROR · DOR" },
      { name: "Kryptowaluty", detail: "wycena dzienna" },
      { name: "Lokaty", detail: "odsetki i podatek Belki" },
      { name: "Gotówka", detail: "wielowalutowo, po kursach NBP" },
      { name: "Aktywa ręczne", detail: "nieruchomości, metale, wino, sztuka" },
    ],
  },

  // ── Prywatność (pełnoekranowa przerwa przed zapisami) ─────────────────────
  privacy: {
    eyebrow: "Prywatność",
    title: "Wynik liczy się u&nbsp;Ciebie<br>i&nbsp;u Ciebie <em>zostaje.</em>",
    desc: "Zecca przelicza portfel na Twoim urządzeniu. Jeśli włączysz synchronizację, na serwer trafia tylko szyfrogram. Klucz do niego powstaje z Twojego hasła na Twoim urządzeniu i nigdzie go nie przechowujemy. Nie widzimy Twoich pozycji, wartości ani transakcji.",
    marks: ["Szyfrowanie end-to-end", "Klucz tworzony na urządzeniu", "Na serwerze tylko szyfrogram"],
  },

  // ── Showcase platform ─────────────────────────────────────────────────────
  showcase: {
    eyebrow: "Jedno Zecca · trzy platformy",
    title: "Ten sam portfel na Macu, iPhonie i w przeglądarce.",
    desc: "Na Macu pracujesz z pełnymi raportami, w przeglądarce otwierasz portfel bez instalacji, a na iPhonie sprawdzasz najważniejsze liczby. Zmienia się tylko ekran. Sposób liczenia i kontekst zostają te same.",
    desktop: [
      {
        id: "web",
        tab: "Web",
        kicker: "Web · bez instalacji",
        title: "Twój portfel także w przeglądarce.",
        desc: "W przeglądarce otworzysz te same portfele, raporty i wykresy na dowolnym komputerze. Dane i przeliczenia są takie same jak w aplikacjach Zecca.",
        points: [
          "Działa w aktualnej przeglądarce na komputerze",
          "Te same portfele, metryki i historia inwestycji",
          "Układ dopasowuje się do szerokości ekranu",
        ],
        imageAlt: "Zecca w przeglądarce — raporty i alokacja portfela",
      },
      {
        id: "macos",
        tab: "macOS",
        kicker: "macOS · natywna aplikacja",
        title: "Pełny warsztat inwestora na dużym ekranie.",
        desc: "Raporty, alokację, wyniki realne i historię portfeli ułożyliśmy tak, żeby z ogólnego obrazu dało się przejść do szczegółów bez gubienia kontekstu.",
        points: [
          "Rozbudowane raporty i statystyki w jednym widoku",
          "Wygodna praca z wieloma portfelami i długą historią",
          "Natywny interfejs dopasowany do pracy na Macu",
        ],
        imageAlt: "Zecca na macOS — raporty, statystyki i alokacja portfela",
      },
    ],
    ios: {
      id: "ios",
      tab: "iOS",
      kicker: "iOS · dashboard w kieszeni",
      title: "Portfel pod ręką, kiedy chcesz go sprawdzić.",
      desc: "Wersja na iPhone'a nie upycha całego desktopu. Pokazuje wartość, zmianę, wynik, dywidendy i alokację w kolejności, w jakiej najczęściej się je sprawdza.",
      points: [
        "Wartość i historia portfela w zakresach 1M–MAX",
        "Wynik, dywidendy i alokacja na jednym ekranie",
        "Natywna nawigacja wygodna do obsługi kciukiem",
      ],
      imageAlt: "Zecca na iOS — mobilny dashboard portfela",
    },
  },

  // ── 02 · Dla polskiego inwestora (6 kafli) ────────────────────────────────
  investor: {
    eyebrow: "Dla polskiego inwestora",
    title: "Zbudowane pod polskie realia.",
    desc: "To nie kalka zagranicznego trackera. IKE i IKZE, detaliczne obligacje skarbowe, kursy NBP i inflacja GUS są tu na pierwszym planie.",
    cells: [
      {
        badge: "IKE / IKZE",
        title: "Konta emerytalne",
        desc: "IKE i IKZE jako osobne portfele, z widokiem łącznym i podziałem na konta opodatkowane i emerytalne.",
      },
      {
        badge: "OBLIGACJE",
        title: "Obligacje skarbowe detaliczne",
        desc: "ROD, EDO, COI, TOS, ROR, DOR. Odsetki narastają według serii, inflacji i marży. Zecca uwzględnia kapitalizację i wykup.",
      },
      {
        badge: "NBP",
        title: "Kursy walut z NBP",
        desc: "Aktywa w walutach obcych i złoto Zecca wycenia po oficjalnych tabelach NBP: z wybranego dnia albo z ostatniej publikacji.",
      },
      {
        badge: "GUS",
        title: "Inflacja z GUS",
        desc: "Wskaźnik CPI z oficjalnych danych GUS. Na nim opiera się wynik realny po inflacji.",
      },
      {
        badge: "LOKATY",
        title: "Lokaty z podatkiem Belki",
        desc: "Harmonogram narastania odsetek, podatek od zysków kapitałowych i przedterminowe zamknięcie.",
      },
      {
        badge: "PLN / EUR / USD",
        title: "Bazowo w złotówkach",
        desc: "Waluta bazowa PLN i osobna waluta wyświetlania: PLN, EUR lub USD. Pozycje zagraniczne Zecca przelicza po kursach NBP, także historycznych.",
      },
    ],
  },

  // ── 03 · Porównanie (Zecca vs MyFund vs arkusz) ───────────────────────────

  // ── 04 · FAQ (`open: true` = rozwinięte na starcie) ───────────────────────
  faq: {
    eyebrow: "",
    title: "Częste pytania.",
    items: [
      {
        q: "Czy Zecca jest darmowa?",
        a: "Tak. W czasie bety Zecca jest <b>bezpłatna</b>. O ewentualnym cenniku poinformujemy z wyprzedzeniem, zanim beta się zakończy.",
      },
      {
        q: "Na jakich urządzeniach działa?",
        a: "Natywnie na <b>macOS</b> i <b>iOS</b>. Jest też wersja webowa do podglądu portfela w przeglądarce. Wszystkie korzystają z tego samego, szyfrowanego modelu danych.",
      },
      {
        q: "To beta. Czy moje dane są bezpieczne?",
        a: "Domyślnie dane zostają wyłącznie na Twoim urządzeniu. Jeśli włączysz synchronizację, są szyfrowane <b>end-to-end</b> przed wysłaniem, kluczem tworzonym z Twojego hasła na Twoim urządzeniu. Pamiętaj jednak, że to wczesna wersja i mogą zdarzyć się błędy. Regularnie rób <b>eksport / kopię</b> danych i uważaj, zanim uznasz Zeccę za jedyne źródło prawdy.",
      },
      {
        q: "Czy moje dane trafiają na Wasz serwer?",
        a: "Tylko w postaci <b>zaszyfrowanej</b> i tylko jeśli włączysz synchronizację. Nie widzimy Twoich pozycji, wartości ani transakcji. Na serwerze leży wyłącznie szyfrogram.",
      },
      {
        q: "Jakie instrumenty obsługuje?",
        a: "Akcje, ETF-y, obligacje skarbowe detaliczne (ROD, EDO, COI…), lokaty, gotówkę, kryptowaluty i aktywa wyceniane ręcznie, w wielu walutach.",
      },
      {
        q: "Czy mogę dodać stare transakcje?",
        a: "Tak, dowolnie wstecz. Po dodaniu transakcji historycznej Zecca <b>przelicza całą historię</b> wartości portfela od tej daty.",
      },
      {
        q: "Jak zgłosić błąd albo pomysł?",
        a: "Napisz przez <b>formularz feedbacku</b> poniżej albo dołącz do naszego <b>Discorda</b>. W becie każda uwaga wpływa na to, co zbudujemy dalej.",
      },
    ],
  },

  // ── Domknięcie: prywatność + zaproszenie (dawniej lista beta) ─────────────
  closing: {
    ctaPrimary: "Załóż konto",
    ctaPrimaryHref: "/register",
    ctaSecondary: "Zobacz demo",
    ctaSecondaryHref: "/demo",
    note: "Konto zakładasz w minutę. Nie musisz nic podłączać — możesz zacząć od trybu offline.",
  },

  // ── 06 · Feedback ─────────────────────────────────────────────────────────
  feedback: {
    eyebrow: "Feedback",
    title: "Pomóż nam dopracować Zeccę.",
    desc: "Zbieramy uwagi od pierwszych użytkowników. Napisz, co działa, co nie działa i czego brakuje. Czytamy każdą wiadomość, a Wasze uwagi kształtują kolejne wersje.",
    discordButton: "Dołącz do Discorda",
    discordHref: "https://discord.gg/Y7yJep36bq",
    discordNote: "Społeczność, zapowiedzi i szybki kontakt z autorem.",
    // Adres, na który trafia formularz (otwiera klienta poczty) oraz temat maila.
    email: "kontakt@jacekzieba.pl",
    emailSubject: "Zecca feedback z bety",
    form: {
      nameLabel: "Imię",
      nameHint: "(opcjonalnie)",
      namePlaceholder: "Jak się do Ciebie zwracać?",
      emailLabel: "Email",
      emailHint: "(jeśli chcesz odpowiedzi)",
      emailPlaceholder: "ty@przyklad.pl",
      messageLabel: "Wiadomość",
      messagePlaceholder: "Co działa, co nie, czego brakuje…",
      submit: "Wyślij feedback",
      sending: "Dzięki! Otwieramy Twojego klienta poczty…",
    },
  },

  // ── Stopka ────────────────────────────────────────────────────────────────
  footer: {
    tagline: "Spokojny przegląd Twoich inwestycji. Lokalnie, prywatnie, po polsku.",
    columns: [
      {
        title: "Pobierz",
        links: [
          { label: "TestFlight (beta)", unavailable: true },
          { label: "App Store", unavailable: true, soon: "wkrótce" },
          { label: "Mac App Store", unavailable: true, soon: "wkrótce" },
        ],
      },
      {
        title: "Kontakt",
        links: [
          { label: "Discord", href: "https://discord.gg/Y7yJep36bq" },
          { label: "Kontakt", href: "mailto:kontakt@jacekzieba.pl" },
          { label: "FAQ", href: "/faq" },
          { label: "Polityka prywatności", href: "/privacy-policy" },
          { label: "Zmień zgodę na statystyki", consentReset: true },
        ],
      },
    ],
    copyright: "© 2026 Zecca · Zbudowane dla polskiego inwestora",
    betaNote: "Wersja beta. W aplikacji mogą występować błędy.",
    disclaimer: INVESTMENT_DISCLAIMER,
  },
} as const;

export type LandingCopy = typeof landingCopy;
