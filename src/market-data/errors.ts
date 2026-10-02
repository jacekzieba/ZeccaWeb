/**
 * The provider answered, but has no usable data for this symbol (unknown or
 * delisted ticker, zero price, empty history). A permanent miss for that
 * symbol — routes answer 404, not 502, which stays reserved for real upstream
 * failures.
 */
export class MarketDataNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarketDataNotFoundError";
  }
}
