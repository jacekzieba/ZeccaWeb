// Pure financial-metric helpers shared by the dashboard, portfolio detail,
// benchmark and reports views. These intentionally have no dependency on the
// sync/decryption layer so they can be unit-tested in isolation.

export type CashflowPoint = {
  date: Date;
  /**
   * Signed amount from the INVESTOR's perspective, in the base currency:
   * a contribution (money paid into the portfolio) is negative, a
   * distribution (money taken out) is positive. The terminal portfolio value
   * is supplied as a final positive cashflow.
   */
  amount: number;
};

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

/**
 * Money-weighted (internal) rate of return, annualised. Returns the rate as a
 * fraction (0.1234 === 12.34 %), or `null` when it cannot be solved (e.g. all
 * cashflows share the same sign, or fewer than two flows).
 *
 * Uses Newton–Raphson with a bisection fallback for robustness.
 */
export function computeXirr(cashflows: CashflowPoint[]): number | null {
  const flows = cashflows
    .filter((flow) => Number.isFinite(flow.amount) && flow.amount !== 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (flows.length < 2) return null;
  const hasPositive = flows.some((flow) => flow.amount > 0);
  const hasNegative = flows.some((flow) => flow.amount < 0);
  if (!hasPositive || !hasNegative) return null;

  const t0 = flows[0].date.getTime();
  const years = (date: Date) => (date.getTime() - t0) / MS_PER_YEAR;

  const npv = (rate: number) =>
    flows.reduce(
      (sum, flow) => sum + flow.amount / Math.pow(1 + rate, years(flow.date)),
      0,
    );
  const dNpv = (rate: number) =>
    flows.reduce((sum, flow) => {
      const t = years(flow.date);
      if (t === 0) return sum;
      return sum - (t * flow.amount) / Math.pow(1 + rate, t + 1);
    }, 0);

  // Newton–Raphson
  let rate = 0.1;
  for (let i = 0; i < 60; i += 1) {
    const value = npv(rate);
    if (Math.abs(value) < 1e-7) return rate;
    const derivative = dNpv(rate);
    if (!Number.isFinite(derivative) || Math.abs(derivative) < 1e-12) break;
    let next = rate - value / derivative;
    if (!Number.isFinite(next)) break;
    if (next <= -0.9999) next = (rate - 0.9999) / 2;
    if (Math.abs(next - rate) < 1e-9) return next;
    rate = next;
  }

  // Bisection fallback over a wide bracket.
  let lo = -0.9999;
  let hi = 10;
  let fLo = npv(lo);
  let fHi = npv(hi);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi) || fLo * fHi > 0) {
    return null;
  }
  for (let i = 0; i < 200; i += 1) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-7) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

/**
 * Maximum drawdown of a value series, as a non-positive percentage
 * (e.g. -12.5 means the value fell 12.5 % below a prior peak).
 */
export function computeMaxDrawdownPct(values: number[]): number {
  let peak = Number.NEGATIVE_INFINITY;
  let maxDrawdown = 0;
  for (const value of values) {
    if (value > peak) peak = value;
    if (peak > 0) {
      const drawdown = (value - peak) / peak;
      if (drawdown < maxDrawdown) maxDrawdown = drawdown;
    }
  }
  return maxDrawdown * 100;
}

/**
 * Simple (non-annualised) total return on net invested capital, as a
 * percentage. Returns 0 when no capital has been invested.
 */
export function computeTotalReturnPct(
  currentValue: number,
  netInvested: number,
): number {
  if (netInvested <= 0) return 0;
  return ((currentValue - netInvested) / netInvested) * 100;
}

/**
 * Inflation-adjusted ("real") return given a nominal return and inflation,
 * both expressed as percentages.
 */
export function computeRealReturnPct(
  nominalReturnPct: number,
  inflationPct: number,
): number {
  return (
    ((1 + nominalReturnPct / 100) / (1 + inflationPct / 100) - 1) * 100
  );
}
