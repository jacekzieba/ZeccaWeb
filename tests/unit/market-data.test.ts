import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearMarketDataCache,
  getCachedMarketData,
  setCachedMarketData,
} from "@/market-data/cache";
import { parseStooqCsv } from "@/market-data/providers/stooq";
import { parseYahooChart, parseYahooSearch } from "@/market-data/providers/yahoo";
import { fetchNbpFxRate } from "@/market-data/providers/nbp";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
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

describe("parseYahooSearch", () => {
  it("maps quote types to instrument kinds and prefers the long name", () => {
    expect(
      parseYahooSearch({
        quotes: [
          {
            symbol: "AAPL",
            shortname: "Apple",
            longname: "Apple Inc.",
            exchDisp: "NASDAQ",
            quoteType: "EQUITY",
            currency: "USD",
          },
          {
            symbol: "VWCE.DE",
            shortname: "VANG FTSE AW",
            longname: "Vanguard FTSE All-World UCITS ETF",
            exchDisp: "XETRA",
            quoteType: "ETF",
            currency: "EUR",
          },
          {
            symbol: "VTSAX",
            shortname: "Vanguard Total Stock",
            quoteType: "MUTUALFUND",
            currency: "USD",
          },
        ],
      }),
    ).toEqual([
      {
        provider: "yahoo",
        symbol: "AAPL",
        name: "Apple Inc.",
        exchange: "NASDAQ",
        currency: "USD",
        kind: "stock",
      },
      {
        provider: "yahoo",
        symbol: "VWCE.DE",
        name: "Vanguard FTSE All-World UCITS ETF",
        exchange: "XETRA",
        currency: "EUR",
        kind: "etf",
      },
      {
        provider: "yahoo",
        symbol: "VTSAX",
        name: "Vanguard Total Stock",
        exchange: null,
        currency: "USD",
        kind: "etf",
      },
    ]);
  });

  it("skips unsupported quote types and entries without a symbol", () => {
    expect(
      parseYahooSearch({
        quotes: [
          { symbol: "^GSPC", shortname: "S&P 500", quoteType: "INDEX" },
          { symbol: "EURUSD=X", shortname: "EUR/USD", quoteType: "CURRENCY" },
          { shortname: "No symbol", quoteType: "EQUITY" },
          { symbol: "MSFT", shortname: "Microsoft", quoteType: "EQUITY" },
        ],
      }),
    ).toEqual([
      {
        provider: "yahoo",
        symbol: "MSFT",
        name: "Microsoft",
        exchange: null,
        currency: null,
        kind: "stock",
      },
    ]);
  });

  it("filters by kind when a filter is supplied", () => {
    const json = {
      quotes: [
        { symbol: "AAPL", shortname: "Apple", quoteType: "EQUITY" },
        { symbol: "VWCE.DE", shortname: "Vanguard", quoteType: "ETF" },
      ],
    };

    expect(parseYahooSearch(json, "etf")).toEqual([
      {
        provider: "yahoo",
        symbol: "VWCE.DE",
        name: "Vanguard",
        exchange: null,
        currency: null,
        kind: "etf",
      },
    ]);
  });

  it("falls back to the symbol when no name is provided and tolerates missing quotes", () => {
    expect(parseYahooSearch({ quotes: [{ symbol: "TSLA", quoteType: "EQUITY" }] })).toEqual([
      {
        provider: "yahoo",
        symbol: "TSLA",
        name: "TSLA",
        exchange: null,
        currency: null,
        kind: "stock",
      },
    ]);
    expect(parseYahooSearch({})).toEqual([]);
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

describe("fetchNbpFxRate", () => {
  it("queries a lookback range for a dated request and uses the last published rate", async () => {
    // 2026-06-14 is a Sunday; NBP has no fixing, but the range window covers the
    // prior business days and we should fall back to the most recent one.
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          table: "A",
          code: "USD",
          rates: [
            { effectiveDate: "2026-06-11", mid: 3.71 },
            { effectiveDate: "2026-06-12", mid: 3.74 },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const rate = await fetchNbpFxRate("USD", "2026-06-14");

    expect(rate.rate).toBe(3.74);
    expect(rate.effectiveDate).toBe("2026-06-12");
    const requestedUrl = String(fetchMock.mock.calls[0][0]);
    expect(requestedUrl).toContain("/2026-05-31/2026-06-14/");
  });

  it("uses the latest endpoint when no date is given", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          table: "A",
          code: "EUR",
          rates: [{ effectiveDate: "2026-06-12", mid: 4.28 }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const rate = await fetchNbpFxRate("EUR");

    expect(rate.rate).toBe(4.28);
    const requestedUrl = String(fetchMock.mock.calls[0][0]);
    expect(requestedUrl).toBe(
      "https://api.nbp.pl/api/exchangerates/rates/a/EUR/?format=json",
    );
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
