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
      { label: "Funkcje", href: "#funkcje" },
      { label: "Prywatność", href: "#prywatnosc" },
      { label: "Dla inwestora", href: "#inwestor" },
      { label: "FAQ", href: "#faq" },
    ],
    login: { label: "Zaloguj się", href: "/login" },
  },

  // ── Sekcja główna (hero) ──────────────────────────────────────────────────
  hero: {
    betaBanner:
      "Trwają beta testy. Aplikacja jest w pełni używalna, ale&nbsp;<b>mogą zdarzyć się błędy</b>.",
    eyebrow: "Natywnie na macOS i iOS",
    title: "Wszystkie Twoje inwestycje, <em>czytane</em> jak rocznik finansowy.",
    lede: "Zecca prowadzi Twoje portfele: <b>IKE, IKZE, akcje, ETF-y, obligacje skarbowe i lokaty</b>, lokalnie i prywatnie. Wielkie, czytelne liczby zamiast zimnego dashboardu. Kursy z NBP, inflacja z GUS, pełna historia liczona od pierwszej transakcji.",
    ctaPrimary: "Dołącz do bety przez TestFlight",
    ctaPrimaryHref: "#",
    storeBadges: [
      { top: "Pobierz w", main: "App Store", soon: "wkrótce" },
      { top: "Pobierz w", main: "Mac App Store", soon: "wkrótce" },
    ],
    note: "<b>Darmowa w wersji beta.</b> Działa lokalnie, bez konta, jeśli nie chcesz synchronizacji.",
    imageAlt: "Zecca na macOS — raporty i statystyki",
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

  // ── Showcase (zrzuty: 1 = macOS, 2 = iOS) ─────────────────────────────────
  showcase: [
    {
      kicker: "macOS · Dashboard",
      title: "Spokojny dashboard, nie ściana wykresów.",
      desc: "Ciepłe, papierowe tło i wielkie szeryfowe liczby. Najważniejsze metryki są pierwsze, reszta czeka, aż jej poszukasz.",
      points: [
        "Wartość całości, dzienna i miesięczna zmiana",
        "Alokacja klas aktywów i odchylenie od celu",
        "Znacznik świeżości danych: wiesz, co jest aktualne",
      ],
      imageAlt: "Zecca na macOS — raporty i statystyki",
    },
    {
      kicker: "iOS · Dashboard w kieszeni",
      title: "Cały portfel pod ręką, gdziekolwiek jesteś.",
      desc: "Natywna aplikacja iOS z tym samym modelem danych co macOS. Łączna wartość, wykres historii, zysk i dywidendy, alokacja klas aktywów — wszystko w zasięgu kciuka.",
      points: [
        "Łączna wartość i zmiana w oknie 1M / 1Y / MAX",
        "Zysk niezrealizowany, dywidendy i alokacja na jednym ekranie",
        "Dashboard, Pozycje, Transakcje i Zarobki w zasięgu kciuka",
      ],
      imageAlt: "Zecca na iOS — dashboard portfela",
    },
  ],

  // ── 02 · Prywatność (4 karty) ─────────────────────────────────────────────
  privacy: {
    eyebrow: "02 · PRYWATNOŚĆ",
    title: "Twoje liczby nie opuszczają Ciebie w&nbsp;<em>czytelnej</em> formie.",
    desc: "Zecca jest zaprojektowana lokalnie i prywatnie. Szyfrowanie jest domyślne, nie opcjonalne, a klucz znasz tylko Ty.",
    cards: [
      {
        title: "Szyfrowanie end-to-end",
        desc: "Wszystko jest szyfrowane na Twoim urządzeniu. Na serwer trafia wyłącznie szyfrogram. Nie widzimy Twoich pozycji ani wartości.",
      },
      {
        title: "Klucz znasz tylko Ty",
        desc: "Dane odblokowuje Twoja fraza. Bez niej nikt, łącznie z nami, nie odczyta portfela. To także oznacza: zapamiętaj ją dobrze.",
      },
      {
        title: "Lokalnie najpierw",
        desc: "Aplikacja działa w pełni lokalnie. Synchronizacja między urządzeniami jest opcjonalna i również w całości zaszyfrowana.",
      },
      {
        title: "Te same reguły wszędzie",
        desc: "Web Crypto w przeglądarce i CryptoKit na urządzeniach Apple liczą identycznie, a zgodność potwierdzają wektory testowe.",
      },
    ],
    footnote:
      "Na backendzie przechowujemy wyłącznie zaszyfrowane rekordy, izolowane regułami dostępu per użytkownik (RLS). Klucze i fraza nigdy nie opuszczają Twojego urządzenia w postaci jawnej.",
  },

  // ── 03 · Dla polskiego inwestora (6 kafli) ────────────────────────────────
  investor: {
    eyebrow: "03 · DLA POLSKIEGO INWESTORA",
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
        a: "Dane są szyfrowane <b>end-to-end</b>, a klucz znasz tylko Ty. Pamiętaj jednak, że to wczesna wersja, mogą zdarzyć się błędy. Zalecamy regularny <b>eksport / kopię</b> danych i ostrożność przy traktowaniu Zekki jako jedynego źródła prawdy.",
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

  // ── 05 · Feedback ─────────────────────────────────────────────────────────
  feedback: {
    eyebrow: "05 · FEEDBACK",
    title: "Pomóż nam dopracować <em>Zeccę</em>.",
    desc: "Zbieramy feedback od pierwszych użytkowników. Napisz, co działa, co nie i czego brakuje. Czytamy każdą wiadomość i to ona kształtuje kolejne wersje.",
    discordButton: "Dołącz do Discorda",
    discordHref: "#",
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
        title: "Produkt",
        links: [
          { label: "Funkcje", href: "#funkcje" },
          { label: "Prywatność", href: "#prywatnosc" },
          { label: "Dla inwestora", href: "#inwestor" },
          { label: "FAQ", href: "#faq" },
        ],
      },
      {
        title: "Pobierz",
        links: [
          { label: "TestFlight (beta)", href: "#" },
          { label: "App Store", href: "#", soon: "wkrótce" },
          { label: "Mac App Store", href: "#", soon: "wkrótce" },
          { label: "Zaloguj się", href: "/login" },
        ],
      },
      {
        title: "Kontakt",
        links: [
          { label: "Discord", href: "#" },
          { label: "Feedback", href: "#kontakt" },
          { label: "Email", href: "mailto:zecca.barista363@passmail.net" },
          { label: "Polityka prywatności", href: "/privacy-policy" },
        ],
      },
    ],
    copyright: "© 2026 Zecca · Zbudowane dla polskiego inwestora",
    betaNote: "Wersja beta. W aplikacji mogą występować błędy.",
  },
} as const;

export type LandingCopy = typeof landingCopy;
