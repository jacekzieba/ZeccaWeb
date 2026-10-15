import type { ValuationPoint } from "@/domain/models/investor-data";

/**
 * Zmiana wartości (w walucie serii) względem ostatniego punktu sprzed miesiąca.
 * Wspólne źródło dla karty podsumowania i paska bocznego — dzięki temu kwota
 * zawsze zgadza się z `monthlyChange` liczonym od tego samego punktu bazowego.
 */
export function calculateDeltaPLN(history: ValuationPoint[]): number {
  if (history.length === 0) return 0;
  const last = history[history.length - 1];
  const cutoff = new Date(last.date);
  cutoff.setMonth(cutoff.getMonth() - 1);
  let previous = history[0];
  for (const point of history) {
    if (new Date(point.date).getTime() <= cutoff.getTime()) previous = point;
    else break;
  }
  return last.value - previous.value;
}
