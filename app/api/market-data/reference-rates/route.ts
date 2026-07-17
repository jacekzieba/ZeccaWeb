import { NextResponse, type NextRequest } from "next/server";
import {
  getCachedMarketData,
  setCachedMarketData,
} from "@/market-data/cache";
import { fetchNbpReferenceRates } from "@/market-data/providers/nbp-reference-rates";
import { fetchFinwireReferenceRateLatest } from "@/market-data/providers/finwire";
import type { ReferenceRateChange } from "@/market-data/types";
import { rateLimitResponse } from "@/market-data/rate-limit";

// RPP decyduje o stopach raz w miesiącu, więc długi TTL jest bezpieczny.
const REFERENCE_RATES_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Compares our authoritative NBP archive against finwire's current reference
 * rate. On a mismatch we DO NOT switch sources — static.nbp.pl carries the full
 * verifiable history and stays authoritative — we only log so an unexpected
 * divergence (e.g. an RPP decision we failed to ingest) surfaces for a human
 * rather than silently mispricing bonds. A third-party aggregator can be wrong
 * (finwire e.g. mislabels ROR/DOR as WIBOR-indexed), so alert, don't auto-trust.
 */
async function crossCheckReferenceRate(ours: ReferenceRateChange[]): Promise<void> {
  const latestOurs = ours.at(-1);
  if (!latestOurs) return;
  let theirs: ReferenceRateChange | null = null;
  try {
    theirs = await fetchFinwireReferenceRateLatest();
  } catch {
    return; // cross-check is best-effort; its failure must not fail the route
  }
  if (theirs && Math.abs(theirs.rate - latestOurs.rate) > 0.001) {
    console.warn("Reference-rate cross-check divergence", {
      nbp: latestOurs,
      finwire: theirs,
    });
  }
}

export async function GET(request: NextRequest) {
  const limited = rateLimitResponse(request);
  if (limited) return limited;

  const cacheKey = "reference-rates:nbp";
  const cached = getCachedMarketData<ReferenceRateChange[]>(cacheKey);
  if (cached) {
    return NextResponse.json({ data: cached.value, cache: { hit: true } });
  }

  try {
    const rates = await fetchNbpReferenceRates();
    await crossCheckReferenceRate(rates);
    const entry = setCachedMarketData(cacheKey, rates, REFERENCE_RATES_CACHE_TTL_MS);
    return NextResponse.json({ data: entry.value, cache: { hit: false } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Błąd danych rynkowych." },
      { status: 502 },
    );
  }
}
