"use client";

import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { isTelemetryForcedOff } from "@/lib/telemetry";
import {
  hasAnalyticsConsent,
  setAnalyticsConsent,
  useAnalyticsConsent,
} from "@/features/telemetry/analytics-consent";

// Skrypt Vercel raz wczytany zostaje w pamięci karty aż do przeładowania, więc
// samo odmontowanie komponentów nie wystarcza: każde zdarzenie przechodzi przez
// beforeSend, który po wycofaniu zgody je odrzuca.
function keepOnlyWithConsent<T>(event: T): T | null {
  return hasAnalyticsConsent() ? event : null;
}

/**
 * Bramka analityki w root layoucie (strony publiczne i aplikacja). Vercel
 * Analytics i Speed Insights montuje dopiero po zgodzie — ich skrypty wstrzykuje
 * dopiero efekt komponentu, sam import niczego nie ładuje. Odwiedzającemu bez
 * decyzji pokazuje nieblokujące pytanie.
 */
export function AnalyticsConsentGate() {
  const consent = useAnalyticsConsent();
  if (isTelemetryForcedOff()) return null;

  if (consent === "granted") {
    return (
      <>
        <Analytics beforeSend={keepOnlyWithConsent} />
        <SpeedInsights beforeSend={keepOnlyWithConsent} />
      </>
    );
  }
  if (consent === null) return <AnalyticsConsentPrompt />;
  return null;
}

function AnalyticsConsentPrompt() {
  return (
    <section
      className="analytics-consent"
      aria-labelledby="analytics-consent-title"
      aria-describedby="analytics-consent-body"
    >
      <h2 id="analytics-consent-title" className="analytics-consent__title">
        Pomóż ulepszać Zecca
      </h2>
      <p id="analytics-consent-body" className="analytics-consent__body">
        Za Twoją zgodą zbieramy statystyki użycia: które ekrany działają, gdzie
        występują błędy i jak szybko ładują się strony (TelemetryDeck, Vercel
        Analytics). Nigdy nie wysyłamy kwot, tickerów ani treści portfela.
        Zmienisz to w każdej chwili w Ustawieniach.{" "}
        <Link href="/privacy-policy">Polityka prywatności</Link>
      </p>
      <div className="analytics-consent__actions">
        <button type="button" onClick={() => setAnalyticsConsent("granted")}>
          Zgadzam się
        </button>
        <button type="button" onClick={() => setAnalyticsConsent("denied")}>
          Nie, dziękuję
        </button>
      </div>
    </section>
  );
}
