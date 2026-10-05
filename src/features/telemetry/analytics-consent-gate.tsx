"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { isTelemetryForcedOff } from "@/lib/telemetry";
import {
  clearAnalyticsConsent,
  hasAnalyticsConsent,
  setAnalyticsConsent,
} from "@/lib/analytics-consent";
import { useAnalyticsConsent } from "@/features/telemetry/use-analytics-consent";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * Każde zdarzenie Vercel (Analytics i Speed Insights) przechodzi tędy.
 * - Bez zgody odrzuca: skrypt raz wczytany zostaje w pamięci karty aż do
 *   przeładowania, więc samo odmontowanie komponentów nie wystarcza.
 * - Ze zgodą wycina z adresu identyfikatory (UUID → `:id`), query i hash —
 *   adres konkretnego portfela nie trafia do analityki.
 */
function prepareAnalyticsEvent<T extends { url: string }>(event: T): T | null {
  if (!hasAnalyticsConsent()) return null;
  const [path] = event.url.split(/[?#]/);
  return { ...event, url: path!.replace(UUID, ":id") };
}

/**
 * Bramka analityki — pierwsza w <body> root layoutu (strony publiczne
 * i aplikacja), więc pytanie jest pierwsze w kolejności Tab, ale nie kradnie
 * fokusu. Vercel Analytics i Speed Insights montuje dopiero po zgodzie — ich
 * skrypty wstrzykuje dopiero efekt komponentu, sam import niczego nie ładuje.
 *
 * Kontrolki „zmień decyzję” (stopka, landing, polityka prywatności) to zwykłe
 * przyciski z atrybutem `data-analytics-consent-reset`; obsługuje je jeden
 * delegowany listener tutaj, więc działają też w statycznym HTML landingu.
 */
export function AnalyticsConsentGate() {
  const consent = useAnalyticsConsent();

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as Element | null;
      if (!target?.closest?.("[data-analytics-consent-reset]")) return;
      clearAnalyticsConsent();
      // Odwiedzający sam poprosił o pytanie — przenosimy do niego fokus.
      requestAnimationFrame(() => document.getElementById("analytics-consent")?.focus());
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  if (isTelemetryForcedOff()) return null;

  if (consent === "granted") {
    return (
      <>
        <Analytics beforeSend={prepareAnalyticsEvent} />
        <SpeedInsights beforeSend={prepareAnalyticsEvent} />
      </>
    );
  }
  if (consent === null) return <AnalyticsConsentPrompt />;
  return null;
}

function AnalyticsConsentPrompt() {
  const ref = useRef<HTMLElement>(null);

  // Pytanie jest przyklejone do dołu ekranu. Dopełnienie <body> o jego wysokość
  // pozwala przewinąć stronę tak, by nic (np. „Zaloguj się”) nie zostało pod nim.
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const previous = document.body.style.paddingBottom;
    // Od górnej krawędzi pytania do dołu okna — z odstępem i ewentualnym
    // podniesieniem nad plakietką „Dane przykładowe”.
    const apply = () => {
      const top = element.getBoundingClientRect().top;
      document.body.style.paddingBottom = `${Math.max(0, window.innerHeight - top) + 16}px`;
    };
    apply();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(apply);
    observer?.observe(element);
    window.addEventListener("resize", apply);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", apply);
      document.body.style.paddingBottom = previous;
    };
  }, []);

  return (
    <section
      ref={ref}
      id="analytics-consent"
      tabIndex={-1}
      className="analytics-consent"
      aria-labelledby="analytics-consent-title"
      aria-describedby="analytics-consent-body"
    >
      <h2 id="analytics-consent-title" className="analytics-consent__title">
        Pomóż ulepszać Zecca
      </h2>
      <p id="analytics-consent-body" className="analytics-consent__body">
        Za zgodą zbieramy statystyki użycia (TelemetryDeck, Vercel Analytics):
        które ekrany działają i jak szybko się ładują. Bez kwot, tickerów
        i treści portfela. Decyzję zmienisz w każdej chwili w{" "}
        <Link href="/privacy-policy">polityce prywatności</Link> lub
        w Ustawieniach.
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
