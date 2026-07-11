import { z } from "zod";
import type { CpiObservation } from "@/market-data/types";

// Klient API GUS BDL: https://api.stat.gov.pl/Home/BdlApi
//
// CPI r/r (Polska) to zmienna 217230 ("wskaźnik cen towarów i usług
// konsumpcyjnych, analogiczny miesiąc poprzedniego roku = 100") — ta sama
// zmienna, którą pobiera natywny GUSInflationProvider. W BDL ten wskaźnik
// jest jednak publikowany wyłącznie rocznie (subject P2955 ma
// `"quarterly": "R"` dla każdego roku, brak podziału miesięcznego), więc
// zapytanie o dane miesięczne zawsze wraca puste — dokładnie jak w natywnej
// implementacji, która w tym wypadku zawsze spada do fallbacku: strony GUS z
// miesięcznymi wskaźnikami cen (parsowanej z HTML), będącej w praktyce
// jedynym źródłem miesięcznego CPI r/r na żywo.
//
// Endpoint BDL: /api/v1/data/by-variable/{id}?format=json&unit-level=0&year=YYYY
// unit-level=0 = poziom krajowy.

const CPI_YOY_VARIABLE_ID = 217230;
const BDL_BASE_URL = "https://bdl.stat.gov.pl/api/v1";
const FALLBACK_MONTHLY_CPI_URL =
  "https://stat.gov.pl/obszary-tematyczne/ceny-handel/wskazniki-cen/wskazniki-cen-towarow-i-uslug-konsumpcyjnych-pot-inflacja-/miesieczne-wskazniki-cen-towarow-i-uslug-konsumpcyjnych-od-1982-roku";

const bdlResponseSchema = z.object({
  results: z.array(
    z.object({
      values: z.array(
        z.object({
          year: z.union([z.number(), z.string()]),
          val: z.number(),
          period: z.string().optional().default(""),
        }),
      ),
    }),
  ),
});

function isMonthlyPeriod(period: string): boolean {
  return /^M(0[1-9]|1[0-2])$/.test(period);
}

function validateRange(start: string, end: string): { fromYear: number; toYear: number } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    throw new Error("Invalid CPI series range.");
  }
  const fromYear = Number(start.slice(0, 4));
  const toYear = Number(end.slice(0, 4));
  if (fromYear > toYear) {
    throw new Error("Invalid CPI series range.");
  }
  return { fromYear, toYear };
}

export async function fetchGusCpiSeries(
  start: string,
  end: string,
): Promise<CpiObservation[]> {
  validateRange(start, end);

  const bdlObservations = await fetchBdlCpi(start, end);
  if (bdlObservations.length > 0) {
    return bdlObservations;
  }

  return fetchFallbackMonthlyCpi(start, end);
}

async function fetchBdlCpi(start: string, end: string): Promise<CpiObservation[]> {
  const { fromYear, toYear } = validateRange(start, end);

  const params = new URLSearchParams({
    format: "json",
    "unit-level": "0",
    "page-size": "100",
    lang: "pl",
  });
  for (let year = fromYear; year <= toYear; year += 1) {
    params.append("year", String(year));
  }

  const url = `${BDL_BASE_URL}/data/by-variable/${CPI_YOY_VARIABLE_ID}?${params.toString()}`;
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    next: { revalidate: 6 * 60 * 60 },
  });

  if (!response.ok) {
    throw new Error(`GUS BDL returned ${response.status}.`);
  }

  return parseGusCpi(await response.json(), start, end);
}

async function fetchFallbackMonthlyCpi(start: string, end: string): Promise<CpiObservation[]> {
  const response = await fetch(FALLBACK_MONTHLY_CPI_URL, {
    headers: { accept: "text/html,application/xhtml+xml" },
    next: { revalidate: 6 * 60 * 60 },
  });

  if (!response.ok) {
    throw new Error(`GUS monthly CPI page returned ${response.status}.`);
  }

  return parseOfficialMonthlyCpiPage(await response.text(), start, end);
}

export function parseGusCpi(json: unknown, start: string, end: string): CpiObservation[] {
  const payload = bdlResponseSchema.parse(json);

  const observations: CpiObservation[] = [];
  for (const result of payload.results) {
    for (const value of result.values) {
      if (!isMonthlyPeriod(value.period)) continue;
      const year = typeof value.year === "number" ? value.year : Number(value.year);
      if (!Number.isInteger(year)) continue;
      const month = value.period.slice(1);
      const date = `${year}-${month}-01`;
      if (date < start || date > end) continue;
      observations.push({ provider: "gus", date, yoyRate: value.val - 100 });
    }
  }

  return observations.sort((a, b) => a.date.localeCompare(b.date));
}

const SECTION_START_PATTERN = /Analogiczny\s+miesiąc\s+poprzedniego\s+roku\s*=\s*100/;
const SECTION_END_PATTERN = /Analogiczny\s+okres\s+narastający\s+poprzedniego\s+roku\s*=\s*100/;
// A 4-digit year (not itself part of a longer digit run) followed by 1-12
// "space + d,d" monthly index values, e.g. "2026 102,1 102,1 103,0".
const ROW_PATTERN = /(?<!\d)(\d{4})((?:\s+\d{1,4},\d){1,12})/g;

/**
 * Parses GUS's official "monthly CPI indicators" page — the table under
 * "Analogiczny miesiąc poprzedniego roku = 100" lists, per year, the
 * index value (previous-year-month = 100) for each published month in
 * order. Mirrors the native GUSInflationProvider's HTML fallback parser.
 */
export function parseOfficialMonthlyCpiPage(
  html: string,
  start: string,
  end: string,
): CpiObservation[] {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#160;/g, " ")
    .replace(/\s+/g, " ");

  const startMatch = SECTION_START_PATTERN.exec(text);
  if (!startMatch) return [];

  const tail = text.slice(startMatch.index + startMatch[0].length);
  const endMatch = SECTION_END_PATTERN.exec(tail);
  const section = endMatch ? tail.slice(0, endMatch.index) : tail;

  const observations: CpiObservation[] = [];
  for (const match of section.matchAll(ROW_PATTERN)) {
    const year = Number(match[1]);
    const values = match[2]
      .trim()
      .split(/\s+/)
      .map((value) => Number(value.replace(",", ".")));

    values.forEach((indexValue, offset) => {
      const month = String(offset + 1).padStart(2, "0");
      const date = `${year}-${month}-01`;
      if (date < start || date > end) return;
      // GUS publishes the index to 1 decimal place; round off float noise
      // from the "102,1" -> 102.1 -> 2.0999999999999943 comma-decimal parse.
      const yoyRate = Math.round((indexValue - 100) * 10) / 10;
      observations.push({ provider: "gus", date, yoyRate });
    });
  }

  return observations.sort((a, b) => a.date.localeCompare(b.date));
}
