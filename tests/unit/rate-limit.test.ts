import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { checkRateLimit, clearRateLimitState } from "@/market-data/rate-limit";

afterEach(() => {
  clearRateLimitState();
});

describe("rate-limit clientKey", () => {
  it("counts a stable x-real-ip against one bucket even when x-forwarded-for is rotated", () => {
    let lastLimited = false;
    // The limiter allows 60/window; 61 calls sharing the same x-real-ip must trip
    // it, even though each request spoofs a fresh x-forwarded-for entry.
    for (let i = 0; i < 61; i += 1) {
      const request = new NextRequest("http://localhost/api/market-data/fx?code=USD", {
        headers: {
          "x-real-ip": "203.0.113.7",
          "x-forwarded-for": `198.51.100.${i}`,
        },
      });
      lastLimited = checkRateLimit(request).limited;
    }

    expect(lastLimited).toBe(true);
  });
});
