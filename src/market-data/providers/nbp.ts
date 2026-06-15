import { z } from "zod";
import type { FxRate } from "@/market-data/types";

const nbpRateSchema = z.object({
  table: z.string(),
  code: z.string(),
  rates: z
    .array(
      z.object({
        effectiveDate: z.string(),
        mid: z.number(),
      }),
    )
    .min(1),
});

// NBP only publishes table A on Polish business days, so asking for an exact
// weekend/holiday date returns 404. When a date is requested we query a short
// window ending on that date and take the most recent published rate on or
// before it, mirroring how a valuation "as of" a non-trading day should use the
// last known fixing.
const NBP_LOOKBACK_DAYS = 14;

export async function fetchNbpFxRate(
  code: string,
  date?: string | null,
): Promise<FxRate> {
  const normalizedCode = code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalizedCode)) {
    throw new Error("Currency code must use ISO 4217 format.");
  }

  if (normalizedCode === "PLN") {
    return {
      provider: "nbp",
      base: "PLN",
      quote: "PLN",
      rate: 1,
      effectiveDate: date ?? new Date().toISOString().slice(0, 10),
      table: "A",
    };
  }

  const url = date
    ? `https://api.nbp.pl/api/exchangerates/rates/a/${normalizedCode}/${lookbackStart(date)}/${date}/?format=json`
    : `https://api.nbp.pl/api/exchangerates/rates/a/${normalizedCode}/?format=json`;
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    next: { revalidate: 60 * 60 },
  });

  if (!response.ok) {
    throw new Error(`NBP returned ${response.status} for ${normalizedCode}.`);
  }

  const parsed = nbpRateSchema.parse(await response.json());
  // Range responses are ascending by date, so the last entry is the most recent
  // published rate on or before the requested date.
  const rate = parsed.rates[parsed.rates.length - 1];

  return {
    provider: "nbp",
    base: parsed.code,
    quote: "PLN",
    rate: rate.mid,
    effectiveDate: rate.effectiveDate,
    table: parsed.table,
  };
}

function lookbackStart(date: string): string {
  const end = new Date(`${date}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() - NBP_LOOKBACK_DAYS);
  return end.toISOString().slice(0, 10);
}

// NBP caps a single range request at 367 days, so longer windows are fetched
// in chunks and concatenated. Used to convert a multi-year valuation series
// into a non-PLN display currency at the rate that applied on each day.
const NBP_MAX_RANGE_DAYS = 360;

export async function fetchNbpFxRateSeries(
  code: string,
  start: string,
  end: string,
): Promise<FxRate[]> {
  const normalizedCode = code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalizedCode)) {
    throw new Error("Currency code must use ISO 4217 format.");
  }

  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new Error("Invalid FX series range.");
  }

  if (normalizedCode === "PLN") {
    return [
      { provider: "nbp", base: "PLN", quote: "PLN", rate: 1, effectiveDate: end, table: "A" },
    ];
  }

  const rates: FxRate[] = [];
  let windowStart = new Date(startDate);

  while (windowStart.getTime() <= endDate.getTime()) {
    const windowEnd = new Date(windowStart);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + NBP_MAX_RANGE_DAYS);
    const clampedEnd = windowEnd.getTime() > endDate.getTime() ? endDate : windowEnd;

    const url = `https://api.nbp.pl/api/exchangerates/rates/a/${normalizedCode}/${windowStart
      .toISOString()
      .slice(0, 10)}/${clampedEnd.toISOString().slice(0, 10)}/?format=json`;
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate: 60 * 60 },
    });

    // A window with no publishing days (e.g. holidays only) returns 404; skip
    // it rather than failing the whole series.
    if (response.ok) {
      const parsed = nbpRateSchema.parse(await response.json());
      for (const rate of parsed.rates) {
        rates.push({
          provider: "nbp",
          base: parsed.code,
          quote: "PLN",
          rate: rate.mid,
          effectiveDate: rate.effectiveDate,
          table: parsed.table,
        });
      }
    } else if (response.status !== 404) {
      throw new Error(`NBP returned ${response.status} for ${normalizedCode}.`);
    }

    windowStart = new Date(clampedEnd);
    windowStart.setUTCDate(windowStart.getUTCDate() + 1);
  }

  return rates;
}

export async function fetchNbpMonthlyAverageFxRate(
  code: string,
  year: number,
  month: number,
): Promise<FxRate> {
  const normalizedCode = code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalizedCode)) {
    throw new Error("Currency code must use ISO 4217 format.");
  }
  if (!Number.isInteger(year) || year < 2001 || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Invalid FX month.");
  }

  const monthText = String(month).padStart(2, "0");
  const start = `${year}-${monthText}-01`;
  const endDate = new Date(Date.UTC(year, month, 0));
  const end = endDate.toISOString().slice(0, 10);

  if (normalizedCode === "PLN") {
    return {
      provider: "nbp",
      base: "PLN",
      quote: "PLN",
      rate: 1,
      effectiveDate: `${year}-${monthText}`,
      table: "A",
    };
  }

  const url = `https://api.nbp.pl/api/exchangerates/rates/a/${normalizedCode}/${start}/${end}/?format=json`;
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    next: { revalidate: 60 * 60 },
  });

  if (!response.ok) {
    throw new Error(`NBP returned ${response.status} for ${normalizedCode}.`);
  }

  const parsed = nbpRateSchema.parse(await response.json());
  const total = parsed.rates.reduce((sum, item) => sum + item.mid, 0);

  return {
    provider: "nbp",
    base: parsed.code,
    quote: "PLN",
    rate: total / parsed.rates.length,
    effectiveDate: `${year}-${monthText}`,
    table: parsed.table,
  };
}
