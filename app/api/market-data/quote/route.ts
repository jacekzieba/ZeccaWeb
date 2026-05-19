import { NextResponse, type NextRequest } from "next/server";
import {
  getCachedMarketData,
  setCachedMarketData,
} from "@/market-data/cache";
import { fetchStooqQuote } from "@/market-data/providers/stooq";
import type { MarketQuote } from "@/market-data/types";

const QUOTE_CACHE_TTL_MS = 15 * 60 * 1000;

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") ?? "";
  const normalizedSymbol = symbol.trim().toLowerCase();

  if (!normalizedSymbol) {
    return NextResponse.json({ error: "Missing symbol." }, { status: 400 });
  }

  const cacheKey = `quote:stooq:${normalizedSymbol}`;
  const cached = getCachedMarketData<MarketQuote>(cacheKey);
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
    const quote = await fetchStooqQuote(normalizedSymbol);
    const entry = setCachedMarketData(cacheKey, quote, QUOTE_CACHE_TTL_MS);
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
    if (message.includes("STOOQ_API_KEY")) {
      return NextResponse.json(
        {
          error: "Stooq nie jest skonfigurowany. Ustaw STOOQ_API_KEY w środowisku serwera.",
          code: "STOOQ_API_KEY_MISSING",
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { error: message },
      { status: 502 },
    );
  }
}
