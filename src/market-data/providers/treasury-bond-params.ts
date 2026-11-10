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
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&").replace(/&oacute;/g, "ó")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}

function captures(text: string, pattern: RegExp): string[] {
  return Array.from(text.matchAll(pattern), match => match[1]);
}

function uniqueNumber(text: string, pattern: RegExp): number | null {
  const values = captures(text, pattern).map(value => Number(value.replace(",", ".")));
  return values.length > 0 && values.every(Number.isFinite) && new Set(values).size === 1 ? values[0] : null;
}

export const BOND_PARSER_VERSION = 2;

function uniqueFee(text: string, pattern: RegExp): number | null {
  const values = captures(text, pattern).map(value => value.trim());
  if (values.length === 0 || !values.every(value => /^[0-9]{1,3}(?:[.,][0-9]{1,2})?$/.test(value))) return null;
  const amounts = values.map(value => Number(value.replace(",", ".")));
  return new Set(amounts).size === 1 ? amounts[0] : null;
}

function earlyFee(text: string, issueYearMonth: number): number | null {
  const fee = String.raw`([-+−]?\s*\d[\d\s.,]*)\s*z[lł]\s*od\s*ka[zż]dej\s*obligacji`;
  if (text.includes("Dla emisji zakupionych do 31 sierpnia 2024") && text.includes("Dla emisji zakupionych od 1 września 2024")) {
    const condition = issueYearMonth < 202409 ? "do 31 sierpnia" : "od 1 września";
    return uniqueFee(text, new RegExp(String.raw`Dla emisji zakupionych ${condition} 2024 r\.[^%]{0,120}?${fee}`, "gi"));
  }
  if (/bez\s+(?:żadnych\s+)?opłat/i.test(text)) {
    return captures(text, new RegExp(fee, "gi")).length === 0 ? 0 : null;
  }
  return uniqueFee(text, new RegExp(fee, "gi"));
}

/** Fail closed: the issue, required rates and applicable fee must be explicit.
 * Marketing and worked examples outside the offer cannot supply these fields. */
export function parseBondEmissionLetter(html: string, code: string): BondParamsInput | null {
  const parts = decomposeBondCode(code);
  if (!parts) return null;
  const spec = BOND_FAMILIES[parts.family];
  const clean = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  const allOffers = captures(clean, /<ul\b[^>]*class=["'][^"']*\bproduct-details__list\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/gi);
  const offers = allOffers.filter(offer => captures(offer, /<li\b[^>]*>([\s\S]*?)<\/li>/gi).map(stripHtml).some(field => /^seria:/i.test(field)));
  if (offers.length !== 1) return null;
  const fields = captures(offers[0], /<li\b[^>]*>([\s\S]*?)<\/li>/gi).map(stripHtml);
  const series = fields.filter(field => /^seria:/i.test(field));
  if (series.length !== 1 || !new RegExp(`^Seria:\\s*${code.trim().toUpperCase()}(?:\\s|$)`, "i").test(series[0])) return null;
  const rates = fields.filter(field => /^oprocentowanie:/i.test(field));
  if (rates.length !== 1) return null;
  const rateText = rates[0];
  const head = rateText.split(/w kolejnych/i)[0];
  const firstPeriodRate = uniqueNumber(head, /^oprocentowanie:\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*%/gi);
  if (firstPeriodRate == null || uniqueNumber(head, /(\d{1,2}(?:[.,]\d{1,2})?)\s*%/g) !== firstPeriodRate) return null;
  let marginOverBase: number;
  if (spec.subsequentBase === "stałe") {
    marginOverBase = firstPeriodRate;
  } else if (spec.subsequentBase === "inflacja") {
    const margin = uniqueNumber(rateText, /mar[zż]a\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*%/gi);
    if (margin == null) return null;
    marginOverBase = margin;
  } else {
    const margin = uniqueNumber(rateText, /stopa\s+referencyjna\s+NBP\s*\+\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*%/gi);
    if (margin != null) marginOverBase = margin;
    else if (/stopa\s+referencyjna\s+NBP\s*[.;]?\s*$/i.test(rateText)) marginOverBase = 0;
    else return null;
  }
  // Alternatives in the later-period formula may omit a repeated label.
  const laterPeriods = rateText.slice(head.length);
  if (captures(laterPeriods, /([0-9]+(?:[.,][0-9]+)?)\s*%/g).some(value => Number(value.replace(",", ".")) !== marginOverBase)) return null;
  const feeSections = captures(clean, /id=["']wczesniejsze-zakonczenie-oszczedzania["'][^>]*>[\s\S]*?<div\b[^>]*class=["'][^"']*accordions__content-inner[^"']*["'][^>]*>([\s\S]*?<\/p>)/gi);
  if (feeSections.length !== 1) return null;
  const maturityDate = new Date(isoDate(parts.maturityYear, parts.maturityMonth - 1, 1));
  const issueDate = new Date(isoDate(parts.maturityYear, parts.maturityMonth - 1 - spec.tenorMonths, 1));
  const earlyRedemptionFee = earlyFee(stripHtml(feeSections[0]), issueDate.getUTCFullYear() * 100 + issueDate.getUTCMonth() + 1);
  if (earlyRedemptionFee == null) return null;
  return {
    earlyRedemptionFee, issueDate, maturityDate, nominalValue: 100, firstPeriodRate,
    subsequentBase: spec.subsequentBase, marginOverBase, capitalization: spec.capitalization,
    interestPayment: spec.interestPayment, parserVersion: BOND_PARSER_VERSION, sourceURL: bondCatalogueUrl(code)!,
  };
}

export async function fetchTreasuryBondParams(code: string): Promise<BondParamsInput | null> {
  const url = bondCatalogueUrl(code);
  if (!url) return null;
  const response = await fetch(url, {
    headers: { accept: "text/html,application/xhtml+xml", "user-agent": "Mozilla/5.0 (compatible; ZeccaWeb/1.0)" },
    next: { revalidate: 24 * 60 * 60 },
  });
  if (!response.ok) return null;
  return parseBondEmissionLetter(await response.text(), code);
}
