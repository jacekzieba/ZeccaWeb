import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearMarketDataCache } from "@/market-data/cache";
import { clearRateLimitState } from "@/market-data/rate-limit";
import {
  fetchNbpFxRate,
  fetchNbpMonthlyAverageFxRate,
} from "@/market-data/providers/nbp";
import { fetchStooqQuote } from "@/market-data/providers/stooq";
import { fetchYahooQuote } from "@/market-data/providers/yahoo";
import { GET as getFxRate } from "../../app/api/market-data/fx/route";
import { GET as getQuote } from "../../app/api/market-data/quote/route";
import { GET as getMarketDataStatus } from "../../app/api/market-data/status/route";

vi.mock("@/market-data/providers/nbp", () => ({
  fetchNbpFxRate: vi.fn(),
  fetchNbpMonthlyAverageFxRate: vi.fn(),
}));

vi.mock("@/market-data/providers/yahoo", () => ({
  fetchYahooQuote: vi.fn(),
}));

vi.mock("@/market-data/providers/stooq", () => ({
  fetchStooqQuote: vi.fn(),
}));

const mockedFetchNbpFxRate = vi.mocked(fetchNbpFxRate);
const mockedFetchNbpMonthlyAverageFxRate = vi.mocked(fetchNbpMonthlyAverageFxRate);
const mockedFetchYahooQuote = vi.mocked(fetchYahooQuote);
const mockedFetchStooqQuote = vi.mocked(fetchStooqQuote);

function request(url: string) {
  return new NextRequest(url);
}

afterEach(() => {
  vi.restoreAllMocks();
  clearMarketDataCache();
  clearRateLimitState();
  delete process.env.STOOQ_API_KEY;
});

describe("market-data rate limiting", () => {
  it("returns 429 with Retry-After once a single IP exceeds the window", async () => {
    mockedFetchNbpFxRate.mockResolvedValue({
      provider: "nbp",
      base: "USD",
      quote: "PLN",
      rate: 3.74,
      effectiveDate: "2026-06-12",
      table: "A",
    });

    const headers = { "x-forwarded-for": "203.0.113.7" };
    let lastStatus = 200;
    // The limiter allows 60/min; 61 calls from the same IP must trip it.
    for (let i = 0; i < 61; i += 1) {
      const response = await getFxRate(
        new NextRequest("http://localhost/api/market-data/fx?code=USD", { headers }),
      );
      lastStatus = response.status;
      if (response.status === 429) {
        expect(response.headers.get("Retry-After")).toBeTruthy();
        break;
      }
    }

    expect(lastStatus).toBe(429);
  });

  it("tracks limits per IP, so a different IP is unaffected", async () => {
    mockedFetchNbpFxRate.mockResolvedValue({
      provider: "nbp",
      base: "USD",
      quote: "PLN",
      rate: 3.74,
      effectiveDate: "2026-06-12",
      table: "A",
    });

    for (let i = 0; i < 61; i += 1) {
      await getFxRate(
        new NextRequest("http://localhost/api/market-data/fx?code=USD", {
          headers: { "x-forwarded-for": "203.0.113.7" },
        }),
      );
    }

    const otherIp = await getFxRate(
      new NextRequest("http://localhost/api/market-data/fx?code=USD", {
        headers: { "x-forwarded-for": "198.51.100.2" },
      }),
    );

    expect(otherIp.status).toBe(200);
  });
});

describe("GET /api/market-data/quote", () => {
  it("fetches a Yahoo quote once and then serves the cached value", async () => {
    mockedFetchYahooQuote.mockResolvedValue({
      provider: "yahoo",
      symbol: "AAPL",
      currency: "USD",
      date: "2026-05-15",
      open: 190,
      high: 195,
      low: 188,
      close: 193.25,
      volume: 12345,
    });

    const first = await getQuote(request("http://localhost/api/market-data/quote?symbol=AAPL"));
    const second = await getQuote(request("http://localhost/api/market-data/quote?symbol=aapl"));

    await expect(first.json()).resolves.toMatchObject({
      data: {
        symbol: "AAPL",
        close: 193.25,
      },
      cache: {
        hit: false,
      },
    });
    await expect(second.json()).resolves.toMatchObject({
      data: {
        symbol: "AAPL",
        close: 193.25,
      },
      cache: {
        hit: true,
      },
    });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mockedFetchYahooQuote).toHaveBeenCalledTimes(1);
    expect(mockedFetchYahooQuote).toHaveBeenCalledWith("AAPL");
  });

  it("normalizes legacy Stooq suffixes before calling Yahoo", async () => {
    mockedFetchYahooQuote.mockResolvedValue({
      provider: "yahoo",
      symbol: "CDR.WA",
      currency: "PLN",
      date: "2026-05-15",
      open: 320,
      high: 330,
      low: 318,
      close: 325,
      volume: 1000,
    });

    const response = await getQuote(request("http://localhost/api/market-data/quote?symbol=cdr.pl"));

    await expect(response.json()).resolves.toMatchObject({
      data: {
        symbol: "CDR.WA",
        close: 325,
      },
    });
    expect(response.status).toBe(200);
    expect(mockedFetchYahooQuote).toHaveBeenCalledWith("CDR.WA");
  });

  it("falls back to Stooq when Yahoo fails and Stooq is configured", async () => {
    process.env.STOOQ_API_KEY = "test-key";
    mockedFetchYahooQuote.mockRejectedValue(new Error("Yahoo Finance returned no quote data."));
    mockedFetchStooqQuote.mockResolvedValue({
      provider: "stooq",
      symbol: "cdr.pl",
      currency: "PLN",
      date: "2026-05-15",
      open: 320,
      high: 330,
      low: 318,
      close: 325,
      volume: 1000,
    });

    const response = await getQuote(request("http://localhost/api/market-data/quote?symbol=CDR&currency=PLN"));

    await expect(response.json()).resolves.toMatchObject({
      data: {
        provider: "stooq",
        symbol: "cdr.pl",
        close: 325,
      },
      fallback: {
        from: "yahoo",
      },
    });
    expect(response.status).toBe(200);
    expect(mockedFetchYahooQuote).toHaveBeenCalledWith("CDR.WA");
    expect(mockedFetchStooqQuote).toHaveBeenCalledWith("cdr.pl");
  });

  it("does not call Stooq fallback when it is not configured", async () => {
    mockedFetchYahooQuote.mockRejectedValue(new Error("Yahoo failed."));

    const response = await getQuote(request("http://localhost/api/market-data/quote?symbol=CDR&currency=PLN"));

    await expect(response.json()).resolves.toEqual({ error: "Yahoo failed." });
    expect(response.status).toBe(502);
    expect(mockedFetchStooqQuote).not.toHaveBeenCalled();
  });

  it("returns a validation error when symbol is missing", async () => {
    const response = await getQuote(request("http://localhost/api/market-data/quote"));

    await expect(response.json()).resolves.toEqual({ error: "Missing symbol." });
    expect(response.status).toBe(400);
    expect(mockedFetchYahooQuote).not.toHaveBeenCalled();
  });
});

describe("GET /api/market-data/fx", () => {
  it("fetches an NBP FX rate once and then serves the cached value for the date", async () => {
    mockedFetchNbpFxRate.mockResolvedValue({
      provider: "nbp",
      base: "USD",
      quote: "PLN",
      rate: 3.92,
      effectiveDate: "2026-05-15",
      table: "A",
    });

    const first = await getFxRate(request("http://localhost/api/market-data/fx?code=usd&date=2026-05-15"));
    const second = await getFxRate(request("http://localhost/api/market-data/fx?code=USD&date=2026-05-15"));

    await expect(first.json()).resolves.toMatchObject({
      data: {
        base: "USD",
        quote: "PLN",
        effectiveDate: "2026-05-15",
        rate: 3.92,
      },
      cache: {
        hit: false,
      },
    });
    await expect(second.json()).resolves.toMatchObject({
      data: {
        base: "USD",
        rate: 3.92,
      },
      cache: {
        hit: true,
      },
    });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mockedFetchNbpFxRate).toHaveBeenCalledTimes(1);
    expect(mockedFetchNbpFxRate).toHaveBeenCalledWith("usd", "2026-05-15");
  });

  it("rejects invalid date formats before calling NBP", async () => {
    const response = await getFxRate(request("http://localhost/api/market-data/fx?code=USD&date=15-05-2026"));

    await expect(response.json()).resolves.toEqual({ error: "Invalid date format." });
    expect(response.status).toBe(400);
    expect(mockedFetchNbpFxRate).not.toHaveBeenCalled();
  });

  it("fetches and caches an NBP monthly average FX rate", async () => {
    mockedFetchNbpMonthlyAverageFxRate.mockResolvedValue({
      provider: "nbp",
      base: "EUR",
      quote: "PLN",
      rate: 4.31,
      effectiveDate: "2026-05",
      table: "A",
    });

    const first = await getFxRate(request("http://localhost/api/market-data/fx?code=eur&year=2026&month=5"));
    const second = await getFxRate(request("http://localhost/api/market-data/fx?code=EUR&year=2026&month=5"));

    await expect(first.json()).resolves.toMatchObject({
      data: {
        base: "EUR",
        effectiveDate: "2026-05",
        rate: 4.31,
      },
      cache: {
        hit: false,
      },
    });
    await expect(second.json()).resolves.toMatchObject({
      cache: {
        hit: true,
      },
    });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mockedFetchNbpMonthlyAverageFxRate).toHaveBeenCalledTimes(1);
    expect(mockedFetchNbpMonthlyAverageFxRate).toHaveBeenCalledWith("eur", 2026, 5);
    expect(mockedFetchNbpFxRate).not.toHaveBeenCalled();
  });
});

describe("GET /api/market-data/status", () => {
  it("reports whether Yahoo and Stooq are configured", async () => {
    process.env.STOOQ_API_KEY = "test-key";
    const response = await getMarketDataStatus(request("http://localhost/api/market-data/status"));

    await expect(response.json()).resolves.toEqual({
      providers: {
        yahoo: {
          configured: true,
        },
        stooq: {
          configured: true,
          requiredEnv: "STOOQ_API_KEY",
        },
        nbp: {
          configured: true,
        },
      },
    });
    expect(response.status).toBe(200);
  });
});
