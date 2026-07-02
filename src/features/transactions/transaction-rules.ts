// Pure (UI-free) decision helpers for the Add/Edit Transaction screen. These
// mirror `TransactionEditorLogic` in the native `InvestorDomain` package
// (macOS/iOS) so the web produces and interprets `fxRateToBase` and the Belka
// tax field identically. Keep these in lockstep with the native source of
// truth — do not diverge without a matching native change.

/** Transaction types where the Belka tax field is meaningful. */
const BELKA_TAX_TYPES = new Set([
  "dividend",
  "interest",
  "bondCoupon",
  "sell",
  "bondRedemption",
  "depositClose",
]);

/** Whether the Belka tax is substantive for this transaction type. */
export function taxAppliesToType(type: string): boolean {
  return BELKA_TAX_TYPES.has(type);
}

/**
 * True when the portfolio is an IKE/IKZE tax-exempt wrapper. Real native sync
 * writes `accountType` as `PortfolioType.rawValue` — the display strings
 * "IKE"/"IKZE" — while dev/fake data uses lowercase "ike"/"ikze", so the check
 * is case-insensitive to cover both.
 */
export function isTaxExemptPortfolio(portfolioType: string | null | undefined): boolean {
  const t = (portfolioType ?? "").trim().toUpperCase();
  return t === "IKE" || t === "IKZE";
}

/**
 * Whether to show the inline tax field. Always hidden on IKE/IKZE (exemption),
 * otherwise visible for types where Belka tax applies. Mirrors
 * `TransactionEditorLogic.showsTaxField`.
 */
export function showsTaxField(type: string, portfolioType: string | null | undefined): boolean {
  if (isTaxExemptPortfolio(portfolioType)) return false;
  return taxAppliesToType(type);
}

/**
 * Whether to show the settlement-currency block (PLN vs foreign). Only buy/sell
 * in a currency other than PLN — the engine only settles `fxRateToBase` for
 * these types. Mirrors `TransactionEditorLogic.showsFXSettlement`.
 */
export function showsFXSettlement(type: string, currency: string): boolean {
  return (type === "buy" || type === "sell") && currency.trim().toUpperCase() !== "PLN";
}

/**
 * The `fxRateToBase` value to persist: the rate only when the FX block is
 * active AND the user chose PLN settlement AND the rate is positive; otherwise
 * `null` (cash settles from the foreign-currency pool). Mirrors
 * `TransactionEditorLogic.fxRateToBaseForSave`.
 */
export function fxRateToBaseForSave(args: {
  type: string;
  currency: string;
  settleInPLN: boolean;
  rate: number | null;
}): number | null {
  if (!showsFXSettlement(args.type, args.currency) || !args.settleInPLN) return null;
  if (args.rate == null || !(args.rate > 0)) return null;
  return args.rate;
}
