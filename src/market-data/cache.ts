import type { MarketDataCacheEntry } from "@/market-data/types";

/** Klucze pochodzą z zapytań (wyszukiwarka przy każdym znaku, dowolne zakresy
 * dat), a instancja serwera obsługuje wiele żądań — bez limitu Map rosła do
 * końca życia instancji, bo wygasły wpis znikał tylko przy odczycie tego klucza. */
export const MARKET_DATA_CACHE_MAX_ENTRIES = 500;

const cache = new Map<string, MarketDataCacheEntry<unknown>>();

export function getCachedMarketData<TValue>(key: string): MarketDataCacheEntry<TValue> | null {
  const entry = cache.get(key) as MarketDataCacheEntry<TValue> | undefined;
  if (!entry) return null;

  if (new Date(entry.expiresAt).getTime() <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry;
}

export function setCachedMarketData<TValue>(
  key: string,
  value: TValue,
  ttlMs: number,
): MarketDataCacheEntry<TValue> {
  const now = new Date();
  const entry = {
    value,
    fetchedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
  } satisfies MarketDataCacheEntry<TValue>;

  cache.delete(key);
  if (cache.size >= MARKET_DATA_CACHE_MAX_ENTRIES) evictForInsert(now.getTime());
  cache.set(key, entry as MarketDataCacheEntry<unknown>);
  return entry;
}

/** Najpierw wygasłe, potem najstarsze (Map trzyma kolejność wstawiania). */
function evictForInsert(nowMs: number) {
  for (const [key, entry] of cache) {
    if (new Date(entry.expiresAt).getTime() <= nowMs) cache.delete(key);
  }
  for (const key of cache.keys()) {
    if (cache.size < MARKET_DATA_CACHE_MAX_ENTRIES) break;
    cache.delete(key);
  }
}

export function clearMarketDataCache() {
  cache.clear();
}
