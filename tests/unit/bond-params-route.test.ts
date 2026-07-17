import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearMarketDataCache } from "@/market-data/cache";
import { clearRateLimitState } from "@/market-data/rate-limit";
import { fetchTreasuryBondParams } from "@/market-data/providers/treasury-bond-params";
import { GET as getBondParams } from "../../app/api/market-data/bond-params/route";

vi.mock("@/market-data/providers/treasury-bond-params", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/market-data/providers/treasury-bond-params")>();
  return { ...actual, fetchTreasuryBondParams: vi.fn() };
});

const mockedFetch = vi.mocked(fetchTreasuryBondParams);

function request(code: string) {
  return new NextRequest(`http://localhost/api/market-data/bond-params?code=${code}`);
}

afterEach(() => {
  vi.restoreAllMocks();
  clearMarketDataCache();
  clearRateLimitState();
});

describe("GET /api/market-data/bond-params", () => {
  it("serves a curated catalog series without hitting the network", async () => {
    const response = await getBondParams(request("ROS1228"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.source).toBe("catalog");
    expect(body.data).toMatchObject({ firstPeriodRate: 7.2, subsequentBase: "inflacja" });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("scrapes and caches an unknown series", async () => {
    mockedFetch.mockResolvedValue({
      issueDate: new Date("2026-07-01T00:00:00.000Z"),
      maturityDate: new Date("2036-07-01T00:00:00.000Z"),
      nominalValue: 100,
      firstPeriodRate: 5.35,
      subsequentBase: "inflacja",
      marginOverBase: 2,
      capitalization: "roczna",
      interestPayment: "przy wykupie",
    });

    const first = await getBondParams(request("EDO0736"));
    const firstBody = await first.json();
    expect(first.status).toBe(200);
    expect(firstBody.source).toBe("scrape");
    expect(firstBody.data.firstPeriodRate).toBe(5.35);
    expect(firstBody.data.issueDate).toBe("2026-07-01T00:00:00.000Z");

    const second = await getBondParams(request("EDO0736"));
    expect((await second.json()).cache).toEqual({ hit: true });
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it("rejects a malformed code before any lookup", async () => {
    const response = await getBondParams(request("AAPL"));
    expect(response.status).toBe(400);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("returns 404 when the series has no emission letter", async () => {
    mockedFetch.mockResolvedValue(null);
    const response = await getBondParams(request("EDO0199"));
    expect(response.status).toBe(404);
  });
});
