import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearMarketDataCache,
  getCachedMarketData,
  setCachedMarketData,
} from "@/market-data/cache";
import {
  parseYahooChart,
  parseYahooChartSeries,
  parseYahooSearch,
} from "@/market-data/providers/yahoo";
import { fetchNbpFxRate } from "@/market-data/providers/nbp";
import {
  fetchGusCpiSeries,
  parseGusCpi,
  parseOfficialMonthlyCpiPage,
} from "@/market-data/providers/gus";

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

describe("parseYahooChartSeries", () => {
  it("returns one daily quote per timestamp, skipping non-trading days", () => {
    const series = parseYahooChartSeries(
      {
        chart: {
          result: [
            {
              meta: { currency: "USD" },
              // 2026-05-14, 2026-05-15, 2026-05-16 (UTC)
              timestamp: [1_778_716_800, 1_778_803_200, 1_778_889_600],
              indicators: {
                quote: [
                  {
                    open: [188, 189, 192],
                    high: [191, 194, 195],
                    low: [187, 188, 191],
                    close: [189, null, 193.25],
                    volume: [10000, null, 12345],
                  },
                ],
              },
            },
          ],
          error: null,
        },
      },
      "AAPL",
    );

    expect(series).toHaveLength(2);
    expect(series[0]).toEqual({
      provider: "yahoo",
      symbol: "AAPL",
      currency: "USD",
      date: "2026-05-14",
      open: 188,
      high: 191,
      low: 187,
      close: 189,
      volume: 10000,
    });
    expect(series[1]).toMatchObject({ date: "2026-05-16", close: 193.25 });
  });

  it("throws when no valid closes are present", () => {
    expect(() =>
      parseYahooChartSeries(
        {
          chart: {
            result: [
              {
                meta: { currency: "USD" },
                timestamp: [1_778_716_800],
                indicators: { quote: [{ close: [null] }] },
              },
            ],
            error: null,
          },
        },
        "AAPL",
      ),
    ).toThrow("no valid price history");
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

describe("parseGusCpi", () => {
  it("keeps only monthly readings within range and converts index to yoy %", () => {
    const observations = parseGusCpi(
      {
        results: [
          {
            values: [
              { year: 2026, val: 103.0, period: "M01" },
              { year: 2026, val: 102.5, period: "M02" },
              // Quarterly/annual readings for the same variable must be skipped.
              { year: 2026, val: 102.8, period: "K1" },
              { year: 2026, val: 102.9, period: "0" },
              // Outside the requested window.
              { year: 2025, val: 102.4, period: "M12" },
            ],
          },
        ],
      },
      "2026-01-01",
      "2026-02-28",
    );

    expect(observations).toEqual([
      { provider: "gus", date: "2026-01-01", yoyRate: 3.0 },
      { provider: "gus", date: "2026-02-01", yoyRate: 2.5 },
    ]);
  });
});

const monthlyCpiPageFixture = `
<html><body>
<table>
<tr><th colspan="13">Analogiczny miesiąc poprzedniego roku = 100</th></tr>
<tr><td>2026</td><td>102,1</td><td>102,1</td><td>103,0</td><td>103,2</td><td>103,1</td></tr>
<tr><td>2025</td><td>104,9</td><td>104,9</td><td>104,9</td><td>104,3</td><td>104,0</td><td>104,1</td></tr>
</table>
<table>
<tr><th colspan="13">Analogiczny okres narastający poprzedniego roku = 100</th></tr>
<tr><td>2026</td><td>102,1</td></tr>
</table>
</body></html>
`;

describe("parseOfficialMonthlyCpiPage", () => {
  it("parses the 'analogiczny miesiąc' table and converts index to yoy %, filtered by range", () => {
    const observations = parseOfficialMonthlyCpiPage(
      monthlyCpiPageFixture,
      "2026-01-01",
      "2026-12-31",
    );

    expect(observations).toEqual([
      { provider: "gus", date: "2026-01-01", yoyRate: 2.1 },
      { provider: "gus", date: "2026-02-01", yoyRate: 2.1 },
      { provider: "gus", date: "2026-03-01", yoyRate: 3.0 },
      { provider: "gus", date: "2026-04-01", yoyRate: 3.2 },
      { provider: "gus", date: "2026-05-01", yoyRate: 3.1 },
    ]);
  });

  it("returns an empty array when the expected section heading is missing", () => {
    expect(parseOfficialMonthlyCpiPage("<html>no data here</html>", "2026-01-01", "2026-12-31")).toEqual(
      [],
    );
  });
});

describe("fetchGusCpiSeries", () => {
  it("queries the BDL API for the requested year span and parses the response", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            { values: [{ year: 2026, val: 103.0, period: "M01" }] },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const series = await fetchGusCpiSeries("2026-01-01", "2026-01-31");

    expect(series).toEqual([{ provider: "gus", date: "2026-01-01", yoyRate: 3.0 }]);
    const requestedUrl = String(fetchMock.mock.calls[0][0]);
    expect(requestedUrl).toContain("bdl.stat.gov.pl/api/v1/data/by-variable/217230");
    expect(requestedUrl).toContain("year=2026");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the official monthly CPI page when BDL has no monthly reading (annual-only)", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        // BDL's headline CPI variable is published annually, not monthly:
        // no `period` field, so parseGusCpi filters it out entirely.
        new Response(
          JSON.stringify({ results: [{ values: [{ year: "2026", val: 103.6 }] }] }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(new Response(monthlyCpiPageFixture, { status: 200 }));

    const series = await fetchGusCpiSeries("2026-01-01", "2026-02-28");

    expect(series).toEqual([
      { provider: "gus", date: "2026-01-01", yoyRate: 2.1 },
      { provider: "gus", date: "2026-02-01", yoyRate: 2.1 },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain("stat.gov.pl");
  });

  it("rejects a malformed date range without calling the API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(fetchGusCpiSeries("2026-01", "2026-02-28")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws when the BDL API responds with an error status, without falling back", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("", { status: 500 }));

    await expect(fetchGusCpiSeries("2026-01-01", "2026-01-31")).rejects.toThrow("500");
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
