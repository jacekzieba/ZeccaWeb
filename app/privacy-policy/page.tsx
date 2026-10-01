import { COLORS } from "@/lib/design-tokens";
import { Footer } from "@/components/layout/footer";

export const metadata = {
  title: "Polityka prywatności - Zecca",
  description: "Polityka prywatności Zecca",
  alternates: {
    canonical: "/privacy-policy",
  },
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
          <h1 style={{ fontSize: 31, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.01em" }}>
            Polityka prywatności Zecca
          </h1>

          <p style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 24 }}>
            <strong>Data wejścia w życie:</strong> 1 października 2026
          </p>

          <div style={{ marginBottom: 24 }}>
            <p>
              <strong>Administrator danych:</strong> Jacek Zięba
            </p>
            <p>
              <strong>Kontakt:</strong> kontakt@jacekzieba.pl
            </p>
          </div>

          <h2 style={{ fontSize: 21, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>
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
            Zaszyfrowaną kopię klucza synchronizacji odblokowuje na nowym urządzeniu klucz wyprowadzany lokalnie z <strong>hasła Twojego konta</strong>. Zecca nie przechowuje hasła w postaci jawnej i nie używa go po stronie serwera do odszyfrowywania danych; samo hasło nie opuszcza Twojego urządzenia — do usługi uwierzytelniania trafia wyłącznie sekret logowania wyprowadzony z hasła funkcją jednokierunkową (PBKDF2), inny niż klucz, którym szyfrowana jest kopia klucza synchronizacji. Konta założone przed tą zmianą przesyłają hasło jeden raz, przy pierwszym logowaniu po aktualizacji, po czym zostają przestawione na sekret. Jeśli wcześniej ustawiłeś osobną frazę synchronizacji (passphrase), przy najbliższym logowaniu kopia klucza zostaje przepięta na hasło konta, a fraza przestaje być potrzebna. Bez hasła zaszyfrowanych danych nie da się odczytać, a jeśli je utracisz, nie jesteśmy w stanie ich odzyskać.
          </p>

          <h2 style={{ fontSize: 21, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>
            Logowanie przez Apple lub Google
          </h2>

          <p style={{ marginBottom: 16 }}>
            Jeśli logujesz się przez Apple lub Google, otrzymujemy od tego dostawcy adres e-mail (w przypadku Apple może to być adres przekierowujący „Ukryj mój e-mail”) i techniczny identyfikator konta. Nie otrzymujemy Twojego hasła do Apple ani Google ani dostępu do innych danych z tych kont.
          </p>

          <h2 style={{ fontSize: 21, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>
            Notowania i dane rynkowe
          </h2>

          <p style={{ marginBottom: 16 }}>
            Żeby pokazać aktualne ceny, kursy walut, inflację i parametry obligacji, Zecca pobiera dane od publicznych dostawców: Yahoo Finance, CoinGecko, NBP, GUS, Bankier.pl, BiznesRadar, obligacjeskarbowe.pl oraz Finwire. Zapytanie zawiera wyłącznie symbol instrumentu lub serię obligacji — nigdy liczbę jednostek, kwoty, nazwy portfeli ani dane konta. W aplikacjach na iOS i macOS zapytania idą bezpośrednio z Twojego urządzenia, więc dostawca widzi Twój adres IP. W wersji web zapytania przechodzą przez serwer Zecca, a dostawca widzi adres serwera.
          </p>

          <h2 style={{ fontSize: 21, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>
            Dane lokalne w przeglądarce
          </h2>

          <p style={{ marginBottom: 16 }}>
            W przeglądarce Zecca zapisuje ustawienia interfejsu, preferencje profilu, identyfikator urządzenia web oraz lokalną kolejkę synchronizacji. Opcjonalnie w IndexedDB może zostać zapamiętany klucz odszyfrowywania, jeśli wybierzesz zaufanie tej przeglądarce. Klucz jest usuwany przy wylogowaniu.
          </p>

          <p style={{ marginBottom: 16 }}>
            Odszyfrowane dane portfela są przetwarzane w pamięci aktywnej karty. Pliki importu są parsowane lokalnie w przeglądarce, a eksporty są generowane lokalnie.
          </p>

          <h2 style={{ fontSize: 21, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>
            Telemetria produktowa
          </h2>

          <p style={{ marginBottom: 16 }}>
            Zecca może zbierać <strong>zanonimizowaną</strong> telemetrię produktową przez TelemetryDeck GmbH (Augsburg, Niemcy): użycie ekranów, importy, akcje synchronizacji, wersję i numer kompilacji aplikacji, platformę oraz wybrany tryb synchronizacji.
          </p>

          <p style={{ marginBottom: 16 }}>
            Telemetria <strong>nie zawiera</strong> kwot, tickerów, adresów e-mail, identyfikatorów portfeli ani identyfikatora konta synchronizacji. Na webie TelemetryDeck otrzymuje wyłącznie losowy identyfikator istniejący w pamięci bieżącej karty; nie zapisujemy go w cookies, localStorage, sessionStorage ani IndexedDB. Można ją wyłączyć w ustawieniach.
          </p>

          <p style={{ marginBottom: 16 }}>
            Webowa wersja Zecca korzysta także z Vercel Analytics i Vercel Speed Insights do technicznego pomiaru odwiedzin, wydajności i stabilności strony. Te dane pomagają wykrywać problemy z aplikacją web, ale nie zawierają treści portfela, transakcji, tickerów ani importowanych plików.
          </p>

          <p style={{ marginBottom: 16 }}>
            Do wykrywania i diagnozowania awarii aplikacji webowej korzystamy z Sentry (Functional Software, Inc.), z przechowywaniem danych w regionie UE (Niemcy). Sentry otrzymuje wyłącznie <strong>techniczne informacje o błędzie</strong>: typ błędu i ślad stosu, wersję i numer kompilacji aplikacji oraz typ przeglądarki. Zgłoszenia <strong>nie zawierają</strong> kwot, tickerów, treści portfela, adresów e-mail, tokenów sesji, zawartości formularzy ani parametrów adresu URL — dane te są usuwane przed wysłaniem. Zgłoszenia wysyłane są wyłącznie z produkcyjnej wersji aplikacji.
          </p>

          <h2 style={{ fontSize: 21, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>
            Cookies i sesja
          </h2>

          <p style={{ marginBottom: 16 }}>
            Zecca używa cookies sesji Supabase wyłącznie do logowania, odświeżania sesji i ochrony dostępu do prywatnych części aplikacji. Są one niezbędne do usługi, o którą prosisz. Nie używamy cookies reklamowych, remarketingowych ani cookies TelemetryDeck.
          </p>

          <p style={{ marginBottom: 16 }}>
            Dlatego nie wyświetlamy baneru cookies dla TelemetryDeck. Pozostałe lokalne magazyny przeglądarki służą wyłącznie działaniu funkcji wybranych przez użytkownika: ustawieniom interfejsu, kolejce zaszyfrowanej synchronizacji i — gdy to wybierzesz — lokalnie zapamiętanemu kluczowi odszyfrowywania. Nie służą reklamie ani śledzeniu między witrynami. Jeżeli w przyszłości dodamy opcjonalne technologie wymagające zgody, poprosimy o nią przed ich użyciem.
          </p>

          <h2 style={{ fontSize: 21, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>
            Podstawy prawne
          </h2>

          <ul style={{ marginBottom: 16, paddingLeft: 20 }}>
            <li style={{ marginBottom: 8 }}>
              <strong>Konto i synchronizacja</strong> — wykonanie usługi, o którą prosisz (art. 6 ust. 1 lit. b RODO).
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>Telemetria produktowa</strong> — w aplikacjach na iOS i macOS Twoja zgoda, o którą pytamy przy pierwszym uruchomieniu (art. 6 ust. 1 lit. a RODO); w wersji web nasz prawnie uzasadniony interes w ulepszaniu aplikacji (art. 6 ust. 1 lit. f RODO). W obu przypadkach możesz ją w każdej chwili wyłączyć w ustawieniach.
            </li>
            <li>
              <strong>Diagnostyka błędów i pomiar wydajności strony</strong> — prawnie uzasadniony interes w utrzymaniu działającej i bezpiecznej usługi (art. 6 ust. 1 lit. f RODO).
            </li>
          </ul>

          <h2 style={{ fontSize: 21, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>
            Komu powierzamy dane
          </h2>

          <p style={{ marginBottom: 16 }}>
            Dane przetwarzają w naszym imieniu wyłącznie dostawcy infrastruktury:
          </p>

          <ul style={{ marginBottom: 16, paddingLeft: 20 }}>
            <li style={{ marginBottom: 8 }}>
              <strong>Supabase Inc.</strong> — konto, zaszyfrowane rekordy portfela i zaszyfrowana kopia klucza; dane przechowywane w Zurychu (Szwajcaria — kraj, wobec którego Komisja Europejska stwierdziła odpowiedni stopień ochrony danych).
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>Vercel Inc.</strong> — hosting wersji web i pośredniczenie w zapytaniach o dane rynkowe; funkcje serwerowe działają w regionie UE (Frankfurt).
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>TelemetryDeck GmbH</strong> (Niemcy) — telemetria produktowa.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>Functional Software, Inc. (Sentry)</strong> — diagnostyka błędów wersji web, dane w UE.
            </li>
            <li>
              <strong>Apple</strong> — jeśli wybierzesz synchronizację iCloud, dane trafiają do Twojego prywatnego kontenera iCloud na zasadach Twojego konta Apple; Zecca nie ma do nich dostępu.
            </li>
          </ul>

          <p style={{ marginBottom: 16 }}>
            Supabase, Vercel i Sentry to firmy z USA. Jeśli dane trafiają poza Europejski Obszar Gospodarczy, odbywa się to na podstawie standardowych klauzul umownych zatwierdzonych przez Komisję Europejską lub decyzji o odpowiednim stopniu ochrony (EU-US Data Privacy Framework).
          </p>

          <h2 style={{ fontSize: 21, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>
            Śledzenie
          </h2>

          <p style={{ marginBottom: 16 }}>
            Zecca <strong>nie używa</strong> zebranych danych do śledzenia Cię w innych aplikacjach ani witrynach.
          </p>

          <h2 style={{ fontSize: 21, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>
            Ile czasu przechowujemy dane
          </h2>

          <p style={{ marginBottom: 16 }}>
            Dane portfela na Twoim urządzeniu (lokalny tryb, iCloud) przechowujemy tak długo, jak korzystasz z aplikacji — usuwasz je sam, usuwając aplikację lub konkretne rekordy. Konto synchronizacji Zecca i powiązane z nim dane (e-mail, etykieta i identyfikator urządzenia, zaszyfrowane rekordy portfela, zaszyfrowana kopia klucza) przechowujemy do chwili usunięcia konta — usunięcie w aplikacji kasuje je trwale, bez okresu przejściowego. Kopie zapasowe infrastruktury (np. Supabase) mogą przechowywać usunięte dane przez ograniczony czas rotacji backupu, zanim zostaną nadpisane. Dane diagnostyczne (Sentry) i telemetria produktowa (TelemetryDeck) są przechowywane zgodnie z domyślną retencją tych dostawców i nie są powiązane z Twoim kontem ani tożsamością.
          </p>

          <h2 style={{ fontSize: 21, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>
            Co się zmienia, gdy wyłączysz synchronizację lub telemetrię
          </h2>

          <p style={{ marginBottom: 16 }}>
            Wyłączenie prywatnej synchronizacji Zecca lub iCloud nie usuwa danych już przesłanych — usuwasz je osobno, kasując konto lub konkretne rekordy. Po wyłączeniu nowe zmiany zostają wyłącznie lokalnie na urządzeniu, na którym je wprowadzasz, i przestają się pojawiać na pozostałych Twoich urządzeniach. Wyłączenie telemetrii produktowej zatrzymuje wysyłanie nowych zdarzeń natychmiast; nie wpływa to na działanie żadnej funkcji aplikacji.
          </p>

          <h2 style={{ fontSize: 21, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>
            Twoje prawa
          </h2>

          <p style={{ marginBottom: 16 }}>
            Masz prawo dostępu do swoich danych, ich sprostowania, usunięcia, ograniczenia przetwarzania i przeniesienia (eksport danych jest dostępny w aplikacji), a także prawo sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie i prawo wycofania zgody w dowolnym momencie — bez wpływu na zgodność z prawem przetwarzania sprzed jej wycofania. Konto i powiązane z nim dane synchronizacji usuniesz bezpośrednio w aplikacji (na iOS i macOS: Ustawienia → Konto i synchronizacja → Usuń konto Zecca; w wersji web: Ustawienia → Usuń konto) lub pisząc na adres kontakt@jacekzieba.pl. Masz też prawo wnieść skargę do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193 Warszawa).
          </p>

          <h2 style={{ fontSize: 21, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>
            Zmiany w tej polityce
          </h2>

          <p style={{ marginBottom: 16 }}>
            Jeśli zmienimy tę politykę w sposób, który wpływa na to, jakie dane zbieramy lub jak ich używamy, zaktualizujemy datę wejścia w życie na górze tej strony i — przy istotnych zmianach — poinformujemy Cię w aplikacji przed ich wejściem w życie.
          </p>

          <h2 style={{ fontSize: 21, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>
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
