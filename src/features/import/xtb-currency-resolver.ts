/**
 * D2 async phase: resolve the "?" currencies the parser left unresolved by
 * inferring each instrument's settlement currency from its observed FX ratio and
 * NBP rates on the trade date. Kept separate from the (pure, sync) parser so the
 * network dependency stays at the edge and this stays testable via an injected
 * rate fetcher.
 */

import type { XtbImportPreview } from "./xtb-parser";
import { inferCurrencyFromFx, type FxCandidate } from "./currency-inference";
import {
  marketDataExchangeForSymbol,
  marketDataSymbolForInstrument,
} from "@/market-data/symbols";

/** Fetches a CCY→PLN rate for `date` (yyyy-mm-dd), or null if unavailable. */
export type FxRateFetcher = (code: string, date: string) => Promise<number | null>;

// XTB PL settles foreign instruments in a small set of currencies. Keeping the
// candidate set tight limits the chance of two near-equal rates colliding.
const DEFAULT_CANDIDATES = ["USD", "EUR", "GBP", "CHF"];

/**
 * Mutates `preview` in place: for each fx observation, infers the currency and,
 * when confident, patches the matching instrument payload and its transactions.
 * Returns how many instruments were resolved.
 */
export async function resolveObservedCurrencies(
  preview: XtbImportPreview,
  fetchRate: FxRateFetcher,
  candidates: string[] = DEFAULT_CANDIDATES,
): Promise<number> {
  let resolvedCount = 0;

  for (const obs of preview.fxObservations) {
    const rates = await Promise.all(
      candidates.map(async (currency): Promise<FxCandidate | null> => {
        const rate = await fetchRate(currency, obs.date);
        return rate && rate > 0 ? { currency, rate } : null;
      }),
    );
    const inferred = inferCurrencyFromFx(
      obs.fxObserved,
      rates.filter((c): c is FxCandidate => c !== null),
    );
    if (!inferred) continue;

    const instrument = preview.newInstrumentPayloads.find(
      (p) => (p as Record<string, unknown>).symbol === obs.symbol && (p as Record<string, unknown>).currency === "?",
    ) as Record<string, unknown> | undefined;
    if (!instrument) continue;

    instrument.currency = inferred;
    const symbol = typeof instrument.symbol === "string" ? instrument.symbol : "";
    const isin = typeof instrument.isin === "string" ? instrument.isin : null;
    const marketDataID = marketDataSymbolForInstrument({
      symbol,
      currency: inferred,
      isin,
    });
    if (marketDataID) {
      instrument.marketDataID = marketDataID;
      instrument.exchange = marketDataExchangeForSymbol(marketDataID) ?? instrument.exchange;
    }
    resolvedCount += 1;

    // Patch this instrument's transactions (they reference it by id).
    const instrumentId = instrument.id;
    for (const row of preview.validRows) {
      const payload = row.payload as unknown as Record<string, unknown>;
      if (payload.instrumentID === instrumentId && payload.currency === "?") {
        payload.currency = inferred;
      }
    }
  }

  return resolvedCount;
}
