const LEGACY_STOOQ_SUFFIXES: Record<string, string> = {
  ".US": "",
  ".PL": ".WA",
  ".UK": ".L",
};

export function yahooSymbolForInstrument(symbol: string, currency?: string | null) {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) {
    return normalized;
  }

  for (const [stooqSuffix, yahooSuffix] of Object.entries(LEGACY_STOOQ_SUFFIXES)) {
    if (normalized.endsWith(stooqSuffix)) {
      return `${normalized.slice(0, -stooqSuffix.length)}${yahooSuffix}`;
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

export function stooqSymbolForInstrument(symbol: string, currency?: string | null) {
  const normalized = symbol.trim().toLowerCase();
  if (!normalized) {
    return normalized;
  }

  if (normalized.endsWith(".wa")) {
    return `${normalized.slice(0, -3)}.pl`;
  }

  if (normalized.endsWith(".l")) {
    return `${normalized.slice(0, -2)}.uk`;
  }

  if (normalized.includes(".")) {
    return normalized;
  }

  if (currency === "PLN") {
    return `${normalized}.pl`;
  }

  if (currency === "GBP") {
    return `${normalized}.uk`;
  }

  if (currency === "USD") {
    return `${normalized}.us`;
  }

  return normalized;
}
