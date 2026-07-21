import Link from "next/link";
import { COLORS } from "@/lib/design-tokens";
import { Footer } from "@/components/layout/footer";

export const metadata = {
  title: "FAQ i metryki - Zecca",
  description: "Najczęstsze pytania dotyczące Zecca oraz wyjaśnienia metryk inwestycyjnych.",
};

interface FAQItem {
  question: string;
  answer: string | string[];
}

interface MetricItem {
  id: string;
  name: string;
  badge: string;
  short: string;
  details: string[];
  example: string;
}

const faqs: FAQItem[] = [
  {
    question: "Czym jest Zecca?",
    answer:
      "Zecca to natywna aplikacja na macOS i iOS do śledzenia portfeli inwestycyjnych: akcji, ETF-ów, obligacji skarbowych, lokat i gotówki.",
  },
  {
    question: "Gdzie przechowywane są moje dane?",
    answer:
      "Domyślnie wszystkie dane są na Twoim urządzeniu. Możesz opcjonalnie włączyć synchronizację przez prywatny kontener iCloud albo prywatną synchronizację Zecca, w której rekordy portfela są szyfrowane na urządzeniu przed wysłaniem na serwer.",
  },
  {
    question: "Czy moje dane finansowe są bezpieczne?",
    answer:
      "Tak. Przy prywatnej synchronizacji Zecca rekordy portfela są szyfrowane na urządzeniu — serwer przechowuje wyłącznie zaszyfrowane dane. Telemetria nigdy nie zawiera kwot, tickerów, adresów e-mail ani identyfikatorów portfeli.",
  },
  {
    question: "Jak przenieść dane na nowe urządzenie?",
    answer:
      "Włącz synchronizację i zaloguj się tym samym kontem na nowym urządzeniu, a następnie podaj swoją frazę synchronizacji (passphrase) — tę samą, którą ustalono przy włączaniu prywatnej synchronizacji Zecca. Odblokowuje ona zaszyfrowany klucz, dzięki czemu Twoje dane stają się dostępne na nowym sprzęcie. Fraza synchronizacji nie jest tym samym co hasło konta i nie jest przechowywana na serwerze.",
  },
  {
    question: "Czy mogę korzystać bez konta?",
    answer:
      "Tak. Konto i synchronizacja są opcjonalne. Bez nich Zecca działa w pełni lokalnie na urządzeniu.",
  },
  {
    question: "Jak usunąć konto?",
    answer:
      "W aplikacji: Ustawienia → Konto → Usuń konto. Operacja usuwa konto oraz powiązane z nim dane synchronizacji.",
  },
  {
    question: "Skąd pochodzą ceny i dane rynkowe?",
    answer:
      "Zecca korzysta z publicznych źródeł danych rynkowych dla wyceny instrumentów oraz kursów walut i wskaźników. Część wartości można też wprowadzać ręcznie.",
  },
  {
    question: "Czy web liczy te same metryki co macOS i iOS?",
    answer:
      "Tak. Web korzysta z tego samego modelu danych synchronizacji i pokazuje te same rodziny metryk: XIRR/MWR, TWR, CAGR, wynik realny po inflacji, maksymalne obsunięcie oraz zyski zrealizowane i niezrealizowane. Różnice mogą wynikać z zaokrągleń, zakresu dat albo świeżości danych rynkowych.",
  },
  {
    question: "Jak się skontaktować ze wsparciem?",
    answer: "Napisz na: kontakt@jacekzieba.pl",
  },
];

const metrics: MetricItem[] = [
  {
    id: "metryki-xirr",
    name: "MWR / XIRR",
    badge: "rocznie, ważony kapitałem",
    short: "Pokazuje, jak pracowały pieniądze faktycznie wpłacone do portfela.",
    details: [
      "Uwzględnia daty i wielkość wpłat oraz wypłat.",
      "Jest dobry do odpowiedzi: ile zarobiłem na kapitale, który realnie był w portfelu?",
      "Może mocno zależeć od momentu dużych dopłat lub wypłat.",
    ],
    example:
      "Jeśli wpłaciłeś 10 000 PLN, po roku dopłaciłeś 40 000 PLN, a rynek mocno wzrósł dopiero po drugiej wpłacie, XIRR pokaże wynik bliższy temu, co zarobił większy kapitał.",
  },
  {
    id: "metryki-twr",
    name: "TWR",
    badge: "zwrot bez wpływu wpłat",
    short: "Mierzy wynik inwestycyjny portfela, neutralizując dopłaty i wypłaty.",
    details: [
      "Dzieli historię na okresy między przepływami gotówki.",
      "Pozwala porównać strategię portfela z benchmarkiem.",
      "Nie mówi, ile złotych zarobiłeś, tylko jak zachowywał się portfel jako strategia.",
    ],
    example:
      "Jeśli portfel urósł z 10 000 do 11 000 PLN, a potem dopłaciłeś 50 000 PLN, TWR nie uzna tej dopłaty za zysk inwestycyjny.",
  },
  {
    id: "metryki-cagr",
    name: "CAGR",
    badge: "średnio rocznie",
    short: "Sprowadza zwrot do średniej rocznej stopy wzrostu.",
    details: [
      "W Zecca jest annualizowaną wersją zwrotu ważonego czasem.",
      "Ułatwia porównanie portfeli o różnej długości historii.",
      "Nie oznacza, że portfel rósł tak samo w każdym roku.",
    ],
    example:
      "Wzrost z 100 000 do 121 000 PLN przez 2 lata to CAGR około 10%, mimo że jeden rok mógł być ujemny, a drugi bardzo dodatni.",
  },
  {
    id: "metryki-wynik-realny",
    name: "Wynik realny",
    badge: "po inflacji",
    short: "Pokazuje zwrot po skorygowaniu nominalnego wyniku o inflację CPI.",
    details: [
      "Wynik nominalny mówi, o ile wzrosła kwota.",
      "Wynik realny mówi, jak zmieniła się siła nabywcza kapitału.",
      "W Zecca realny zwrot jest liczony z rocznej stopy nominalnej i inflacji.",
    ],
    example:
      "Jeśli CAGR wynosi +10%, a inflacja +6%, wynik realny to około +3,77%, bo liczymy relację 1,10 / 1,06, a nie proste 10% minus 6%.",
  },
  {
    id: "metryki-obsuniecie",
    name: "Maksymalne obsunięcie",
    badge: "max drawdown",
    short: "Największy spadek wartości od wcześniejszego szczytu.",
    details: [
      "Pokazuje skalę najgorszego historycznego spadku w badanym okresie.",
      "Jest miarą ryzyka i psychologicznej trudności utrzymania strategii.",
      "Warto patrzeć na nie razem z CAGR lub TWR, a nie zamiast nich.",
    ],
    example:
      "Jeśli portfel osiągnął 120 000 PLN, spadł do 96 000 PLN, a potem odrobił straty, maksymalne obsunięcie wyniosło -20%.",
  },
  {
    id: "metryki-zysk",
    name: "Zysk zrealizowany i niezrealizowany",
    badge: "zamknięte vs otwarte pozycje",
    short: "Rozdziela wynik z pozycji już sprzedanych od wyniku, który nadal istnieje tylko na otwartych pozycjach.",
    details: [
      "Zysk zrealizowany pochodzi z zamkniętych pozycji i jest liczony na bazie FIFO.",
      "Zysk niezrealizowany wynika z aktualnej wyceny otwartych pozycji względem zainwestowanego kapitału.",
      "Dywidendy, odsetki, podatki i prowizje mogą wpływać na pełny obraz cashflow inaczej niż sama zmiana ceny instrumentu.",
    ],
    example:
      "Sprzedaż ETF-u z zyskiem 2 000 PLN trafia do zysku zrealizowanego. Akcje nadal trzymane z wyceną +1 500 PLN są zyskiem niezrealizowanym.",
  },
  {
    id: "metryki-wartosc-vs-wplaty",
    name: "Wartość konta vs wpłaty",
    badge: "wykres",
    short: "Porównuje aktualną historię wartości portfela ze skumulowanymi wpłatami netto.",
    details: [
      "Linia wartości pokazuje, ile portfel był wart w czasie.",
      "Linia wpłat pokazuje, ile kapitału netto włożyłeś do portfela.",
      "Różnica pomaga odróżnić wzrost majątku dzięki dopłatom od wzrostu dzięki inwestycjom.",
    ],
    example:
      "Jeśli wartość portfela to 80 000 PLN, a wpłaty netto to 70 000 PLN, nadwyżka 10 000 PLN jest efektem wyniku inwestycyjnego i przychodów, po uwzględnieniu kosztów.",
  },
];

const implementationNotes = [
  "W menu webowym jest osobna zakładka FAQ, żeby użytkownik mógł szybko wrócić do definicji metryk.",
  "Kolejny krok dla parytetu z macOS/iOS to małe ikony pomocy przy kafelkach KPI i tytułach wykresów, linkujące bezpośrednio do odpowiedniej sekcji FAQ.",
  "Dla ekranów analitycznych warto używać tych samych opisów w tooltipach, panelu konfiguracji dashboardu i dokumentacji FAQ, żeby nazwy nie rozjechały się między platformami.",
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: Array.isArray(faq.answer) ? faq.answer.join(" ") : faq.answer,
    },
  })),
};

export default function FAQPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
      />
      <main style={{ flex: 1, maxWidth: "900px", marginInline: "auto", width: "100%", padding: "40px 24px" }}>
        <div style={{ marginBottom: 48 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.01em" }}>
            FAQ i metryki
          </h1>
          <p style={{ fontSize: 15, color: COLORS.textMuted }}>
            Odpowiedzi na popularne pytania oraz praktyczne wyjaśnienia wskaźników widocznych w dashboardzie, raportach i portfelach.
          </p>
          <Link
            href="/dashboard?tour=1"
            style={{ display: "inline-block", marginTop: 12, fontSize: 13.5, fontWeight: 600, color: COLORS.green, textDecoration: "none" }}
          >
            ▶ Zobacz wprowadzenie do aplikacji (tour)
          </Link>
        </div>

        <section style={{ marginBottom: 56 }}>
          <div style={{ marginBottom: 24 }}>
            <div
              id="metryki"
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: COLORS.subtle,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Metryki i wykresy
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>
              Jak czytać wyniki w Zecca?
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: COLORS.textMuted }}>
              Same złotówki nie wystarczą do oceny portfela. Zecca rozdziela przepływy gotówki, wynik inwestycyjny, inflację i ryzyko, żeby duża dopłata nie wyglądała jak zysk, a nominalny wzrost nie ukrywał utraty siły nabywczej.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            {metrics.map((metric) => (
              <article
                id={metric.id}
                key={metric.name}
                style={{
                  background: COLORS.surface,
                  border: `0.5px solid ${COLORS.border}`,
                  borderRadius: 8,
                  padding: 18,
                  boxShadow: "0 1px 0 rgba(22,29,24,0.03), 0 6px 20px rgba(22,29,24,0.05)",
                }}
              >
                <div style={{ marginBottom: 10 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, margin: 0 }}>
                    {metric.name}
                  </h3>
                  <span
                    style={{
                      display: "inline-flex",
                      marginTop: 8,
                      fontSize: 10,
                      fontWeight: 700,
                      color: COLORS.green,
                      background: COLORS.accentSoft,
                      borderRadius: 5,
                      padding: "3px 7px",
                      textTransform: "uppercase",
                      letterSpacing: ".04em",
                    }}
                  >
                    {metric.badge}
                  </span>
                </div>
                <p style={{ fontSize: 15, lineHeight: 1.55, color: COLORS.text, marginBottom: 12 }}>
                  {metric.short}
                </p>
                <ul style={{ paddingLeft: 18, margin: "0 0 14px", color: COLORS.textMuted, fontSize: 14, lineHeight: 1.55 }}>
                  {metric.details.map((detail) => (
                    <li key={detail} style={{ marginBottom: 6 }}>
                      {detail}
                    </li>
                  ))}
                </ul>
                <div
                  style={{
                    borderTop: `0.5px solid ${COLORS.border}`,
                    paddingTop: 12,
                    fontSize: 13.5,
                    lineHeight: 1.55,
                    color: COLORS.textMuted,
                  }}
                >
                  <strong style={{ color: COLORS.text }}>Przykład: </strong>
                  {metric.example}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: COLORS.text, marginBottom: 12 }}>
            Proponowana implementacja wyjaśnień na webie
          </h2>
          <div
            style={{
              background: COLORS.surfaceAlt,
              border: `0.5px solid ${COLORS.border}`,
              borderRadius: 8,
              padding: 18,
            }}
          >
            <ul style={{ paddingLeft: 20, margin: 0, color: COLORS.textMuted, fontSize: 15, lineHeight: 1.6 }}>
              {implementationNotes.map((note) => (
                <li key={note} style={{ marginBottom: 8 }}>
                  {note}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: COLORS.text, marginBottom: 20 }}>
            Najczęstsze pytania
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {faqs.map((faq, index) => (
            <div
              key={index}
              style={{
                paddingBottom: 24,
                borderBottom: index < faqs.length - 1 ? `0.5px solid ${COLORS.border}` : "none",
              }}
            >
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  marginBottom: 12,
                  color: COLORS.text,
                }}
              >
                {faq.question}
              </h2>
              <div style={{ fontSize: 15, lineHeight: 1.6, color: COLORS.textMuted }}>
                {Array.isArray(faq.answer) ? (
                  <ul style={{ paddingLeft: 20 }}>
                    {faq.answer.map((line, i) => (
                      <li key={i} style={{ marginBottom: 8 }}>
                        {line}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>{faq.answer}</p>
                )}
              </div>
            </div>
          ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
