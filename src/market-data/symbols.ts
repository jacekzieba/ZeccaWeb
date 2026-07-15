// Legacy instrument symbols were stored with these suffixes (a Stooq-style
// convention from an earlier provider); normalize them to Yahoo suffixes.
const LEGACY_SYMBOL_SUFFIXES: Record<string, string> = {
  ".US": "",
  ".PL": ".WA",
  ".UK": ".L",
  ".NL": ".AS",
};

const YAHOO_EXCHANGES_BY_SUFFIX: Record<string, string> = {
  ".L": "LSE",
  ".AS": "Euronext Amsterdam",
  ".WA": "GPW",
  ".DE": "Xetra",
};

type MarketDataInstrument = {
  symbol: string;
  currency?: string | null;
  isin?: string | null;
  marketDataID?: string | null;
};

const XTB_YAHOO_OVERRIDES = [
  {
    isin: "IE00B3RBWM25",
    symbol: "VWRL.NL",
    settlementCurrency: "USD",
    yahooSymbol: "VWRL.L",
  },
  {
    isin: "IE00BDFL4P12",
    symbol: "ICOM.UK",
    settlementCurrency: "USD",
    yahooSymbol: "ICOM.L",
  },
] as const;

/**
 * Selects the Yahoo line for a holding. A persisted `marketDataID` is an
 * explicit override; the XTB entries keep dual-listed ETFs on the broker's
 * actual trading line and settlement currency.
 */
export function marketDataSymbolForInstrument(instrument: MarketDataInstrument) {
  const explicit = instrument.marketDataID?.trim().toUpperCase();
  if (explicit) return explicit;

  const symbol = instrument.symbol.trim().toUpperCase();
  const currency = instrument.currency?.trim().toUpperCase();
  const isin = instrument.isin?.trim().toUpperCase();
  const override = XTB_YAHOO_OVERRIDES.find(
    (candidate) =>
      currency === candidate.settlementCurrency &&
      (isin === candidate.isin || symbol === candidate.symbol),
  );

  return override?.yahooSymbol ?? yahooSymbolForInstrument(symbol, currency);
}

/** Returns the verified venue for a Yahoo suffix when it is unambiguous. */
export function marketDataExchangeForSymbol(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  return Object.entries(YAHOO_EXCHANGES_BY_SUFFIX).find(([suffix]) =>
    normalized.endsWith(suffix),
  )?.[1] ?? null;
}

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
