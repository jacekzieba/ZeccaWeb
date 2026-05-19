import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearMarketDataCache } from "@/market-data/cache";
import { fetchNbpFxRate } from "@/market-data/providers/nbp";
import { fetchStooqQuote } from "@/market-data/providers/stooq";
import { GET as getFxRate } from "../../app/api/market-data/fx/route";
import { GET as getQuote } from "../../app/api/market-data/quote/route";
import { GET as getMarketDataStatus } from "../../app/api/market-data/status/route";

vi.mock("@/market-data/providers/nbp", () => ({
  fetchNbpFxRate: vi.fn(),
}));

vi.mock("@/market-data/providers/stooq", () => ({
  fetchStooqQuote: vi.fn(),
}));

const mockedFetchNbpFxRate = vi.mocked(fetchNbpFxRate);
const mockedFetchStooqQuote = vi.mocked(fetchStooqQuote);

function request(url: string) {
  return new NextRequest(url);
}

afterEach(() => {
  vi.restoreAllMocks();
  clearMarketDataCache();
  delete process.env.STOOQ_API_KEY;
});

describe("GET /api/market-data/quote", () => {
  it("fetches a Stooq quote once and then serves the cached value", async () => {
    mockedFetchStooqQuote.mockResolvedValue({
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

    const first = await getQuote(request("http://localhost/api/market-data/quote?symbol=AAPL.US"));
    const second = await getQuote(request("http://localhost/api/market-data/quote?symbol=aapl.us"));

    await expect(first.json()).resolves.toMatchObject({
      data: {
        symbol: "aapl.us",
        close: 193.25,
      },
      cache: {
        hit: false,
      },
    });
    await expect(second.json()).resolves.toMatchObject({
      data: {
        symbol: "aapl.us",
        close: 193.25,
      },
      cache: {
        hit: true,
      },
    });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mockedFetchStooqQuote).toHaveBeenCalledTimes(1);
    expect(mockedFetchStooqQuote).toHaveBeenCalledWith("aapl.us");
  });

  it("returns a validation error when symbol is missing", async () => {
    const response = await getQuote(request("http://localhost/api/market-data/quote"));

    await expect(response.json()).resolves.toEqual({ error: "Missing symbol." });
    expect(response.status).toBe(400);
    expect(mockedFetchStooqQuote).not.toHaveBeenCalled();
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
});

describe("GET /api/market-data/status", () => {
  it("reports whether Stooq is configured", async () => {
    process.env.STOOQ_API_KEY = "test-key";

    const response = await getMarketDataStatus();

    await expect(response.json()).resolves.toEqual({
      providers: {
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
