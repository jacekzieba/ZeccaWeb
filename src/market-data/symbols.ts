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

// Sufiksy giełd XTB → linie Yahoo, jak w natywnym MarketDataIdentityResolver.
// Celowo osobno od LEGACY_SYMBOL_SUFFIXES: tamte służą do odczytu notowań
// (np. „.US” znika), a ta podpowiedź ma dawać dokładnie to samo co aplikacje.
const XTB_VENUE_SUFFIXES: Record<string, string> = {
  NL: ".AS",
  UK: ".L",
  GB: ".L",
  PL: ".WA",
};

/**
 * Linia Yahoo wywnioskowana z tickera brokera i waluty rozliczenia — wierna
 * kopia natywnego `MarketDataIdentityResolver.suggestedIdentity`. `null`, gdy
 * nie da się jej ustalić (np. goły ticker bez sufiksu giełdy).
 */
export function suggestedMarketDataID(symbol: string, currency: string): string | null {
  const raw = symbol.trim().toUpperCase();
  if (!raw) return null;
  // Jak `split(separator:)` w Swift: puste kawałki („VWRL..NL”) pomijamy.
  const [base = raw, suffix] = raw.split(".").filter(Boolean);
  const code = currency.toUpperCase();

  // XTB notuje VWRL.NL i w EUR, i w USD — to różne linie, rozstrzyga waluta.
  if (base === "VWRL") {
    if (code === "EUR") return "VWRL.AS";
    if (code === "USD" || code === "GBP") return "VWRL.L";
    return null;
  }

  // ICOM.UK w XTB to linia LSE w USD, w Yahoo ICOM.L.
  if (base === "ICOM" && (raw.endsWith(".UK") || raw.endsWith(".L"))) {
    return "ICOM.L";
  }

  const venue = suffix === undefined ? undefined : XTB_VENUE_SUFFIXES[suffix];
  if (venue) return `${base}${venue}`;
  return raw.includes(".") ? raw : null;
}

/**
 * Symbol notowań po edycji instrumentu (jak natywne `marketDataIDAfterEdit`).
 * Wpisany (albo wyczyszczony) w tej edycji wygrywa. Nietknięty zostaje, chyba
 * że zmieniła się waluta albo symbol — wtedy stary wskazuje inną linię giełdową
 * (np. VWRL w USD na LSE zamiast w EUR w Amsterdamie) i wyliczamy go od nowa.
 */
export function marketDataIDAfterEdit(input: {
  symbol: string;
  currency: string;
  previousSymbol: string;
  previousCurrency: string;
  previousMarketDataID: string | null | undefined;
  editedMarketDataID: string;
}): string | null {
  const typed = input.editedMarketDataID.trim().toUpperCase() || null;
  const previous = input.previousMarketDataID?.trim().toUpperCase() || null;
  if (typed !== previous) {
    return typed ?? suggestedMarketDataID(input.symbol, input.currency);
  }
  const listingChanged =
    input.currency.toUpperCase() !== input.previousCurrency.toUpperCase() ||
    input.symbol.toUpperCase() !== input.previousSymbol.toUpperCase();
  if (listingChanged || previous === null) {
    return suggestedMarketDataID(input.symbol, input.currency) ?? previous;
  }
  return previous;
}
