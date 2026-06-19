"use client";

import { useQueries } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import type { MarketQuoteInput } from "@/domain/valuation/price-resolver";
import type { MarketQuote } from "@/market-data/types";
import { isFakeSyncEnabled } from "@/lib/env";
import { useProfile } from "@/features/profile/profile-store";
import { buildInstrumentList } from "@/sync/records/investor-snapshot";
import { useSyncStore } from "@/sync/store/sync-store";

type HistoryResponse = {
  data: MarketQuote[];
};

// Instruments whose price genuinely moves on a public market day-to-day. Bonds,
// deposits and cash are valued by formula or manual entry, so we don't quote them.
const QUOTED_KINDS = new Set(["stock", "etf", "crypto"]);

type QuotedInstrument = {
  id: string;
  /** Symbol passed to the market-data API (already mapped for crypto). */
  requestSymbol: string;
  currency: string;
};

export function MarketQuoteBootstrap() {
  const records = useSyncStore((state) => state.records);
  const setMarketQuotes = useSyncStore((state) => state.setMarketQuotes);
  const { displayCurrency } = useProfile();
  const appliedKey = useRef<string | null>(null);

  // Live quotes never override manual valuations in fake sync (which seeds
  // manual valuations for every asset), so there is nothing to fetch.
  const enabled = !isFakeSyncEnabled();

  const instruments = useMemo<QuotedInstrument[]>(() => {
    if (!records || !enabled) return [];
    return buildInstrumentList(records, { displayCurrency })
      .filter((row) => row.totalQuantity > 0 && QUOTED_KINDS.has(row.kind) && row.symbol.trim())
      .map((row) => ({
        id: row.id,
        requestSymbol:
          row.kind === "crypto" && !row.symbol.includes("-")
            ? `${row.symbol.trim().toUpperCase()}-USD`
            : row.symbol,
        currency: row.currency,
      }));
  }, [records, enabled, displayCurrency]);

  const queries = useQueries({
    queries: instruments.map((instrument) => ({
      queryKey: ["market-history", instrument.requestSymbol, instrument.currency],
      enabled,
      staleTime: 60 * 60 * 1000,
      // A missing/unsupported symbol shouldn't block the rest of the portfolio.
      retry: 0,
      queryFn: async () => {
        const params = new URLSearchParams({
          symbol: instrument.requestSymbol,
          currency: instrument.currency,
          range: "2y",
        });
        const response = await fetch(`/api/market-data/history?${params.toString()}`);
        const body = (await response.json()) as HistoryResponse | { error?: string };
        if (!response.ok || !("data" in body)) {
          throw new Error("Nie udało się pobrać historii notowań.");
        }
        return body.data;
      },
    })),
  });

  useEffect(() => {
    if (!enabled || instruments.length === 0) {
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
      for (const point of query.data) {
        if (point.close <= 0) continue;
        quotes.push({
          instrumentID: instrument.id,
          price: point.close,
          currency: point.currency ?? instrument.currency,
          date: new Date(`${point.date}T00:00:00.000Z`),
        });
      }
    });

    const key = `${quotes.length}:${quotes
      .map((quote) => `${quote.instrumentID}@${quote.date.getTime()}=${quote.price}`)
      .join("|")}`;

    if (appliedKey.current === key) {
      return;
    }

    appliedKey.current = key;
    setMarketQuotes(quotes);
  }, [enabled, instruments, queries, setMarketQuotes]);

  return null;
}
