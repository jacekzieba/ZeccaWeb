import { COLORS, TYPOGRAPHY } from "@/lib/design-tokens";
import { Footer } from "@/components/layout/footer";

export const metadata = {
  title: "Polityka prywatności - Zecca",
  description: "Polityka prywatności Zecca",
};

export default function PrivacyPolicyPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <main style={{ flex: 1, maxWidth: "900px", marginInline: "auto", width: "100%", padding: "40px 24px" }}>
        <article
          style={{
            fontSize: 15,
            lineHeight: 1.6,
            color: COLORS.text,
          }}
        >
          <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.01em" }}>
            Polityka prywatności Zecca
          </h1>

          <p style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 24 }}>
            <strong>Data wejścia w życie:</strong> 13 czerwca 2026
          </p>

          <div style={{ marginBottom: 24 }}>
            <p>
              <strong>Administrator danych:</strong> Jacek Zięba
            </p>
            <p>
              <strong>Kontakt:</strong> kontakt@jacekzieba.pl
            </p>
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>
            Jakie dane przetwarza Zecca
          </h2>

          <p style={{ marginBottom: 16 }}>
            Zecca domyślnie przechowuje dane Twojego portfela <strong>na urządzeniu</strong>.
          </p>

          <ul style={{ marginBottom: 16, paddingLeft: 20 }}>
            <li style={{ marginBottom: 8 }}>
              <strong>Synchronizacja iCloud (opcjonalna):</strong> jeśli ją włączysz, dane są przechowywane w Twoim prywatnym kontenerze Apple iCloud.
            </li>
            <li>
              <strong>Prywatna synchronizacja Zecca (opcjonalna):</strong> jeśli ją włączysz, rekordy portfela są <strong>szyfrowane na urządzeniu</strong> przed wysłaniem do Supabase.
            </li>
          </ul>

          <p style={{ marginBottom: 16 }}>Konto synchronizacji Zecca przechowuje:</p>

          <ul style={{ marginBottom: 16, paddingLeft: 20 }}>
            <li>adres e-mail konta,</li>
            <li>neutralną etykietę urządzenia,</li>
            <li>identyfikator urządzenia wygenerowany przez aplikację,</li>
            <li>zaszyfrowane rekordy portfela,</li>
            <li>zaszyfrowaną kopię zapasową klucza synchronizacji.</li>
          </ul>

          <p style={{ marginBottom: 16 }}>
            Do odblokowania zaszyfrowanej kopii klucza synchronizacji na nowym urządzeniu służy <strong>osobna fraza synchronizacji (passphrase)</strong>, którą ustalasz przy włączaniu prywatnej synchronizacji Zecca. Fraza nie jest tożsama z hasłem konta i nie jest przechowywana na serwerze — bez niej zaszyfrowanych danych nie da się odczytać.
          </p>

          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>
            Telemetria produktowa
          </h2>

          <p style={{ marginBottom: 16 }}>
            Zecca może zbierać <strong>anonimową</strong> telemetrię produktową: użycie ekranów, importy, akcje synchronizacji, wersję i numer kompilacji aplikacji, platformę oraz wybrany tryb synchronizacji.
          </p>

          <p style={{ marginBottom: 16 }}>
            Telemetria <strong>nie zawiera</strong> kwot, tickerów, adresów e-mail ani identyfikatorów portfeli. Można ją wyłączyć w ustawieniach.
          </p>

          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>
            Śledzenie
          </h2>

          <p style={{ marginBottom: 16 }}>
            Zecca <strong>nie używa</strong> zebranych danych do śledzenia Cię w innych aplikacjach ani witrynach.
          </p>

          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>
            Twoje prawa
          </h2>

          <p style={{ marginBottom: 16 }}>
            Masz prawo do dostępu do swoich danych, ich poprawienia oraz usunięcia. Konto i powiązane z nim dane synchronizacji możesz usunąć bezpośrednio w aplikacji (Ustawienia → Konto → Usuń konto) lub kontaktując się pod adresem kontakt@jacekzieba.pl.
          </p>

          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>
            Kontakt
          </h2>

          <p style={{ marginBottom: 16 }}>
            W sprawach dotyczących prywatności napisz na: <strong>kontakt@jacekzieba.pl</strong>
          </p>
        </article>
      </main>

      <Footer />
    </div>
  );
}
