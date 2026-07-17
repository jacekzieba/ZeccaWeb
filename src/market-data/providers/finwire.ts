import { z } from "zod";
import type {
  CpiObservation,
  LegalLimits,
  ReferenceRateChange,
} from "@/market-data/types";

// finwire.pl public API — darmowe, bez klucza, CORS-open JSON (CC BY 4.0,
// atrybucja "Źródło: finwire.pl"). Używamy go jako:
//  - fallback dla CPI GUS (gdy nasza ścieżka BDL/HTML padnie),
//  - cross-check najświeższej decyzji RPP względem static.nbp.pl,
//  - jedyne źródło ustawowych limitów IKE/IKZE.
// Uwaga: to agregator third-party — dane potwierdzamy z pierwotnym źródłem tam,
// gdzie wpływają na wycenę (patrz cross-check w reference-rates route).
const FINWIRE_BASE_URL = "https://public-api.finwire.pl";

async function fetchFinwireJson(path: string): Promise<unknown> {
  const response = await fetch(`${FINWIRE_BASE_URL}${path}`, {
    headers: { accept: "application/json" },
    next: { revalidate: 6 * 60 * 60 },
  });
  if (!response.ok) {
    throw new Error(`finwire returned ${response.status} for ${path}.`);
  }
  return response.json();
}

const cpiSchema = z.object({
  data: z.object({
    entries: z.array(
      z.object({
        period: z.string(),
        yoy: z.number().nullable(),
      }),
    ),
  }),
});

/** Revised/current CPI r/r series. finwire returns the latest GUS values, i.e.
 * the same "current statistic" semantics as our GUS provider (used for the
 * real-return metric, never for as-announced bond coupons). */
export function parseFinwireCpi(
  json: unknown,
  start: string,
  end: string,
): CpiObservation[] {
  const parsed = cpiSchema.parse(json);
  const observations: CpiObservation[] = [];

  for (const entry of parsed.data.entries) {
    if (entry.yoy == null) continue;
    if (!/^\d{4}-\d{2}$/.test(entry.period)) continue;
    const date = `${entry.period}-01`;
    if (date < start || date > end) continue;
    observations.push({ provider: "gus", date, yoyRate: entry.yoy });
  }

  return observations.sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchFinwireCpiSeries(
  start: string,
  end: string,
): Promise<CpiObservation[]> {
  return parseFinwireCpi(await fetchFinwireJson("/v1/series/cpi"), start, end);
}

const referenceRateSchema = z.object({
  data: z.object({
    entries: z.array(
      z.object({
        indicator: z.string(),
        value: z.number(),
        date: z.string(),
      }),
    ),
  }),
});

/** The current NBP reference rate as finwire reports it (sourced from
 * static.nbp.pl). Used only to cross-check freshness — finwire's history is a
 * rolling 365 days, so it can't replace our full archive for bond valuation. */
export function parseFinwireReferenceRateLatest(
  json: unknown,
): ReferenceRateChange | null {
  const parsed = referenceRateSchema.parse(json);
  const ref = parsed.data.entries.find((entry) => entry.indicator === "ref");
  if (!ref || !/^\d{4}-\d{2}-\d{2}$/.test(ref.date)) return null;
  return { provider: "nbp", effectiveDate: ref.date, rate: ref.value };
}

export async function fetchFinwireReferenceRateLatest(): Promise<ReferenceRateChange | null> {
  return parseFinwireReferenceRateLatest(
    await fetchFinwireJson("/v1/series/interest-rate"),
  );
}

const legalLimitsSchema = z.object({
  data: z.object({
    limits: z.object({
      year: z.number(),
      ike: z.number(),
      ikze: z.number(),
      ikzeSelfemployed: z.number(),
    }),
  }),
});

export function parseFinwireLegalLimits(json: unknown): LegalLimits {
  const { limits } = legalLimitsSchema.parse(json).data;
  return {
    provider: "finwire",
    year: limits.year,
    ike: limits.ike,
    ikze: limits.ikze,
    ikzeSelfemployed: limits.ikzeSelfemployed,
  };
}

export async function fetchFinwireLegalLimits(): Promise<LegalLimits> {
  return parseFinwireLegalLimits(await fetchFinwireJson("/v1/legal-limits"));
}
