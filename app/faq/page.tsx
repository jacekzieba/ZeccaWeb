import { COLORS } from "@/lib/design-tokens";
import { Footer } from "@/components/layout/footer";

export const metadata = {
  title: "FAQ - Zecca",
  description: "Najczęstsze pytania dotyczące Zecca",
};

interface FAQItem {
  question: string;
  answer: string | string[];
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
    question: "Jak się skontaktować ze wsparciem?",
    answer: "Napisz na: kontakt@jacekzieba.pl",
  },
];

export default function FAQPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <main style={{ flex: 1, maxWidth: "900px", marginInline: "auto", width: "100%", padding: "40px 24px" }}>
        <div style={{ marginBottom: 48 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.01em" }}>
            Najczęstsze pytania
          </h1>
          <p style={{ fontSize: 15, color: COLORS.textMuted }}>
            Odpowiedzi na popularne pytania dotyczące Zecca
          </p>
        </div>

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
      </main>

      <Footer />
    </div>
  );
}
