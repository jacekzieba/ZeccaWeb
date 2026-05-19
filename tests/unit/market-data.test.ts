import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearMarketDataCache,
  getCachedMarketData,
  setCachedMarketData,
} from "@/market-data/cache";
import { parseStooqCsv } from "@/market-data/providers/stooq";

afterEach(() => {
  vi.useRealTimers();
  clearMarketDataCache();
});

describe("market data cache", () => {
  it("returns values before ttl and evicts expired entries", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-17T10:00:00.000Z"));

    setCachedMarketData("fx:USD", { rate: 4 }, 60_000);
    expect(getCachedMarketData<{ rate: number }>("fx:USD")?.value.rate).toBe(4);

    vi.setSystemTime(new Date("2026-05-17T10:01:01.000Z"));
    expect(getCachedMarketData("fx:USD")).toBeNull();
  });
});

describe("parseStooqCsv", () => {
  it("parses a daily OHLCV row", () => {
    expect(
      parseStooqCsv(
        ["Date,Open,High,Low,Close,Volume", "2026-05-15,190,195,188,193.25,12345"].join(
          "\n",
        ),
        "aapl.us",
      ),
    ).toEqual({
      provider: "stooq",
      symbol: "aapl.us",
      currency: "USD",
      date: "2026-05-15",
      open: 190,
      high: 195,
      low: 188,
      close: 193.25,
      volume: 12345,
    });
  });

  it("uses the latest row from a daily OHLCV history", () => {
    expect(
      parseStooqCsv(
        [
          "Date,Open,High,Low,Close,Volume",
          "2026-05-14,185,190,184,189,10000",
          "2026-05-15,190,195,188,193.25,12345",
        ].join("\n"),
        "aapl.us",
      ),
    ).toMatchObject({
      date: "2026-05-15",
      close: 193.25,
    });
  });
});
