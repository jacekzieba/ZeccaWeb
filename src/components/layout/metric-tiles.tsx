import type { ReactNode } from "react";

/** Kafelek wskaźnika z cechą źródła.
 *
 * Kierunek „Skarbiec": każda liczba ma źródło, jednostkę i moment sprawdzenia.
 * Wcześniej cechy stały po lewej stronie szyny, a wskaźniki tworzyły rejestr
 * wierszy — przy dziesięciu pozycjach czytało się to jak jedna bryła. Cecha
 * przenosi się więc do kafelka i stoi nad nazwą wskaźnika: reguła zostaje,
 * zmienia się nośnik.
 *
 * Na cechę wchodzą wyłącznie rzeczy weryfikowalne — źródło, podstawa liczenia,
 * jednostka, liczba obserwacji. Nigdy hasło.
 * Specyfikacja: docs/superpowers/specs/2026-09-07-design-system-skarbiec-design.md */
export type MetricRow = {
  key: string;
  /** Źródło albo podstawa liczenia — pierwszy człon cechy. */
  source: string;
  /** Doprecyzowanie cechy — jednostka, zakres, metoda. */
  detail: string;
  label: string;
  value: string;
  color?: string;
  /** Pod liczbą tylko wtedy, gdy cecha tego jeszcze nie powiedziała. */
  sub?: string;
  /** Odnośnik do wyjaśnienia wskaźnika. */
  helpHref?: string;
  trailing?: ReactNode;
};

export function MetricTiles({ rows }: { rows: MetricRow[] }) {
  if (!rows.length) return null;
  return (
    <div className="metric-tiles">
      {rows.map((row) => {
        const sub =
          row.sub && row.sub.toLowerCase() !== row.detail.toLowerCase() ? row.sub : "";
        return (
          <article className="metric-tile" key={row.key}>
            <span className="metric-tile-mark">
              {row.source}
              <em>{row.detail}</em>
            </span>
            <span className="metric-tile-label">
              {row.label}
              {row.helpHref && (
                <a
                  className="metric-tile-help"
                  href={row.helpHref}
                  aria-label={`Wyjaśnienie: ${row.label}`}
                >
                  ?
                </a>
              )}
            </span>
            <span
              className="metric-tile-value"
              style={row.color ? { color: row.color } : undefined}
            >
              {row.value}
            </span>
            {sub ? <span className="metric-tile-sub">{sub}</span> : null}
          </article>
        );
      })}
    </div>
  );
}
