import { NextResponse, type NextRequest } from "next/server";
import {
  getCachedMarketData,
  setCachedMarketData,
} from "@/market-data/cache";
import { fetchYahooSearch } from "@/market-data/providers/yahoo";
import type { InstrumentCandidate } from "@/market-data/types";
import { rateLimitResponse } from "@/market-data/rate-limit";

const SEARCH_CACHE_TTL_MS = 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const limited = rateLimitResponse(request);
  if (limited) return limited;

  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (!query) {
    return NextResponse.json({ data: [] });
  }

  const kindParam = request.nextUrl.searchParams.get("kind");
  const kind = kindParam === "stock" || kindParam === "etf" ? kindParam : undefined;

  const cacheKey = `search:yahoo:${query.toLowerCase()}:${kind ?? "all"}`;
  const cached = getCachedMarketData<InstrumentCandidate[]>(cacheKey);
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
    const candidates = await fetchYahooSearch(query, kind);
    const entry = setCachedMarketData(cacheKey, candidates, SEARCH_CACHE_TTL_MS);
    return NextResponse.json({
      data: entry.value,
      cache: {
        hit: false,
        fetchedAt: entry.fetchedAt,
        expiresAt: entry.expiresAt,
      },
    });
  } catch {
    // Search powers a typeahead while the user is still typing, so provider
    // failures (network/parse) must stay silent: return an empty result set
    // with a 200 rather than surfacing an error in the editor UI.
    return NextResponse.json({ data: [] });
  }
}
