/** Data wejścia w życie polityki prywatności (RRRR-MM-DD) — jedno źródło dla
 *  strony /privacy-policy i powiadomienia w aplikacji (policy-update-notice.tsx),
 *  które z niej buduje klucz „już widziane”. Nowa data = każdy zobaczy
 *  powiadomienie jeszcze raz, więc przy jej zmianie popraw też
 *  PRIVACY_POLICY_CHANGES. */
export const PRIVACY_POLICY_EFFECTIVE_DATE = "2026-10-06";

/** Ta sama data po polsku, np. „6 października 2026”. */
export const PRIVACY_POLICY_EFFECTIVE_DATE_LABEL = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
}).format(new Date(`${PRIVACY_POLICY_EFFECTIVE_DATE}T00:00:00Z`));

/** Co się zmieniło w tej wersji — jedno zdanie do powiadomienia w aplikacji. */
export const PRIVACY_POLICY_CHANGES =
  "statystyki użycia tylko za Twoją zgodą, dokładniejszy opis danych i dostawców";
