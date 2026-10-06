import type { CSSProperties, ReactNode } from "react";

/**
 * Publiczna kontrolka wycofania / zmiany zgody na statystyki użycia (RODO art.
 * 7 ust. 3: wycofanie ma być tak proste jak udzielenie). Czyści zapisaną
 * decyzję — analityka staje od razu, a pytanie wraca. Obsługę kliknięcia daje
 * delegowany listener w AnalyticsConsentGate, więc to zwykły przycisk, który
 * działa także w komponentach serwerowych.
 */
export function AnalyticsConsentReset({
  className,
  style,
  children = "Zmień decyzję o statystykach użycia",
}: {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      data-analytics-consent-reset=""
      className={["consent-reset", className].filter(Boolean).join(" ")}
      style={style}
    >
      {children}
    </button>
  );
}
