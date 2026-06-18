import { z } from "zod";
import type { InstrumentCandidate, MarketQuote } from "@/market-data/types";

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

const searchSchema = z.object({
  quotes: z
    .array(
      z.object({
        symbol: z.string().nullable().optional(),
        shortname: z.string().nullable().optional(),
        longname: z.string().nullable().optional(),
        exchDisp: z.string().nullable().optional(),
        quoteType: z.string().nullable().optional(),
        currency: z.string().nullable().optional(),
      }),
    )
    .nullable()
    .optional(),
});

export async function fetchYahooSearch(
  query: string,
  kind?: "stock" | "etf",
): Promise<InstrumentCandidate[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`;
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X) ZeccaWeb/1.0",
    },
    next: { revalidate: 60 * 60 },
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance returned ${response.status} for search "${query}".`);
  }

  return parseYahooSearch(await response.json(), kind);
}

export function parseYahooSearch(
  json: unknown,
  kindFilter?: "stock" | "etf",
): InstrumentCandidate[] {
  const parsed = searchSchema.parse(json);
  const candidates: InstrumentCandidate[] = [];

  for (const quote of parsed.quotes ?? []) {
    const symbol = quote.symbol?.trim();
    if (!symbol) {
      continue;
    }

    const kind = mapQuoteType(quote.quoteType);
    if (!kind) {
      // Skip indices, currencies, futures, etc. — this is a stock/ETF picker.
      continue;
    }
    if (kindFilter && kind !== kindFilter) {
      continue;
    }

    candidates.push({
      provider: "yahoo",
      symbol,
      name: quote.longname ?? quote.shortname ?? symbol,
      exchange: quote.exchDisp ?? null,
      currency: quote.currency ?? null,
      kind,
    });
  }

  return candidates;
}

function mapQuoteType(quoteType: string | null | undefined): "stock" | "etf" | null {
  switch (quoteType?.toUpperCase()) {
    case "EQUITY":
      return "stock";
    case "ETF":
    case "MUTUALFUND":
      return "etf";
    default:
      return null;
  }
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
