import { z } from "zod";
import type { MarketQuote } from "@/market-data/types";

const stooqRowSchema = z.object({
  Date: z.string().min(1),
  Open: z.string().min(1),
  High: z.string().min(1),
  Low: z.string().min(1),
  Close: z.string().min(1),
  Volume: z.string().optional(),
});

export async function fetchStooqQuote(symbol: string): Promise<MarketQuote> {
  const normalizedSymbol = normalizeStooqSymbol(symbol);
  const apiKey = process.env.STOOQ_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("STOOQ_API_KEY is required for Stooq CSV downloads.");
  }

  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(normalizedSymbol)}&i=d&apikey=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    headers: { accept: "text/csv" },
    next: { revalidate: 15 * 60 },
  });

  if (!response.ok) {
    throw new Error(`Stooq returned ${response.status} for ${normalizedSymbol}.`);
  }

  return parseStooqCsv(await response.text(), normalizedSymbol);
}

export function parseStooqCsv(csv: string, symbol: string): MarketQuote {
  const lines = csv
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);

  const [headerLine, ...rowLines] = lines;
  const rowLine = rowLines.at(-1);
  if (!headerLine || !rowLine || rowLine.toLowerCase().includes("no data")) {
    throw new Error("Stooq returned no quote data.");
  }

  const headers = headerLine.split(",");
  const values = rowLine.split(",");
  const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  const parsed = stooqRowSchema.parse(row);

  return {
    provider: "stooq",
    symbol: symbol.toLowerCase(),
    currency: inferCurrency(symbol),
    date: parsed.Date,
    open: parseNumber(parsed.Open),
    high: parseNumber(parsed.High),
    low: parseNumber(parsed.Low),
    close: parseNumber(parsed.Close),
    volume: parsed.Volume ? parseNumber(parsed.Volume) : null,
  };
}

function normalizeStooqSymbol(symbol: string) {
  const normalized = symbol.trim().toLowerCase();
  if (!/^[a-z0-9._-]{1,32}$/.test(normalized)) {
    throw new Error("Invalid Stooq symbol.");
  }
  return normalized;
}

function parseNumber(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Invalid numeric market data value.");
  }
  return parsed;
}

function inferCurrency(symbol: string) {
  const lower = symbol.toLowerCase();
  if (lower.endsWith(".us")) return "USD";
  if (lower.endsWith(".uk")) return "GBP";
  if (lower.endsWith(".pl")) return "PLN";
  return null;
}
