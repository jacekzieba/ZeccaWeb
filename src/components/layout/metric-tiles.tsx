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
  /** Jeden wyróżniony kafelek w rejestrze — większa wartość plus ślad w tle
   * (patrz sparkline). Reszta neutralnieje, żeby było wiadomo, na co patrzeć
   * najpierw — nie przez nową ramkę czy kolor, tylko przez rozmiar i treść. */
  featured?: boolean;
  /** Ślad wartości w czasie pod liczbą kafelka featured — najstarsza wartość
   * pierwsza. Ignorowany bez `featured` i przy mniej niż dwóch punktach. */
  sparkline?: number[];
};

/** Punkty i obszar pod krzywą dla mini-wykresu w tle kafelka — ten sam
 * viewBox 200×40 niezależnie od liczby próbek, żeby zawsze wypełniał
 * dostępną szerokość (preserveAspectRatio="none" na <svg>). */
function buildSparkline(values: number[]) {
  const width = 200;
  const height = 40;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => ({
    x: (index / (values.length - 1)) * width,
    y: height - ((value - min) / range) * height,
  }));
  const line = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1]!;
  const area = `M${points[0]!.x.toFixed(1)},${height} L${line} L${last.x.toFixed(1)},${height} Z`;
  return { line, area, last };
}

function MetricSparkline({ rowKey, values, color }: { rowKey: string; values: number[]; color: string }) {
  const spark = buildSparkline(values);
  const gradientId = `metric-spark-${rowKey}`;
  return (
    <svg className="metric-tile-spark" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={spark.area} fill={`url(#${gradientId})`} />
      <polyline points={spark.line} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <circle cx={spark.last.x} cy={spark.last.y} r="2.5" fill={color} />
    </svg>
  );
}

export function MetricTiles({ rows }: { rows: MetricRow[] }) {
  if (!rows.length) return null;
  return (
    <div className="metric-tiles">
      {rows.map((row) => {
        const sub =
          row.sub && row.sub.toLowerCase() !== row.detail.toLowerCase() ? row.sub : "";
        return (
          // Wysokość jawnie "auto": kafelek bywa jedynym wskaźnikiem w komórce
          // siatki obok wyższej sekcji (np. wykresu) — SectionGrid rozciąga
          // komórkę do wspólnej wysokości wiersza, a bez tej deklaracji kafelek
          // rozciągnąłby się razem z nią zamiast zostać przy naturalnej treści.
          <article
            className={row.featured ? "metric-tile metric-tile--featured" : "metric-tile"}
            style={{ height: "auto" }}
            key={row.key}
          >
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
            {row.featured && row.sparkline && row.sparkline.length > 1 && (
              <MetricSparkline rowKey={row.key} values={row.sparkline} color={row.color ?? "currentColor"} />
            )}
            {sub ? <span className="metric-tile-sub">{sub}</span> : null}
          </article>
        );
      })}
    </div>
  );
}
