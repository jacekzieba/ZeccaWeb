import type { BondParamsInput } from "@/domain/valuation/position-valuator";

// Resolves the full issue parameters of a retail treasury bond from its own
// emission letter on obligacjeskarbowe.pl. The bond code (e.g. "EDO0736") is a
// deterministic key: family → catalogue slug, and the "MMYY" suffix → maturity
// month/year, from which the issue date follows by the family's tenor. This
// mirrors the native ObligacjeSkarboweFetcher, but with the CURRENT catalogue
// slugs ("obligacje-10-letnie-edo") — the native table still uses the retired
// spelled-out slugs ("obligacje-dziesiecioletnie-edo") and 404s.

/**
 * The structural shape of each retail bond family is fixed by regulation and
 * does not change between emissions — only the first-year rate and the CPI
 * margin move month to month. So we key everything structural off the family
 * (deterministic, verified live across all eight) and scrape only the two
 * varying numbers. This avoids brittle prose inference: a fixed-rate TOS/OTS
 * page still mentions "inflacja" in its marketing copy, which a text search
 * would misread as an inflation-indexed bond.
 *
 * `slug` — current catalogue URL slug. `tenorMonths` — issue = maturity − tenor.
 * `subsequentBase`/`capitalization`/`interestPayment` — the engine vocabulary.
 */
type BondFamilySpec = {
  slug: string;
  tenorMonths: number;
  subsequentBase: string;
  capitalization: string;
  interestPayment: string;
};

const BOND_FAMILIES: Record<string, BondFamilySpec> = {
  OTS: { slug: "obligacje-3-miesieczne-ots", tenorMonths: 3, subsequentBase: "stałe", capitalization: "brak", interestPayment: "przy wykupie" },
  ROR: { slug: "obligacje-roczne-ror", tenorMonths: 12, subsequentBase: "stopa referencyjna NBP", capitalization: "brak", interestPayment: "co miesiąc" },
  DOR: { slug: "obligacje-2-letnie-dor", tenorMonths: 24, subsequentBase: "stopa referencyjna NBP", capitalization: "brak", interestPayment: "co miesiąc" },
  TOS: { slug: "obligacje-3-letnie-tos", tenorMonths: 36, subsequentBase: "stałe", capitalization: "roczna", interestPayment: "przy wykupie" },
  COI: { slug: "obligacje-4-letnie-coi", tenorMonths: 48, subsequentBase: "inflacja", capitalization: "brak", interestPayment: "co rok" },
  ROS: { slug: "obligacje-6-letnie-ros", tenorMonths: 72, subsequentBase: "inflacja", capitalization: "roczna", interestPayment: "przy wykupie" },
  EDO: { slug: "obligacje-10-letnie-edo", tenorMonths: 120, subsequentBase: "inflacja", capitalization: "roczna", interestPayment: "przy wykupie" },
  ROD: { slug: "obligacje-12-letnie-rod", tenorMonths: 144, subsequentBase: "inflacja", capitalization: "roczna", interestPayment: "przy wykupie" },
};

const CATALOGUE_BASE = "https://www.obligacjeskarbowe.pl/oferta-obligacji";

export type DecomposedBondCode = {
  family: string;
  /** 1-12 */
  maturityMonth: number;
  maturityYear: number;
};

/** Splits e.g. "ROD0338" into family "ROD" + maturity March 2038. Retail series
 * always use the `<FAMILY><MMYY>` form. Returns null for anything else. */
export function decomposeBondCode(code: string): DecomposedBondCode | null {
  const upper = code.trim().toUpperCase();
  if (!/^[A-Z]{3}\d{4}$/.test(upper)) return null;
  const family = upper.slice(0, 3);
  const month = Number(upper.slice(3, 5));
  const year = 2000 + Number(upper.slice(5, 7));
  if (month < 1 || month > 12) return null;
  if (!(family in BOND_FAMILIES)) return null;
  return { family, maturityMonth: month, maturityYear: year };
}

/** Deep-link to a specific series' emission letter, or null if the code is not
 * a recognised retail family. */
export function bondCatalogueUrl(code: string): string | null {
  const parts = decomposeBondCode(code);
  if (!parts) return null;
  return `${CATALOGUE_BASE}/${BOND_FAMILIES[parts.family].slug}/${code.trim().toLowerCase()}/`;
}

function isoDate(year: number, monthIndex0: number, day: number): string {
  return new Date(Date.UTC(year, monthIndex0, day)).toISOString();
}

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&oacute;/g, "ó")
    .replace(/&#160;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchPercent(body: string, pattern: RegExp): number | null {
  const match = pattern.exec(body);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

/**
 * Parses a stripped emission letter into bond params. Tuned to the current page
 * copy, verified across all eight families (OTS/ROR/DOR/TOS/COI/ROS/EDO/ROD):
 *
 *   "Oprocentowanie: 5,35% w pierwszym rocznym okresie ... marża 2,00% + inflacja
 *    Kapitalizacja odsetek: roczna  Wypłata odsetek: przy wykupie"
 */
export function parseBondEmissionLetter(
  html: string,
  code: string,
): BondParamsInput | null {
  const parts = decomposeBondCode(code);
  if (!parts) return null;
  const spec = BOND_FAMILIES[parts.family];
  const body = stripHtml(html);

  // Only two numbers vary between emissions; scrape those, derive the rest from
  // the family. Headline "Oprocentowanie: X%" is always the first-year (or, for
  // fixed families, whole-term) rate.
  const firstPeriodRate = matchPercent(body, /oprocentowanie:\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*%/i);
  if (firstPeriodRate == null) return null;

  const scrapedMargin = matchPercent(body, /mar[zż]a\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*%/i) ?? 0;
  // Fixed-coupon bonds carry the whole rate as the "margin" the engine reads for
  // subsequent periods, matching how `bondPeriodRate` treats "stałe".
  const marginOverBase = spec.subsequentBase === "stałe" ? firstPeriodRate : scrapedMargin;

  const maturityDate = isoDate(parts.maturityYear, parts.maturityMonth - 1, 1);
  // Issue date = maturity − tenor. Current retail emissions are dated the 1st of
  // the month, so the day is exact for modern series.
  const issueDate = isoDate(parts.maturityYear, parts.maturityMonth - 1 - spec.tenorMonths, 1);

  return {
    issueDate: new Date(issueDate),
    maturityDate: new Date(maturityDate),
    nominalValue: 100,
    firstPeriodRate,
    subsequentBase: spec.subsequentBase,
    marginOverBase,
    capitalization: spec.capitalization,
    interestPayment: spec.interestPayment,
  };
}

export async function fetchTreasuryBondParams(
  code: string,
): Promise<BondParamsInput | null> {
  const url = bondCatalogueUrl(code);
  if (!url) return null;

  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "Mozilla/5.0 (compatible; ZeccaWeb/1.0)",
    },
    next: { revalidate: 24 * 60 * 60 },
  });

  // A non-existent series returns the catalogue's soft-404 page; treat any
  // non-2xx as "not found" so the caller can fall back to manual entry.
  if (!response.ok) return null;
  return parseBondEmissionLetter(await response.text(), code);
}
