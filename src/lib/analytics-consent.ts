// Czysty magazyn bez Reacta: serwis telemetrii (src/lib/telemetry) sprawdza tu
// zgodę przy każdym sygnale, a importują go też serwerowe strony (TelemetryEvent).
// Hook dla komponentów: src/features/telemetry/use-analytics-consent.ts.
//
// Zgoda na statystyki użycia (TelemetryDeck, Vercel Analytics i Speed Insights)
// w tej przeglądarce — opt-in, jak pytanie przy pierwszym uruchomieniu w
// aplikacjach iOS/macOS. Brak zapisanej decyzji znaczy „nie”. Wybór jest
// lokalny (nie trafia do synchronizowanych ustawień), więc publiczne kontrolki
// (stopka, polityka prywatności) zmieniają go bez logowania. Wersja w kluczu:
// zmiana zakresu zgody = nowe pytanie.

export const ANALYTICS_CONSENT_KEY = "zecca-web-analytics-consent-v1";

export type AnalyticsConsentChoice = "granted" | "denied";
/** `null` — odwiedzający jeszcze nie zdecydował (analityka wyłączona). */
export type AnalyticsConsent = AnalyticsConsentChoice | null;

const listeners = new Set<() => void>();
// Gdy localStorage rzuca (tryb prywatny, zablokowane dane witryny), wybór
// obowiązuje do zamknięcia karty.
let fallback: AnalyticsConsent = null;

function parse(value: string | null): AnalyticsConsent {
  return value === "granted" || value === "denied" ? value : null;
}

export function getAnalyticsConsent(): AnalyticsConsent {
  if (typeof window === "undefined") return null;
  try {
    return parse(window.localStorage.getItem(ANALYTICS_CONSENT_KEY));
  } catch {
    return fallback;
  }
}

export function hasAnalyticsConsent(): boolean {
  return getAnalyticsConsent() === "granted";
}

export function setAnalyticsConsent(choice: AnalyticsConsentChoice) {
  fallback = choice;
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, choice);
  } catch {
    // Zostaje `fallback`.
  }
  for (const listener of listeners) listener();
}

/**
 * Wycofanie decyzji z kontrolek publicznych (stopka, polityka prywatności):
 * analityka staje od razu, a pytanie wraca, bo brak decyzji = „nie”.
 */
export function clearAnalyticsConsent() {
  fallback = null;
  try {
    window.localStorage.removeItem(ANALYTICS_CONSENT_KEY);
  } catch {
    // Zostaje `fallback`.
  }
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent) {
  // Wycofanie zgody w innej karcie ma działać i tutaj.
  if (event.key !== ANALYTICS_CONSENT_KEY) return;
  for (const listener of listeners) listener();
}

export function subscribeAnalyticsConsent(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}
