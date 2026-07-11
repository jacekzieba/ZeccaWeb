import { NextResponse, type NextRequest } from "next/server";
import {
  getCachedMarketData,
  setCachedMarketData,
} from "@/market-data/cache";
import { fetchGusCpiSeries } from "@/market-data/providers/gus";
import type { CpiObservation } from "@/market-data/types";
import { rateLimitResponse } from "@/market-data/rate-limit";

// GUS publishes CPI once a month, so a cached reading stays valid far longer
// than FX/quote data.
const CPI_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const limited = rateLimitResponse(request);
  if (limited) return limited;

  const start = request.nextUrl.searchParams.get("start");
  const end = request.nextUrl.searchParams.get("end");

  if (
    !start ||
    !end ||
    !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(end)
  ) {
    return NextResponse.json(
      { error: "Parametry start i end muszą mieć format RRRR-MM-DD." },
      { status: 400 },
    );
  }

  const cacheKey = `cpi:gus:${start}:${end}`;
  const cached = getCachedMarketData<CpiObservation[]>(cacheKey);
  if (cached) {
    return NextResponse.json({ data: cached.value, cache: { hit: true } });
  }

  try {
    const series = await fetchGusCpiSeries(start, end);
    const entry = setCachedMarketData(cacheKey, series, CPI_CACHE_TTL_MS);
    return NextResponse.json({ data: entry.value, cache: { hit: false } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Błąd danych rynkowych." },
      { status: 502 },
    );
  }
}
