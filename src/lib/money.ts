export function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCurrencyCompact(value: number, currency: string) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Format a numeric axis tick into a compact "k"/"M" label, choosing just
 * enough decimals that adjacent ticks (spaced ~range/4 apart) stay distinct.
 * Prevents collapses like five identical "10k" labels on a narrow value range
 * — the design's chart only avoids this because its mock data spans a wide range.
 */
export function formatAxisValue(value: number, range: number): string {
  const step = Math.abs(range) / 4 || Math.abs(value) || 1;
  const decimalsFor = (unitStep: number) => (unitStep >= 1 ? 0 : unitStep >= 0.1 ? 1 : 2);
  const withComma = (n: string) => n.replace(".", ",");
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${withComma((value / 1_000_000).toFixed(decimalsFor(step / 1_000_000)))}M`;
  }
  if (abs >= 1_000) {
    return `${withComma((value / 1_000).toFixed(decimalsFor(step / 1_000)))}k`;
  }
  return `${Math.round(value)}`;
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat("pl-PL", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

/** Etykieta waluty przy kwocie.
 *
 * Złoty ma w polszczyźnie symbol i tak go pisze `Intl` na landingu
 * („306 424 zł"). Aplikacja doklejała po liczbie kod ISO („301 765 PLN"),
 * więc ta sama kwota miała dwa zapisy w zależności od tego, gdzie się na nią
 * patrzyło. Kod zostaje tam, gdzie nazywa walutę — w kolumnie transakcji,
 * przy kursie NBP, w wyborze waluty bazowej — bo tam identyfikuje, a nie mierzy. */
export function currencyLabel(code: string) {
  return code === "PLN" ? "zł" : code;
}

/** Procent po polsku — z przecinkiem.
 *
 * `toFixed` daje kropkę, więc udziały renderowały się jako `33.3%` w tym samym
 * wierszu tabeli, co `0,1500` z przecinkiem. Trzy polityki separatora na jednym
 * ekranie to nie różnica stylu, tylko dwa zapisy tej samej wielkości. */
export function formatShare(value: number, decimals = 1): string {
  return `${value.toFixed(decimals).replace(".", ",")}%`;
}
