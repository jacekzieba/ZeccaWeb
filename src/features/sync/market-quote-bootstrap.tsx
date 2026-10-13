"use client";

import { useQueries } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import type { MarketQuoteInput } from "@/domain/valuation/price-resolver";
import type { MarketQuote } from "@/market-data/types";
import { useProfile } from "@/features/profile/profile-store";
import { marketDataCandidates } from "@/market-data/symbols";
import { buildInstrumentList } from "@/sync/records/investor-snapshot";
import { useSyncStore } from "@/sync/store/sync-store";

type HistoryResponse = {
  data: MarketQuote[];
};

type QuoteResponse = {
  data: MarketQuote;
};

type MarketDataResponse = {
  history: MarketQuote[];
  latest: MarketQuote | null;
};

// Instruments whose price genuinely moves on a public market day-to-day. Bonds,
// deposits and cash are valued by formula or manual entry, so we don't quote them.
const QUOTED_KINDS = new Set(["stock", "etf", "crypto"]);

type QuotedInstrument = {
  id: string;
  /** Symbols passed to the market-data API in order of preference (already mapped for crypto). */
  requestSymbols: string[];
  currency: string;
};

/**
 * Converts a provider history into valuation inputs without relabelling its
 * currency. The stored asset currency is only a fallback for providers that
 * omit it; using it unconditionally would value e.g. VWRL.L in USD instead of
 * GBP and apply the wrong NBP rate.
 */
export function marketQuoteInputsFromHistory(
  instrument: Pick<QuotedInstrument, "id" | "currency">,
  history: MarketQuote[],
  latest: MarketQuote | null = null,
): MarketQuoteInput[] {
  const inputs = history.flatMap((point) => {
    if (point.close <= 0) return [];
    return [{
      instrumentID: instrument.id,
      price: point.close,
      currency: point.currency ?? instrument.currency,
      // Yahoo history is an end-of-session series; retain the provider's
      // session date rather than stamping it with the browser refresh time.
      date: new Date(`${point.date}T00:00:00.000Z`),
    }];
  });

  // Yahoo's history API can retain the previous daily close after the quote
  // endpoint has a newer regular-market price. Keep the former for charts but
  // use the latter for the current portfolio value — the native apps already
  // use this same quote endpoint.
  if (!latest || latest.close <= 0) return inputs;
  const latestInput: MarketQuoteInput = {
    instrumentID: instrument.id,
    price: latest.close,
    currency: latest.currency ?? instrument.currency,
    date: new Date(`${latest.date}T00:00:00.000Z`),
  };
  const latestHistoryIndex = inputs.reduce(
    (index, point, current) => point.date > inputs[index]!.date ? current : index,
    0,
  );
  if (inputs.length > 0 && latestInput.date < inputs[latestHistoryIndex]!.date) {
    return inputs;
  }
  const sameSessionIndex = inputs.findIndex(
    (point) => point.date.getTime() === latestInput.date.getTime(),
  );
  if (sameSessionIndex >= 0) {
    inputs[sameSessionIndex] = latestInput;
  } else {
    inputs.push(latestInput);
  }
  return inputs.sort((a, b) => a.date.getTime() - b.date.getTime());
}

async function fetchListing(symbol: string, currency: string): Promise<MarketDataResponse | null> {
  const params = new URLSearchParams({ symbol, currency });
  const historyParams = new URLSearchParams(params);
  historyParams.set("range", "2y");
  const [historyResult, quoteResult] = await Promise.allSettled([
    fetch(`/api/market-data/history?${historyParams.toString()}`),
    fetch(`/api/market-data/quote?${params.toString()}`),
  ]);

  const history = historyResult.status === "fulfilled" && historyResult.value.ok
    ? ((await historyResult.value.json()) as HistoryResponse).data
    : [];
  const latest = quoteResult.status === "fulfilled" && quoteResult.value.ok
    ? ((await quoteResult.value.json()) as QuoteResponse).data
    : null;
  if (history.length === 0 && !latest) return null;
  return { history, latest };
}

/**
 * Z wyników kolejnych linii wybiera tę notowaną w walucie instrumentu; gdy żadna
 * nie pasuje, zostaje pierwsza znaleziona (cena z innej linii lepsza niż brak ceny).
 */
export function chooseMarketData(
  results: Array<MarketDataResponse | null>,
  currency: string,
): MarketDataResponse | null {
  const wanted = currency.trim().toUpperCase();
  let fallback: MarketDataResponse | null = null;
  for (const result of results) {
    if (!result) continue;
    if (isQuotedIn(result, wanted)) return result;
    fallback ??= result;
  }
  return fallback;
}

async function fetchMarketData(instrument: QuotedInstrument): Promise<MarketDataResponse> {
  const results: Array<MarketDataResponse | null> = [];
  for (const symbol of instrument.requestSymbols) {
    const result = await fetchListing(symbol, instrument.currency);
    results.push(result);
    // Linia w walucie instrumentu kończy poszukiwania, bez dalszych zapytań.
    if (result && chooseMarketData([result], instrument.currency) === result && isQuotedIn(result, instrument.currency)) {
      return result;
    }
  }
  const chosen = chooseMarketData(results, instrument.currency);
  if (!chosen) throw new Error("Nie udało się pobrać notowań.");
  return chosen;
}

function isQuotedIn(result: MarketDataResponse, currency: string) {
  const provider = (result.latest?.currency ?? result.history.at(-1)?.currency ?? "").toUpperCase();
  return !provider || provider === currency.trim().toUpperCase();
}

export function MarketQuoteBootstrap() {
  const records = useSyncStore((state) => state.records);
  const setMarketQuotes = useSyncStore((state) => state.setMarketQuotes);
  const { displayCurrency } = useProfile();
  const appliedKey = useRef<string | null>(null);

  const instruments = useMemo<QuotedInstrument[]>(() => {
    if (!records) return [];
    return buildInstrumentList(records, { displayCurrency })
      .filter((row) => row.totalQuantity > 0 && QUOTED_KINDS.has(row.kind) && row.symbol.trim())
      .map((row) => ({
        id: row.id,
        requestSymbols:
          row.kind === "crypto" && !row.symbol.includes("-")
            ? [`${row.symbol.trim().toUpperCase()}-USD`]
            : marketDataCandidates({ ...row, currency: row.assetCurrency }),
        currency: row.assetCurrency,
      }));
  }, [records, displayCurrency]);

  const queries = useQueries({
    queries: instruments.map((instrument) => ({
      queryKey: ["market-history", instrument.requestSymbols.join(","), instrument.currency],
      // Current valuation comes from the quote endpoint (cached for 15 minutes);
      // the long history is retained only for series and period changes.
      staleTime: 15 * 60 * 1000,
      // A missing/unsupported symbol shouldn't block the rest of the portfolio.
      retry: 0,
      queryFn: () => fetchMarketData(instrument),
    })),
  });

  useEffect(() => {
    if (instruments.length === 0) {
      setMarketQuotes([]);
      appliedKey.current = null;
      return;
    }

    // Apply once every outstanding query has resolved (success or failure), so
    // the chart updates in a single pass rather than flickering per instrument.
    if (queries.some((query) => query.status === "pending")) {
      return;
    }

    const quotes: MarketQuoteInput[] = [];
    queries.forEach((query, index) => {
      const instrument = instruments[index];
      if (query.status !== "success" || !query.data) return;
      quotes.push(...marketQuoteInputsFromHistory(instrument, query.data.history, query.data.latest));
    });

    const key = `${quotes.length}:${quotes
      .map((quote) => `${quote.instrumentID}@${quote.date.getTime()}=${quote.price}`)
      .join("|")}`;

    if (appliedKey.current === key) {
      return;
    }

    appliedKey.current = key;
    setMarketQuotes(quotes);
  }, [instruments, queries, setMarketQuotes]);

  return null;
}
