import { NextResponse, type NextRequest } from "next/server";
import {
  getCachedMarketData,
  setCachedMarketData,
} from "@/market-data/cache";
import { fetchYahooQuote } from "@/market-data/providers/yahoo";
import { yahooSymbolForInstrument } from "@/market-data/symbols";
import type { MarketQuote } from "@/market-data/types";
import { rateLimitResponse } from "@/market-data/rate-limit";

const QUOTE_CACHE_TTL_MS = 15 * 60 * 1000;

export async function GET(request: NextRequest) {
  const limited = rateLimitResponse(request);
  if (limited) return limited;

  const symbol = request.nextUrl.searchParams.get("symbol") ?? "";
  const currency = request.nextUrl.searchParams.get("currency");
  const yahooSymbol = yahooSymbolForInstrument(symbol, currency);

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
    return NextResponse.json(
      { error: yahooMessage },
      { status: 502 },
    );
  }
}
