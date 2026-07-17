import { NextResponse, type NextRequest } from "next/server";
import {
  getCachedMarketData,
  setCachedMarketData,
} from "@/market-data/cache";
import { fetchTreasuryBondParams } from "@/market-data/providers/treasury-bond-params";
import { knownTreasuryBondValuationParams } from "@/domain/valuation/treasury-bond-issues";
import type { BondParamsInput } from "@/domain/valuation/position-valuator";
import { rateLimitResponse } from "@/market-data/rate-limit";

// Emission letters are immutable once published, so a resolved series can be
// cached for a long time.
const BOND_PARAMS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type SerializedBondParams = {
  issueDate: string;
  maturityDate: string;
  nominalValue: number;
  firstPeriodRate: number;
  subsequentBase: string;
  marginOverBase: number;
  capitalization: string;
  interestPayment: string;
};

function serialize(params: BondParamsInput): SerializedBondParams {
  return {
    issueDate: params.issueDate!.toISOString(),
    maturityDate: params.maturityDate.toISOString(),
    nominalValue: params.nominalValue,
    firstPeriodRate: params.firstPeriodRate,
    subsequentBase: params.subsequentBase,
    marginOverBase: params.marginOverBase,
    capitalization: params.capitalization,
    interestPayment: params.interestPayment,
  };
}

export async function GET(request: NextRequest) {
  const limited = rateLimitResponse(request);
  if (limited) return limited;

  const code = (request.nextUrl.searchParams.get("code") ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}\d{4}$/.test(code)) {
    return NextResponse.json({ error: "Nieprawidłowy kod obligacji." }, { status: 400 });
  }

  // The curated catalogue wins: it carries the exact issue day for its four
  // series (verified against obligacjeskarbowe.pl) and needs no network.
  const known = knownTreasuryBondValuationParams(code);
  if (known) {
    return NextResponse.json({ data: serialize(known), source: "catalog" });
  }

  const cacheKey = `bond-params:${code}`;
  const cached = getCachedMarketData<SerializedBondParams>(cacheKey);
  if (cached) {
    return NextResponse.json({ data: cached.value, source: "scrape", cache: { hit: true } });
  }

  try {
    const params = await fetchTreasuryBondParams(code);
    if (!params) {
      return NextResponse.json(
        { error: "Nie znaleziono listu emisyjnego dla tej serii." },
        { status: 404 },
      );
    }
    const entry = setCachedMarketData(cacheKey, serialize(params), BOND_PARAMS_CACHE_TTL_MS);
    return NextResponse.json({ data: entry.value, source: "scrape", cache: { hit: false } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Błąd danych rynkowych." },
      { status: 502 },
    );
  }
}
