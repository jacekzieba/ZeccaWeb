// Legacy instrument symbols were stored with these suffixes (a Stooq-style
// convention from an earlier provider); normalize them to Yahoo suffixes.
const LEGACY_SYMBOL_SUFFIXES: Record<string, string> = {
  ".US": "",
  ".PL": ".WA",
  ".UK": ".L",
  ".NL": ".AS",
};

export function yahooSymbolForInstrument(symbol: string, currency?: string | null) {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) {
    return normalized;
  }

  for (const [legacySuffix, yahooSuffix] of Object.entries(LEGACY_SYMBOL_SUFFIXES)) {
    if (normalized.endsWith(legacySuffix)) {
      return `${normalized.slice(0, -legacySuffix.length)}${yahooSuffix}`;
    }
  }

  if (normalized.includes(".") || normalized.includes("-") || normalized.includes("=")) {
    return normalized;
  }

  if (currency === "PLN") {
    return `${normalized}.WA`;
  }

  if (currency === "GBP") {
    return `${normalized}.L`;
  }

  return normalized;
}
