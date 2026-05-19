import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearMarketDataCache,
  getCachedMarketData,
  setCachedMarketData,
} from "@/market-data/cache";
import { parseStooqCsv } from "@/market-data/providers/stooq";
import { parseYahooChart } from "@/market-data/providers/yahoo";

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

describe("parseYahooChart", () => {
  it("parses a chart response", () => {
    expect(
      parseYahooChart(
        yahooChartResponse({
          regularMarketPrice: 193.25,
          regularMarketTime: 1_778_803_200,
          close: [189, 193.25],
        }),
        "AAPL",
      ),
    ).toEqual({
      provider: "yahoo",
      symbol: "AAPL",
      currency: "USD",
      date: "2026-05-15",
      open: 190.5,
      high: 195.2,
      low: 188.4,
      close: 193.25,
      volume: 12345,
    });
  });

  it("falls back to the latest close when regular market price is missing", () => {
    expect(
      parseYahooChart(
        yahooChartResponse({
          regularMarketPrice: null,
          regularMarketTime: 1_778_889_600,
          close: [189, null, 193.25],
        }),
        "AAPL",
      ),
    ).toMatchObject({
      date: "2026-05-16",
      close: 193.25,
    });
  });

  it("surfaces Yahoo chart errors", () => {
    expect(() =>
      parseYahooChart(
        {
          chart: {
            result: null,
            error: { description: "No data found" },
          },
        },
        "MISSING",
      ),
    ).toThrow("No data found");
  });
});

describe("parseStooqCsv", () => {
  it("parses a daily OHLCV row for fallback quotes", () => {
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
});

function yahooChartResponse(input: {
  regularMarketPrice: number | null;
  regularMarketTime: number;
  close: Array<number | null>;
}) {
  return {
    chart: {
      result: [
        {
          meta: {
            currency: "USD",
            regularMarketPrice: input.regularMarketPrice,
            regularMarketTime: input.regularMarketTime,
          },
          indicators: {
            quote: [
              {
                open: [185, 190.5],
                high: [190, 195.2],
                low: [184, 188.4],
                close: input.close,
                volume: [10000, 12345],
              },
            ],
          },
        },
      ],
      error: null,
    },
  };
}
