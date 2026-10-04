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
            {/* TODO: data publikacji — ustawić przy publikacji polityki */}
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
            <li>dane logowania prowadzone przez usługę uwierzytelniania Supabase: czas założenia konta i ostatniego logowania oraz — przy logowaniu przez Apple lub Google — dane tożsamości przekazane przez dostawcę,</li>
            <li>datę ukończenia wprowadzenia do aplikacji,</li>
            <li>neutralną etykietę urządzenia,</li>
            <li>identyfikator urządzenia wygenerowany przez aplikację,</li>
            <li>zaszyfrowane rekordy portfela,</li>
            <li>zaszyfrowaną kopię zapasową klucza synchronizacji.</li>
          </ul>

          <p style={{ marginBottom: 16 }}>
            Treść rekordów jest zaszyfrowana, ale do działania synchronizacji serwer przechowuje jawnie: typ i identyfikator każdego rekordu (np. transakcja, konto, wycena), czas jego utworzenia, zmiany i usunięcia, identyfikator urządzenia, które go zapisało, platformę urządzenia i czas jego ostatniej aktywności oraz parametry wyprowadzania klucza (KDF). Na tej podstawie można ustalić np. liczbę rekordów każdego typu i daty ich zmian, ale nie ich treść.
          </p>

          <p style={{ marginBottom: 16 }}>
            Supabase i Vercel (hosting wersji web) zapisują w technicznych dziennikach żądań m.in. adres IP i identyfikator przeglądarki lub aplikacji (User-Agent). W dziennikach Vercel znajdują się też adresy zapytań wersji web o dane rynkowe, które zawierają symbole instrumentów.
          </p>

          <p style={{ marginBottom: 16 }}>
            Zaszyfrowaną kopię klucza synchronizacji odblokowuje na nowym urządzeniu klucz wyprowadzany lokalnie: przy koncie z hasłem — z <strong>hasła Twojego konta</strong>, a przy logowaniu przez Apple lub Google (konto bez hasła) — z osobnej <strong>frazy synchronizacji</strong> (passphrase), którą ustawiasz w aplikacji. Zecca nie przechowuje hasła ani frazy na serwerze i nie używa ich po stronie serwera do odszyfrowywania danych. Fraza nie opuszcza Twojego urządzenia. Przy logowaniu hasłem do usługi uwierzytelniania trafia sekret logowania wyprowadzony z hasła funkcją jednokierunkową (PBKDF2), inny niż klucz, którym szyfrowana jest kopia klucza synchronizacji. Samo hasło nie jest wysyłane do serwera — także przy nieudanym logowaniu, zakładaniu konta, zmianie i resecie hasła.
          </p>

          <p style={{ marginBottom: 16 }}>
            Jeśli kopia klucza jest chroniona starszą, osobną frazą synchronizacji, a logujesz się hasłem konta, wystarczy raz podać tę frazę — kopia klucza zostaje wtedy ponownie zaszyfrowana hasłem konta i fraza przestaje być potrzebna. W aplikacjach na iOS i macOS dzieje się to przy logowaniu hasłem bez pytania o frazę, jeśli urządzenie ma już lokalnie klucz, którym da się odczytać dane zapisane na serwerze. Bez hasła konta (albo frazy synchronizacji) zaszyfrowanych danych nie da się odczytać — jeśli utracisz hasło lub frazę, nie odzyskamy danych.
          </p>

          <h2 style={{ fontSize: 21, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>
            Logowanie przez Apple lub Google
          </h2>

          <p style={{ marginBottom: 16 }}>
            Jeśli logujesz się przez Apple lub Google, otrzymujemy od tego dostawcy adres e-mail (w przypadku Apple może to być adres przekierowujący „Ukryj mój e-mail”) i techniczny identyfikator konta, a jeśli dostawca je przekaże — także imię i nazwisko oraz adres zdjęcia profilowego (zapisuje je usługa uwierzytelniania Supabase). Nie otrzymujemy Twojego hasła do Apple ani Google, ani dostępu do innych danych z tych kont.
          </p>

          <h2 style={{ fontSize: 21, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>
            Notowania i dane rynkowe
          </h2>

          <p style={{ marginBottom: 16 }}>
            Aby wyświetlać aktualne ceny, kursy walut, inflację i parametry obligacji, Zecca pobiera dane od publicznych dostawców: Yahoo Finance, CoinGecko, NBP, GUS, Bankier.pl, BiznesRadar, obligacjeskarbowe.pl oraz Finwire. Zapytanie zawiera wyłącznie symbol instrumentu, kod waluty lub serię obligacji, wyszukiwaną frazę oraz datę lub zakres dat — nigdy liczbę jednostek, kwoty, nazwy portfeli ani dane konta. W aplikacjach na iOS i macOS zapytania są wysyłane bezpośrednio z Twojego urządzenia, więc dostawca widzi Twój adres IP. W wersji web zapytania przechodzą przez serwer Zecca, a dostawca widzi adres serwera.
          </p>

          <h2 style={{ fontSize: 21, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>
            Dane lokalne w przeglądarce
          </h2>

          <p style={{ marginBottom: 16 }}>
            W przeglądarce Zecca zapisuje ustawienia interfejsu, profil wyświetlany w aplikacji (nazwa i zdjęcie, jeśli je ustawisz) wraz z preferencjami powiadomień, identyfikator urządzenia web, lokalną kolejkę synchronizacji oraz — jeśli włączysz blokadę aplikacji — jej ustawienia i skrót kodu PIN. Po odblokowaniu danych klucz odszyfrowywania jest zapamiętywany w IndexedDB tej przeglądarki, aby nie trzeba było go odblokowywać przy każdej wizycie. Klucz jest usuwany przy wylogowaniu.
          </p>

          <p style={{ marginBottom: 16 }}>
            Po zalogowaniu hasłem, założeniu konta lub ustawieniu nowego hasła hasło trafia na krótko do sessionStorage bieżącej karty, aby odblokować dane bez ponownego wpisywania. Jest ważne najwyżej 2 minuty; usuwamy je zaraz po użyciu i przy wylogowaniu, a przeglądarka — po zamknięciu karty.
          </p>

          <p style={{ marginBottom: 16 }}>
            Odszyfrowane dane portfela są przetwarzane w pamięci aktywnej karty. Pliki importu są parsowane lokalnie w przeglądarce, a eksporty są generowane lokalnie.
          </p>

          <h2 style={{ fontSize: 21, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>
            Telemetria produktowa
          </h2>

          <p style={{ marginBottom: 16 }}>
            Zecca może zbierać <strong>pseudonimową</strong> telemetrię produktową przez TelemetryDeck GmbH (Augsburg, Niemcy): użycie ekranów, importy (nazwa brokera i liczba wierszy podana w przedziale, np. 6–20), typ dodanej transakcji (np. kupno, wpłata) lub formę zatrudnienia przy dodanym zarobku (etat lub działalność), akcje synchronizacji, wersję i numer kompilacji aplikacji, platformę oraz wybrany tryb synchronizacji. W aplikacjach na iOS i macOS TelemetryDeck otrzymuje też zahaszowany, stały identyfikator urządzenia oraz parametry urządzenia i systemu, m.in. model urządzenia, wersję systemu, architekturę procesora, rozdzielczość i orientację ekranu, język, region, strefę czasową, ustawienia dostępności, sposób instalacji aplikacji (np. App Store, TestFlight) oraz statystyki sesji (liczba i długość sesji, liczba dni użycia, data pierwszego uruchomienia).
          </p>

          <p style={{ marginBottom: 16 }}>
            Telemetria <strong>nie zawiera</strong> kwot, tickerów, adresów e-mail, identyfikatorów portfeli ani identyfikatora konta synchronizacji. W wersji web TelemetryDeck otrzymuje zamiast identyfikatora urządzenia losowy identyfikator istniejący tylko w pamięci bieżącej karty; nie zapisujemy go w cookies, localStorage, sessionStorage ani IndexedDB. Telemetrię można wyłączyć w ustawieniach (w wersji web — po odblokowaniu danych).
          </p>

          <p style={{ marginBottom: 16 }}>
            Wersja web korzysta także z Vercel Analytics i Vercel Speed Insights do pomiaru odwiedzin, wydajności i stabilności strony (m.in. adres podstrony, typ przeglądarki i urządzenia, kraj). Te dane pomagają wykrywać problemy z wersją web, ale nie zawierają treści portfela, transakcji, tickerów ani importowanych plików.
          </p>

          <h2 style={{ fontSize: 21, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>
            Cookies i sesja
          </h2>

          <p style={{ marginBottom: 16 }}>
            Zecca używa cookies sesji Supabase wyłącznie do logowania, odświeżania sesji i ochrony dostępu do prywatnych części aplikacji. Są one niezbędne do usługi, o którą prosisz. W wersji demo ustawiamy dodatkowo sesyjne cookie <code>zecca-demo</code>, które oznacza, że przeglądasz dane przykładowe; znika po zakończeniu demo lub zamknięciu przeglądarki. Nie używamy cookies reklamowych, remarketingowych ani cookies TelemetryDeck.
          </p>

          <p style={{ marginBottom: 16 }}>
            Dlatego nie wyświetlamy banera cookies dla TelemetryDeck. Pozostałe lokalne magazyny przeglądarki służą wyłącznie działaniu funkcji wybranych przez użytkownika: ustawieniom interfejsu, kolejce zaszyfrowanej synchronizacji, blokadzie aplikacji, krótkiemu przekazaniu hasła po zalogowaniu i lokalnie zapamiętanemu kluczowi odszyfrowywania. Nie służą reklamie ani śledzeniu między witrynami. Jeżeli w przyszłości dodamy opcjonalne technologie wymagające zgody, poprosimy o nią przed ich użyciem.
          </p>

          <h2 style={{ fontSize: 21, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>
            Podstawy prawne
          </h2>

          <ul style={{ marginBottom: 16, paddingLeft: 20 }}>
            <li style={{ marginBottom: 8 }}>
              <strong>Konto i synchronizacja</strong> — wykonanie usługi, o którą prosisz (art. 6 ust. 1 lit. b RODO).
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>Telemetria produktowa</strong> — w aplikacjach na iOS i macOS Twoja zgoda, o którą pytamy przy pierwszym uruchomieniu (art. 6 ust. 1 lit. a RODO); w wersji web nasz prawnie uzasadniony interes w ulepszaniu aplikacji (art. 6 ust. 1 lit. f RODO). W obu przypadkach możesz ją w każdej chwili wyłączyć w ustawieniach (w wersji web — po odblokowaniu danych).
            </li>
            <li>
              <strong>Pomiar wydajności i statystyki odwiedzin strony (Vercel Analytics, Speed Insights)</strong> — prawnie uzasadniony interes w utrzymaniu działającej i bezpiecznej usługi (art. 6 ust. 1 lit. f RODO).
            </li>
          </ul>

          <h2 style={{ fontSize: 21, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>
            Komu powierzamy dane
          </h2>

          <p style={{ marginBottom: 16 }}>
            Dane przetwarzają w naszym imieniu następujący dostawcy:
          </p>

          <ul style={{ marginBottom: 16, paddingLeft: 20 }}>
            <li style={{ marginBottom: 8 }}>
              <strong>Supabase Inc.</strong> — konto, zaszyfrowane rekordy portfela i zaszyfrowana kopia klucza; dane przechowywane w Zurychu (Szwajcaria — kraj, wobec którego Komisja Europejska stwierdziła odpowiedni stopień ochrony danych).
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>Vercel Inc.</strong> — hosting wersji web, pośredniczenie w zapytaniach o dane rynkowe oraz statystyki odwiedzin i pomiar wydajności (Vercel Analytics, Vercel Speed Insights); funkcje serwerowe działają w regionie UE (Frankfurt).
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>TelemetryDeck GmbH</strong> (Niemcy) — telemetria produktowa.
            </li>
          </ul>

          <p style={{ marginBottom: 16 }}>
            Synchronizacja iCloud działa w ramach Twojego własnego konta Apple: jeśli ją wybierzesz, dane trafiają do Twojego prywatnego kontenera iCloud na zasadach, które łączą Cię z Apple. Zecca nie ma do nich dostępu.
          </p>

          <p style={{ marginBottom: 16 }}>
            Supabase i Vercel to firmy z USA. Jeśli dane trafiają poza Europejski Obszar Gospodarczy, odbywa się to na podstawie standardowych klauzul umownych zatwierdzonych przez Komisję Europejską lub decyzji o odpowiednim stopniu ochrony (EU-US Data Privacy Framework).
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
            Dane portfela na Twoim urządzeniu (tryb lokalny, iCloud) przechowujemy tak długo, jak korzystasz z aplikacji — usuwasz je samodzielnie, usuwając aplikację lub konkretne rekordy. Konto synchronizacji Zecca i powiązane z nim dane (e-mail, etykieta i identyfikator urządzenia, zaszyfrowane rekordy portfela, zaszyfrowana kopia klucza) przechowujemy do chwili usunięcia konta — usunięcie w aplikacji kasuje je trwale, bez okresu przejściowego. Usunięcie pojedynczego rekordu (np. transakcji) tylko oznacza go na serwerze jako usunięty; jego zaszyfrowana treść pozostaje tam do usunięcia konta, rozpoczęcia synchronizacji od nowa albo — po włączeniu automatycznego czyszczenia — najdłużej 180 dni. Kopie zapasowe infrastruktury (np. Supabase) mogą przechowywać usunięte dane przez ograniczony czas rotacji backupu, zanim zostaną nadpisane. Telemetria produktowa (TelemetryDeck) jest przechowywana zgodnie z domyślną retencją tego dostawcy i nie jest powiązana z Twoim kontem ani tożsamością.
          </p>

          <h2 style={{ fontSize: 21, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>
            Co się zmienia, gdy wyłączysz synchronizację lub telemetrię
          </h2>

          <p style={{ marginBottom: 16 }}>
            Wyłączenie prywatnej synchronizacji Zecca lub iCloud nie usuwa danych już przesłanych. Z serwera Zecca usuwasz je, kasując konto; z iCloud — usuwając rekordy w aplikacji, dopóki synchronizacja iCloud jest włączona. Po wyłączeniu nowe zmiany zostają wyłącznie lokalnie na urządzeniu, na którym je wprowadzasz, i przestają się pojawiać na pozostałych Twoich urządzeniach. Wyłączenie telemetrii produktowej zatrzymuje wysyłanie nowych zdarzeń natychmiast; nie wpływa to na działanie żadnej funkcji aplikacji.
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
