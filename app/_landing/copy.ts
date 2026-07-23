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

export const landingCopy = {
  // ── Górna nawigacja ───────────────────────────────────────────────────────
  nav: {
    links: [
      { label: "Beta: zapisy", href: "#lista-beta" },
      { label: "Funkcje", href: "#funkcje" },
      { label: "Aplikacje", href: "#aplikacje" },
      { label: "Feedback", href: "#kontakt" },
      { label: "Zobacz demo", href: "/demo" },
      { label: "Zaloguj się", href: "/login" },
      { label: "Załóż konto", href: "/register" },
    ],
  },

  // ── Sekcja główna (hero) ──────────────────────────────────────────────────
  hero: {
    betaBanner: "Trwają beta testy, które mają na celu eliminację ewentualnych błędów.",
    eyebrow: "Natywnie na macOS i iOS oraz przez przeglądarkę",
    title: "Wszystkie Twoje inwestycje w jednym miejscu",
    lede: "W aplikacji Zecca możesz śledzić swoje portfele inwestycyjne oraz monitorować wartość Twoich akcji, ETF-ów, obligacji i innych aktywów. Program samodzielnie przelicza całą historię Twoich inwestycji.",
    ctaPrimary: "Dołącz do listy beta",
    ctaPrimaryHref: "#lista-beta",
    ctaDemo: "Zobacz demo",
    ctaDemoHref: "/demo",
    // Realne wejścia silnika — krótki „stempel" pod ledem, nie ozdoba.
    sources: ["Kursy NBP", "Inflacja GUS", "XIRR / TWR"],
    proof:
      "Monitoruj swój główny portfel inwestycyjny oraz konta&nbsp;<b>IKE</b> i <b>IKZE.</b>",
    storeBadges: [
      { top: "Pobierz w", main: "App Store", soon: "wkrótce" },
      { top: "Pobierz w", main: "Mac App Store", soon: "Wkrótce" },
    ],
    note: "Synchronizuj dane między urządzeniami lub korzystaj z trybu offline.",
    imageAlt: "Zecca na macOS — raporty i statystyki",
    trust: [
      { title: "Dane szyfrowane end-to-end", desc: "Dbamy o Twoje bezpieczeństwo" },
      { title: "Wybierz wersję offline lub synchronizację online", desc: "Decyduj, czy i jak synchronizować dane między urządzeniami" },
      { title: "Aktualne kursy walut, akcji, ETF i obligacji.", desc: "Korzystamy z rzetelnych źródeł aby zapewnić aktualne dane" },
      { title: "Inflacja CPI z GUS", desc: "Oficjalne dane o inflacji prosto z GUS, aby policzyć realny wynik inwestycji" },
    ],
  },

  // ── P1 · Jak działa ──────────────────────────────────────────────────────
  howItWorks: {
    eyebrow: "Obraz Twojego majątku",
    title: "Zecca prezentuje dane i wykresy dotyczące wszystkich Twoich inwestycji",
    desc: "Zecca nie próbuje zgadywać Twojego portfela z jednego salda. Buduje go od źródła: transakcji, wpłat, wycen i oficjalnych danych.",
    steps: [
      {
        label: "01",
        title: "Wprowadzasz transakcje ręcznie albo importujesz pliki od Twojego brokera&nbsp;",
        desc: "Możesz cofnąć się do pierwszej obligacji, lokaty albo ETF-u.",
        meta: "Transakcje · import · aktywa ręczne",
      },
      {
        label: "02",
        title: "Nasz model obliczeniowy przelicza transakcje, kursy, odsetki, dywidendy i wynik realny po inflacji.",
        desc: "Dołożyliśmy starań, abyś mógł zobaczyć wiarygodne i rzetelne wyniki swoich inwestycji.",
        meta: "NBP · GUS · FIFO · XIRR",
      },
      {
        label: "03",
        title: "Wszystko w jednym miejscu",
        desc: "Koniec z logowaniem się do kilku miejsc aby zobaczyć IKE, IKZE, obligacje i inne aktywa. Koniec z Excelem. Prezentujemy wszystko, czego potrzebujesz by inwestować skutecznie.",
        meta: "Portfele · alokacja · historia",
      },
    ],
  },

  // ── 01 · Funkcje (9 kart, w tej samej kolejności co ikony) ────────────────
  features: {
    eyebrow: "01 · FUNKCJE",
    title: "Jeden spokojny widok na <em>cały</em> Twój majątek.",
    desc: "Od pierwszej obligacji kupionej lata temu po dzisiejszy ETF. Zecca składa to w jedną, odtwarzalną historię wartości.",
    items: [
      {
        title: "Wiele portfeli i grup",
        desc: "IKE, IKZE, konto główne, grupy i subportfele. Widok łączny bez dublowania transakcji.",
        tags: ["IKE", "IKZE", "Grupy"],
      },
      {
        title: "Każda klasa aktywów",
        desc: "Akcje, ETF-y, obligacje skarbowe i notowane, lokaty, gotówka, krypto oraz aktywa ręczne: nieruchomości, metale, wino czy sztuka.",
        tags: ["Akcje / ETF", "Obligacje", "Krypto", "Lokaty"],
      },
      {
        title: "Statystyki jak u profesjonalisty",
        desc: "MWR / XIRR, TWR, CAGR, max drawdown, zysk zrealizowany i niezrealizowany, dywidendy i odsetki.",
        tags: ["XIRR", "TWR", "CAGR"],
      },
      {
        title: "Wynik realny po inflacji",
        desc: "Dane CPI z GUS pokazują, ile naprawdę zarobiłeś: nominalnie i po inflacji, rok po roku.",
        tags: ["GUS / CPI", "nominalny vs realny"],
      },
      {
        title: "Historia od pierwszej transakcji",
        desc: "Dodaj transakcje dowolnie wstecz, np. zakup ROD z 2019 r. Zecca odtworzy całą historię wartości portfela.",
        tags: ["backdated", "FIFO"],
      },
      {
        title: "Moduł Zarobki",
        desc: "Osobny widok dochodów i obciążeń: wynagrodzenia, UoP/B2B, podsumowania miesięczne, średnie i najlepszy miesiąc. Inwestycje obok prywatnego cashflow.",
        tags: ["dochody", "cashflow", "UoP / B2B"],
      },
      {
        title: "Import od brokerów",
        desc: "Wczytaj historię z plików XLS/XLSX. Gotowe importery dla XTB i PKO Obligacje. Podgląd przed zatwierdzeniem, wykrywanie duplikatów i parowanie instrumentów.",
        tags: ["XTB", "PKO Obligacje", "XLSX"],
      },
      {
        title: "Eksport i kopie",
        desc: "Eksportuj do CSV transakcje, historię wartości, przychody i pozycje, całość lub jeden portfel. Plus lokalny backup JSON. Twoje dane należą do Ciebie.",
        tags: ["CSV", "backup JSON"],
      },
      {
        title: "Konto i synchronizacja",
        desc: "Działaj bez konta lub włącz synchronizację: iCloud albo prywatną, szyfrowaną sync Zecca. Logowanie e-mailem, przez Apple lub Google, blokada Face&nbsp;ID / Touch&nbsp;ID.",
        tags: ["iCloud", "Zecca Sync", "Face ID"],
      },
    ],
  },

  // ── Showcase platform ─────────────────────────────────────────────────────
  showcase: {
    eyebrow: "Jedno Zecca · trzy platformy",
    title: "Ten sam portfel. Dokładnie tam, gdzie go potrzebujesz.",
    desc: "Pracuj głęboko na Macu, otwieraj portfel bez instalacji w przeglądarce i zaglądaj do najważniejszych liczb na iPhonie. Zmieniasz ekran, nie sposób liczenia ani kontekst.",
    desktop: [
      {
        id: "web",
        tab: "Web",
        kicker: "Web · bez instalacji",
        title: "Twój portfel dostępny również w przeglądarce.",
        desc: "Wersja webowa daje szybki dostęp do tych samych portfeli, raportów i wykresów na dowolnym komputerze — z zachowaniem spójnego modelu danych Zecca.",
        points: [
          "Dostęp z aktualnej przeglądarki na komputerze",
          "Te same portfele, metryki i historia inwestycji",
          "Czytelny układ dostosowany do szerokości ekranu",
        ],
        imageAlt: "Zecca w przeglądarce — raporty i alokacja portfela",
      },
      {
        id: "macos",
        tab: "macOS",
        kicker: "macOS · natywna aplikacja",
        title: "Pełny warsztat inwestora na dużym ekranie.",
        desc: "Raporty, alokacja, wyniki realne i historia portfeli są ułożone tak, aby dało się przejść od ogólnego obrazu do szczegółów bez gubienia kontekstu.",
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
      title: "Sprawdzasz portfel w chwili, w której tego potrzebujesz.",
      desc: "Mobilny widok nie próbuje pomieścić całego desktopu. Pokazuje wartość, zmianę, wynik, dywidendy i alokację w kolejności stworzonej do szybkiego sprawdzenia.",
      points: [
        "Wartość i historia portfela w zakresach 1M–MAX",
        "Wynik, dywidendy i alokacja na jednym ekranie",
        "Natywna nawigacja zaprojektowana pod obsługę kciukiem",
      ],
      imageAlt: "Zecca na iOS — mobilny dashboard portfela",
    },
  },

  // ── 02 · Dla polskiego inwestora (6 kafli) ────────────────────────────────
  investor: {
    eyebrow: "02 · DLA POLSKIEGO INWESTORA",
    title: "Zbudowane pod <em>polskie</em> realia.",
    desc: "Nie kalka zagranicznego trackera. IKE i IKZE, detaliczne obligacje skarbowe, kursy NBP i inflacja GUS są tu pierwszej klasy obywatelami.",
    cells: [
      {
        badge: "IKE / IKZE",
        title: "Konta emerytalne",
        desc: "IKE i IKZE jako osobne portfele, z widokiem łącznym i podziałem na opodatkowane vs. emerytalne.",
      },
      {
        badge: "OBLIGACJE",
        title: "Obligacje skarbowe detaliczne",
        desc: "ROD, EDO, COI, TOS, ROR, DOR. Narastanie odsetek wg serii, inflacji i marży, kapitalizacja oraz wykup.",
      },
      {
        badge: "NBP",
        title: "Kursy walut z NBP",
        desc: "Oficjalne tabele NBP do wyceny aktywów w walutach obcych i złota, z konkretnego dnia lub ostatniej publikacji.",
      },
      {
        badge: "GUS",
        title: "Inflacja z GUS",
        desc: "Wskaźnik CPI prosto z oficjalnych danych GUS, podstawa wyniku realnego po inflacji.",
      },
      {
        badge: "LOKATY",
        title: "Lokaty z podatkiem Belki",
        desc: "Harmonogram narastania odsetek, podatek od zysków kapitałowych i przedterminowe zamknięcie.",
      },
      {
        badge: "PLN / EUR / USD",
        title: "Bazowo w złotówkach",
        desc: "Waluta bazowa PLN i osobna waluta wyświetlania: PLN, EUR lub USD. Pozycje zagraniczne przeliczane po kursach NBP, także historycznie.",
      },
    ],
  },

  // ── 03 · Porównanie (Zecca vs MyFund vs arkusz) ───────────────────────────
  comparison: {
    eyebrow: "03 · PORÓWNANIE",
    title: "Zecca kontra MyFund i arkusz kalkulacyjny.",
    desc: "Uczciwe porównanie trzech sposobów monitorowania portfela — łącznie z zaawansowanymi, darmowymi szablonami arkuszy, nie tylko podstawowym Excelem.",
    columns: ["Zecca", "MyFund", "Arkusz (Excel / Sheets)"],
    rows: [
      {
        label: "Cena",
        values: [
          "Bezpłatna w wersji beta",
          "Od 4,49 zł/mies. (płatne portfele od pierwszego)",
          "Darmowy — nawet zaawansowane szablony społecznościowe",
        ],
      },
      {
        label: "Import transakcji od brokera",
        values: [
          "Automatyczny, z plików XTB i PKO Obligacje",
          "Import operacji z e-maila od planu Pro",
          "Brak — każdą transakcję wpisujesz ręcznie",
        ],
      },
      {
        label: "IKE i IKZE jako osobne portfele",
        values: [
          "Tak, wbudowane od zera",
          "Tak, ale limity wpłat tylko w płatnych planach",
          "Da się zbudować, ale limity i podział pilnujesz sam",
        ],
      },
      {
        label: "Obligacje detaliczne (ROD, EDO, COI…)",
        values: [
          "Automatyczne naliczanie wg serii i marży",
          "Wymaga ręcznego wprowadzenia parametrów serii",
          "Da się policzyć, ale każda nowa seria to nowa formuła",
        ],
      },
      {
        label: "Kursy walut z NBP",
        values: [
          "Automatycznie, także historycznie",
          "Automatycznie",
          "Tylko w Google Sheets (nie działa w Excelu)",
        ],
      },
      {
        label: "Inflacja CPI z GUS",
        values: [
          "Automatycznie, dla całego portfela",
          "Brak wprost — liczysz samodzielnie",
          "Tylko dla obligacji indeksowanych w najlepszych szablonach",
        ],
      },
      {
        label: "XIRR / TWR / CAGR",
        values: [
          "Wszystkie trzy, liczone natywnie",
          "XIRR i porównania z benchmarkiem od planu Standard",
          "XIRR zwykle tak, TWR i CAGR trzeba dobudować",
        ],
      },
      {
        label: "Szyfrowanie end-to-end",
        values: [
          "Tak, domyślnie",
          "Brak informacji o szyfrowaniu end-to-end",
          "Zależy od zabezpieczeń Twojego konta Google/Microsoft",
        ],
      },
      {
        label: "Aplikacja natywna macOS / iOS",
        values: [
          "Tak",
          "iPhone / Android od planu Pro, brak macOS",
          "Brak — tylko przeglądarka",
        ],
      },
      {
        label: "Pełna personalizacja pod własne potrzeby",
        values: [
          "Ograniczona do funkcji aplikacji",
          "Ograniczona do funkcji aplikacji",
          "Pełna — zmieniasz dowolną formułę i widok",
        ],
      },
      {
        label: "Ryzyko błędu przy utrzymaniu",
        values: [
          "Niskie — silnik liczy za Ciebie",
          "Niskie — liczy dostawca",
          "Wysokie — jedna zepsuta formuła psuje cały portfel bez ostrzeżenia",
        ],
      },
    ],
    footnote:
      "Ceny i zakres funkcji MyFund wg cennika dostawcy w dniu publikacji — mogą się zmienić. Kolumna „Arkusz” uwzględnia też zaawansowane, darmowe szablony społecznościowe, nie tylko podstawowy Excel.",
  },

  // ── 04 · FAQ (`open: true` = rozwinięte na starcie) ───────────────────────
  faq: {
    eyebrow: "04 · FAQ",
    title: "Częste pytania.",
    items: [
      {
        q: "Czy Zecca jest darmowa?",
        a: "Tak. W trakcie beta testów korzystanie z aplikacji jest <b>bezpłatne</b>. O ewentualnym modelu cenowym poinformujemy z wyprzedzeniem, zanim beta się zakończy.",
        open: true,
      },
      {
        q: "Na jakich urządzeniach działa?",
        a: "Natywnie na <b>macOS</b> i <b>iOS</b>. Jest też wersja webowa do podglądu portfela w przeglądarce. Wszystkie korzystają z tego samego, szyfrowanego modelu danych.",
      },
      {
        q: "To beta. Czy moje dane są bezpieczne?",
        a: "Dane są szyfrowane <b>end-to-end</b>, a klucz znasz tylko Ty. Pamiętaj jednak, że to wczesna wersja, mogą zdarzyć się błędy. Zalecamy regularny <b>eksport / kopię</b> danych i ostrożność przy traktowaniu Zecci jako jedynego źródła prawdy.",
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
        a: "Napisz przez <b>formularz feedbacku</b> poniżej albo dołącz do naszego <b>Discorda</b>. W becie każda uwaga realnie wpływa na to, co budujemy dalej.",
      },
    ],
  },

  // ── 05 · Lista beta ──────────────────────────────────────────────────────
  betaList: {
    eyebrow: "05 · LISTA BETA",
    title: "Zapisy uruchomimy w kontrolowany sposób.",
    desc: "Miejsca w becie udostępniamy stopniowo. Zostaw swój adres e-mail, a damy Ci znać, gdy tylko otworzymy kolejną turę zapisów.",
    form: {
      emailLabel: "Email",
      emailPlaceholder: "ty@przyklad.pl",
      consentLabel: "Chcę zapisać się do testów beta",
      submit: "Dołącz do listy",
      disabledSubmit: "Wkrótce",
      success: "Dzięki — zapisaliśmy email na liście beta.",
      error: "Nie udało się zapisać. Spróbuj ponownie za chwilę.",
      invalidEmail: "Podaj poprawny adres e-mail.",
      missingConsent: "Zaznacz zgodę, żeby dołączyć do listy.",
    },
  },

  // ── 06 · Feedback ─────────────────────────────────────────────────────────
  feedback: {
    eyebrow: "06 · FEEDBACK",
    title: "Pomóż nam dopracować <em>Zeccę</em>.",
    desc: "Zbieramy feedback od pierwszych użytkowników. Napisz, co działa, co nie i czego brakuje. Czytamy każdą wiadomość i to ona kształtuje kolejne wersje.",
    discordButton: "Dołącz do Discorda",
    discordHref: "https://discord.gg/Y7yJep36bq",
    discordNote: "Społeczność, zapowiedzi i szybki kontakt z autorem.",
    // Adres, na który trafia formularz (otwiera klienta poczty) oraz temat maila.
    email: "zecca.barista363@passmail.net",
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
          { label: "Feedback", href: "#kontakt" },
          { label: "E-mail", href: "mailto:zecca.barista363@passmail.net" },
          { label: "FAQ", href: "/faq" },
          { label: "Polityka prywatności", href: "/privacy-policy" },
        ],
      },
    ],
    copyright: "© 2026 Zecca · Zbudowane dla polskiego inwestora",
    betaNote: "Wersja beta. W aplikacji mogą występować błędy.",
  },
} as const;

export type LandingCopy = typeof landingCopy;
