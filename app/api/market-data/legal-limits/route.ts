import { NextResponse, type NextRequest } from "next/server";
import {
  getCachedMarketData,
  setCachedMarketData,
} from "@/market-data/cache";
import { fetchFinwireLegalLimits } from "@/market-data/providers/finwire";
import type { LegalLimits } from "@/market-data/types";
import { rateLimitResponse } from "@/market-data/rate-limit";

// Statutory IKE/IKZE caps change once a year, so a long TTL is safe.
const LEGAL_LIMITS_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const limited = rateLimitResponse(request);
  if (limited) return limited;

  const cacheKey = "legal-limits:finwire";
  const cached = getCachedMarketData<LegalLimits>(cacheKey);
  if (cached) {
    return NextResponse.json({ data: cached.value, cache: { hit: true } });
  }

  try {
    const limits = await fetchFinwireLegalLimits();
    const entry = setCachedMarketData(cacheKey, limits, LEGAL_LIMITS_CACHE_TTL_MS);
    return NextResponse.json({ data: entry.value, cache: { hit: false } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Błąd danych rynkowych." },
      { status: 502 },
    );
  }
}
