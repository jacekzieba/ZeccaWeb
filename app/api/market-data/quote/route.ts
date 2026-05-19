import { NextResponse, type NextRequest } from "next/server";
import {
  getCachedMarketData,
  setCachedMarketData,
} from "@/market-data/cache";
import { fetchStooqQuote } from "@/market-data/providers/stooq";
import { fetchYahooQuote } from "@/market-data/providers/yahoo";
import {
  stooqSymbolForInstrument,
  yahooSymbolForInstrument,
} from "@/market-data/symbols";
import type { MarketQuote } from "@/market-data/types";

const QUOTE_CACHE_TTL_MS = 15 * 60 * 1000;

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") ?? "";
  const currency = request.nextUrl.searchParams.get("currency");
  const yahooSymbol = yahooSymbolForInstrument(symbol, currency);
  const stooqSymbol = stooqSymbolForInstrument(symbol, currency);

  if (!yahooSymbol) {
    return NextResponse.json({ error: "Missing symbol." }, { status: 400 });
  }

  const yahooCacheKey = `quote:yahoo:${yahooSymbol}`;
  const cached = getCachedMarketData<MarketQuote>(yahooCacheKey);
  if (cached) {
    return NextResponse.json({
      data: cached.value,
      cache: {
        hit: true,
        fetchedAt: cached.fetchedAt,
        expiresAt: cached.expiresAt,
      },
    });
  }

  try {
    const quote = await fetchYahooQuote(yahooSymbol);
    const entry = setCachedMarketData(yahooCacheKey, quote, QUOTE_CACHE_TTL_MS);
    return NextResponse.json({
      data: entry.value,
      cache: {
        hit: false,
        fetchedAt: entry.fetchedAt,
        expiresAt: entry.expiresAt,
      },
    });
  } catch (error) {
    const yahooMessage = error instanceof Error ? error.message : "Market data error.";
    const stooqConfigured = Boolean(process.env.STOOQ_API_KEY?.trim());
    if (!stooqConfigured || !stooqSymbol) {
      return NextResponse.json(
        { error: yahooMessage },
        { status: 502 },
      );
    }

    const stooqCacheKey = `quote:stooq:${stooqSymbol}`;
    const stooqCached = getCachedMarketData<MarketQuote>(stooqCacheKey);
    if (stooqCached) {
      return NextResponse.json({
        data: stooqCached.value,
        cache: {
          hit: true,
          fetchedAt: stooqCached.fetchedAt,
          expiresAt: stooqCached.expiresAt,
        },
        fallback: {
          from: "yahoo",
          reason: yahooMessage,
        },
      });
    }

    try {
      const quote = await fetchStooqQuote(stooqSymbol);
      const entry = setCachedMarketData(stooqCacheKey, quote, QUOTE_CACHE_TTL_MS);
      return NextResponse.json({
        data: entry.value,
        cache: {
          hit: false,
          fetchedAt: entry.fetchedAt,
          expiresAt: entry.expiresAt,
        },
        fallback: {
          from: "yahoo",
          reason: yahooMessage,
        },
      });
    } catch (stooqError) {
      const stooqMessage =
        stooqError instanceof Error ? stooqError.message : "Market data error.";
      return NextResponse.json(
        {
          error: yahooMessage,
          fallbackError: stooqMessage,
        },
        { status: 502 },
      );
    }

  }
}
