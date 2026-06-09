/**
 * Shared amount/quantity parser — parity with the native Investor app (Faza 1.4).
 *
 * Rejects, by returning `null`:
 *  - empty / whitespace-only input
 *  - non-numeric input
 *  - non-finite values (NaN, ±Infinity) — e.g. `parseFloat("1e999") === Infinity`
 *  - absurdly large magnitudes (`Math.abs(v) > AMOUNT_MAGNITUDE_CAP`)
 *
 * Negative values are allowed (callers that need positivity must check separately).
 * Keep AMOUNT_MAGNITUDE_CAP identical to the native cap — it is a shared sync contract.
 */

/** Maximum allowed magnitude for a parsed amount/quantity. Mirrors the native `1e12` cap. */
export const AMOUNT_MAGNITUDE_CAP = 1e12;

/**
 * Parse a user-entered amount or quantity string.
 * @returns the finite number, or `null` when the input is invalid / out of range.
 */
export function parseAmount(value: string | null | undefined): number | null {
  if (value == null) return null;

  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  if (Math.abs(parsed) > AMOUNT_MAGNITUDE_CAP) return null;

  return parsed;
}

/**
 * Parse an amount that must be strictly positive (e.g. prices, quantities, FX rates).
 * @returns the positive finite number, or `null`.
 */
export function parsePositiveAmount(value: string | null | undefined): number | null {
  const parsed = parseAmount(value);
  return parsed != null && parsed > 0 ? parsed : null;
}
