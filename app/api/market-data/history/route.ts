import { NextResponse, type NextRequest } from "next/server";
import {
  getCachedMarketData,
  setCachedMarketData,
} from "@/market-data/cache";
import {
  fetchYahooDailyHistory,
  type YahooHistoryRange,
} from "@/market-data/providers/yahoo";
import { yahooSymbolForInstrument } from "@/market-data/symbols";
import type { MarketQuote } from "@/market-data/types";
import { rateLimitResponse } from "@/market-data/rate-limit";

// Daily history changes at most once per trading day; an hour keeps the latest
// close reasonably fresh without hammering Yahoo on every dashboard render.
const HISTORY_CACHE_TTL_MS = 60 * 60 * 1000;

const ALLOWED_RANGES: YahooHistoryRange[] = ["1mo", "3mo", "6mo", "1y", "2y", "5y", "max"];

function parseRange(value: string | null): YahooHistoryRange {
  return ALLOWED_RANGES.includes(value as YahooHistoryRange)
    ? (value as YahooHistoryRange)
    : "2y";
}

export async function GET(request: NextRequest) {
  const limited = rateLimitResponse(request);
  if (limited) return limited;

  const symbol = request.nextUrl.searchParams.get("symbol") ?? "";
  const currency = request.nextUrl.searchParams.get("currency");
  const range = parseRange(request.nextUrl.searchParams.get("range"));
  const yahooSymbol = yahooSymbolForInstrument(symbol, currency);

  if (!yahooSymbol) {
    return NextResponse.json({ error: "Missing symbol." }, { status: 400 });
  }

  const cacheKey = `history:yahoo:${yahooSymbol}:${range}`;
  const cached = getCachedMarketData<MarketQuote[]>(cacheKey);
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
    const series = await fetchYahooDailyHistory(yahooSymbol, range);
    const entry = setCachedMarketData(cacheKey, series, HISTORY_CACHE_TTL_MS);
    return NextResponse.json({
      data: entry.value,
      cache: {
        hit: false,
        fetchedAt: entry.fetchedAt,
        expiresAt: entry.expiresAt,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Market data error.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
