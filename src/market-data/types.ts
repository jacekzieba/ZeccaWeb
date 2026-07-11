export type MarketDataCacheEntry<TValue> = {
  value: TValue;
  fetchedAt: string;
  expiresAt: string;
};

export type FxRate = {
  provider: "nbp";
  base: string;
  quote: "PLN";
  rate: number;
  effectiveDate: string;
  table: string;
};

export type MarketQuote = {
  provider: "yahoo";
  symbol: string;
  currency: string | null;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

export type InstrumentCandidate = {
  provider: "yahoo";
  symbol: string;
  name: string;
  exchange: string | null;
  currency: string | null;
  kind: "stock" | "etf";
};

/** Monthly CPI r/r reading (%) for a given month, keyed by `date` = "RRRR-MM-01". */
export type CpiObservation = {
  provider: "gus";
  date: string;
  yoyRate: number;
};
