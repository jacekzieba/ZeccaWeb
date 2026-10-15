// Wyniki roczne (XIRR, CAGR) mają sens dopiero przy dłuższej historii. Poniżej
// roku pokazujemy zwrot za okres i mówimy wprost dlaczego.
import { ANNUALIZATION_MIN_DAYS } from "./portfolio-metrics";

type ShortHistoryInput = {
  xirrPct: number | null;
  historyDays?: number;
  periodReturnPct?: number | null;
};

export function dayCountLabel(days: number): string {
  return days === 1 ? "1 dzień" : `${days} dni`;
}

/** Czy historia jest za krótka, żeby pokazywać wyniki roczne. */
export function isShortHistory(metrics: Pick<ShortHistoryInput, "historyDays">): boolean {
  return metrics.historyDays != null && metrics.historyDays < ANNUALIZATION_MIN_DAYS;
}

export const SHORT_HISTORY_EXPLANATION =
  "Wynik roczny liczymy od roku historii: z kilku dni po przeliczeniu na rok wychodzą liczby bez sensu. " +
  "Do tego czasu pokazujemy zwrot za okres, bez annualizacji.";

export type MwrDisplay = {
  value: number | null;
  sub: string;
  /** true, gdy wartość jest zwrotem za okres, a nie stopą roczną. */
  period: boolean;
  explanation: string | null;
};

export function mwrDisplay(metrics: ShortHistoryInput, annualSub = "rocznie"): MwrDisplay {
  if (isShortHistory(metrics)) {
    const days = metrics.historyDays ?? 0;
    return {
      value: metrics.periodReturnPct ?? null,
      sub: `za ${dayCountLabel(days)} · rocznie od 1 roku`,
      period: true,
      explanation: SHORT_HISTORY_EXPLANATION,
    };
  }
  return { value: metrics.xirrPct, sub: annualSub, period: false, explanation: null };
}

/** CAGR i wynik realny: poniżej roku brak wartości (nie ma czego annualizować). */
export function annualizedOrNull(
  metrics: Pick<ShortHistoryInput, "historyDays">,
  value: number,
): { value: number | null; shortHistory: boolean } {
  return isShortHistory(metrics)
    ? { value: null, shortHistory: true }
    : { value, shortHistory: false };
}
