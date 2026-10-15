import type { HoldingRow } from "@/domain/models/investor-data";

/** Wycena starsza niż tyle dni jest w tabeli pozycji oznaczana jako stara. */
export const STALE_VALUATION_DAYS = 7;

const DAY_MS = 86_400_000;

export function isStaleValuation(lastPriceDate: string | null, now: Date): boolean {
  if (!lastPriceDate) return false;
  const age = now.getTime() - new Date(lastPriceDate).getTime();
  return age > STALE_VALUATION_DAYS * DAY_MS;
}

export type ValuationSummary = {
  /** Najczęstsze źródło wyceny; null, gdy nie ma pozycji. */
  dominantLabel: string | null;
  /** Wszystkie pozycje mają to samo źródło — wtedy nie powtarzamy go w wierszach. */
  allSame: boolean;
  staleCount: number;
};

/** Zbiorcze podsumowanie jakości wyceny nad tabelą pozycji (bez powtarzania znacznika w każdym wierszu). */
export function summarizeValuations(holdings: HoldingRow[], now: Date): ValuationSummary {
  const counts = new Map<string, number>();
  let staleCount = 0;
  for (const holding of holdings) {
    counts.set(holding.valuationSourceLabel, (counts.get(holding.valuationSourceLabel) ?? 0) + 1);
    if (isStaleValuation(holding.lastPriceDate, now)) staleCount += 1;
  }
  let dominantLabel: string | null = null;
  let best = 0;
  for (const [label, count] of counts) {
    if (count > best) {
      dominantLabel = label;
      best = count;
    }
  }
  return { dominantLabel, allSame: counts.size <= 1, staleCount };
}
