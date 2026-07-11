/**
 * ETF identity catalog (ported from the native inwestomat catalog). Enriches
 * newly created import instruments with ISIN, full name, and domicile.
 *
 * It deliberately carries NO currency: the source's currency column is the
 * fund's base/dividend currency, which differs from the settlement currency for
 * dual-listed venues (LSE). Settlement currency stays the job of the currency
 * ladder + FX inference. See the ETF catalog enrichment spec.
 *
 * The bundled data (`data/etf-catalog.json`, ~2200 entries) is large, so load
 * it via `loadEtfCatalog()` (a code-split dynamic import) only in the import
 * flow — never import the JSON statically into the parser.
 */

export type EtfCatalogEntry = {
  ticker: string;
  isin: string | null;
  name: string;
  domicile: string | null;
};

export type EtfCatalog = {
  lookup(ticker: string): EtfCatalogEntry | null;
};

function baseTicker(ticker: string): string {
  const upper = ticker.trim().toUpperCase();
  const dot = upper.indexOf(".");
  return dot >= 0 ? upper.slice(0, dot) : upper;
}

export function buildEtfCatalog(entries: EtfCatalogEntry[]): EtfCatalog {
  const byTicker = new Map<string, EtfCatalogEntry>();
  for (const e of entries) {
    const key = e.ticker.toUpperCase();
    if (!byTicker.has(key)) byTicker.set(key, e); // first entry wins, mirroring native
  }
  return {
    lookup(ticker: string): EtfCatalogEntry | null {
      const upper = ticker.trim().toUpperCase();
      return byTicker.get(upper) ?? byTicker.get(baseTicker(upper)) ?? null;
    },
  };
}

let cached: EtfCatalog | null = null;

/** Lazily loads the bundled catalog (code-split). Cached after first call. */
export async function loadEtfCatalog(): Promise<EtfCatalog> {
  if (cached) return cached;
  const { default: entries } = await import("./data/etf-catalog.json");
  cached = buildEtfCatalog(entries as EtfCatalogEntry[]);
  return cached;
}
