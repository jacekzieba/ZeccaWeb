import type { AllocationSlice, ValuationPoint } from "@/domain/models/investor-data";

/** Percent below the running peak at each point (0 at a new high, otherwise negative). */
export function drawdownSeries(series: ValuationPoint[]): ValuationPoint[] {
  let peak = Number.NEGATIVE_INFINITY;
  return series.map((point) => {
    if (point.value > peak) peak = point.value;
    const value = peak > 0 ? ((point.value - peak) / peak) * 100 : 0;
    return { label: point.label, date: point.date, value };
  });
}

/** Value minus cumulative net invested capital; both series share a date grid. */
export function pnlOverTimeSeries(
  value: ValuationPoint[],
  netInvested: ValuationPoint[],
): ValuationPoint[] {
  const n = Math.min(value.length, netInvested.length);
  return value.slice(0, n).map((point, i) => ({
    label: point.label,
    date: point.date,
    value: point.value - netInvested[i].value,
  }));
}

/** Rescales a series so its first point is 100; empty if the base is not positive. */
export function rebaseToHundred(series: ValuationPoint[]): ValuationPoint[] {
  const base = series[0]?.value;
  if (!(base > 0)) return [];
  return series.map((point) => ({ ...point, value: (point.value / base) * 100 }));
}

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/** Index of a constant annual inflation rate on the dates of `series`, starting at 100. */
export function inflationIndexSeries(
  series: ValuationPoint[],
  annualPct: number,
): ValuationPoint[] {
  if (series.length === 0) return [];
  const start = new Date(series[0].date).getTime();
  return series.map((point) => {
    const years = Math.max(0, (new Date(point.date).getTime() - start) / MS_PER_YEAR);
    return {
      label: point.label,
      date: point.date,
      value: 100 * Math.pow(1 + annualPct / 100, years),
    };
  });
}

/** Share of market value per currency (percent), largest first, zero-value currencies dropped. */
export function currencyBreakdown(
  items: ReadonlyArray<{ currency: string; marketValue: number }>,
): AllocationSlice[] {
  const sums = new Map<string, number>();
  for (const { currency, marketValue } of items) {
    if (!(marketValue > 0)) continue;
    const key = currency.toUpperCase();
    sums.set(key, (sums.get(key) ?? 0) + marketValue);
  }
  const total = [...sums.values()].reduce((s, v) => s + v, 0);
  if (!(total > 0)) return [];
  return [...sums.entries()]
    .map(([label, value]) => ({ label, percent: (value / total) * 100 }))
    .sort((a, b) => b.percent - a.percent);
}

export type YearlyReturn = { year: number; returnPct: number };

/** Year-over-year change of a deposit-neutral index (the time-weighted performance series). */
export function yearlyReturns(perf: ValuationPoint[]): YearlyReturn[] {
  if (perf.length < 2) return [];
  const lastByYear = new Map<number, number>();
  for (const point of perf) lastByYear.set(new Date(point.date).getFullYear(), point.value);
  const years = [...lastByYear.keys()].sort();
  const results: YearlyReturn[] = [];
  let prevEnd = perf[0].value;
  for (const year of years) {
    const end = lastByYear.get(year)!;
    if (prevEnd > 0) results.push({ year, returnPct: ((end - prevEnd) / prevEnd) * 100 });
    prevEnd = end;
  }
  return results;
}
