/**
 * Recovers an instrument's settlement currency from the observed FX ratio when
 * no reliable label is available (D2 — see the currency ladder in xtb-parser).
 *
 * The XTB export gives the trade amount in PLN and quantity/price in the
 * instrument's own currency, so `|Amount| / (qty × price)` is the CCY→PLN rate
 * that actually applied. Matching that against candidate currencies' NBP rates
 * on the trade date identifies the currency — but only when one candidate is
 * clearly closest. Ambiguous or out-of-tolerance ratios return null so the
 * caller keeps the explicit "?" placeholder rather than guessing wrong.
 */

export type FxCandidate = {
  currency: string;
  /** Rate expressed as CCY→PLN (i.e. PLN per 1 unit of `currency`). */
  rate: number;
};

export type InferCurrencyOptions = {
  /** Max relative deviation |rate − fx| / fx for the best candidate. */
  tolerance?: number;
};

const DEFAULT_TOLERANCE = 0.03;

export function inferCurrencyFromFx(
  fxObserved: number,
  candidates: FxCandidate[],
  opts: InferCurrencyOptions = {},
): string | null {
  if (!(fxObserved > 0) || candidates.length === 0) return null;
  const tolerance = opts.tolerance ?? DEFAULT_TOLERANCE;

  const withinTolerance = candidates
    .map((c) => ({ currency: c.currency, relDev: Math.abs(c.rate - fxObserved) / fxObserved }))
    .filter((c) => c.relDev <= tolerance)
    .sort((a, b) => a.relDev - b.relDev);

  // Exactly one candidate close enough → confident. Zero → out of tolerance.
  // Two or more → ambiguous (e.g. two currencies with near-equal rates); never
  // guess between them.
  if (withinTolerance.length !== 1) return null;
  return withinTolerance[0].currency;
}
