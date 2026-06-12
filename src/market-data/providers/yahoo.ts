import { z } from "zod";
import type { MarketQuote } from "@/market-data/types";

const chartSchema = z.object({
  chart: z.object({
    result: z.array(z.object({
      meta: z.object({
        currency: z.string().nullable().optional(),
        regularMarketPrice: z.number().nullable().optional(),
        chartPreviousClose: z.number().nullable().optional(),
        regularMarketTime: z.number().nullable().optional(),
      }),
      indicators: z.object({
        quote: z.array(z.object({
          open: z.array(z.number().nullable()).nullable().optional(),
          high: z.array(z.number().nullable()).nullable().optional(),
          low: z.array(z.number().nullable()).nullable().optional(),
          close: z.array(z.number().nullable()).nullable().optional(),
          volume: z.array(z.number().nullable()).nullable().optional(),
        })).optional(),
      }),
    })).nullable().optional(),
    error: z.object({
      description: z.string().nullable().optional(),
    }).nullable().optional(),
  }),
});

export async function fetchYahooQuote(symbol: string): Promise<MarketQuote> {
  const normalizedSymbol = normalizeYahooSymbol(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(normalizedSymbol)}?interval=1d&range=5d`;
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X) ZeccaWeb/1.0",
    },
    next: { revalidate: 15 * 60 },
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance returned ${response.status} for ${normalizedSymbol}.`);
  }

  return parseYahooChart(await response.json(), normalizedSymbol);
}

export function parseYahooChart(json: unknown, symbol: string): MarketQuote {
  const parsed = chartSchema.parse(json);
  const errorDescription = parsed.chart.error?.description;
  if (errorDescription) {
    throw new Error(errorDescription);
  }

  const result = parsed.chart.result?.[0];
  if (!result) {
    throw new Error("Yahoo Finance returned no quote data.");
  }

  const quote = result.indicators.quote?.[0];
  const close = result.meta.regularMarketPrice ?? latestNumber(quote?.close);
  if (!close || close <= 0) {
    throw new Error("Yahoo Finance returned no valid price.");
  }

  const date = new Date(
    (result.meta.regularMarketTime ?? Math.floor(Date.now() / 1000)) * 1000,
  ).toISOString().slice(0, 10);

  return {
    provider: "yahoo",
    symbol,
    currency: result.meta.currency ?? null,
    date,
    open: latestNumber(quote?.open) ?? close,
    high: latestNumber(quote?.high) ?? close,
    low: latestNumber(quote?.low) ?? close,
    close,
    volume: latestNumber(quote?.volume),
  };
}

function normalizeYahooSymbol(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9.^=_-]{1,32}$/.test(normalized)) {
    throw new Error("Invalid Yahoo Finance symbol.");
  }
  return normalized;
}

function latestNumber(values: Array<number | null> | null | undefined) {
  return values?.filter((value): value is number => typeof value === "number").at(-1) ?? null;
}
