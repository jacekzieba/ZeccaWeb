import { NextResponse, type NextRequest } from "next/server";

// Lightweight per-IP fixed-window limiter for the public market-data routes.
// These endpoints proxy external providers (Yahoo/NBP/Stooq) without requiring a
// session, so an unauthenticated client could otherwise hammer them. The state
// is in-memory and therefore per-instance on Fluid Compute — enough to blunt
// abuse from a single origin; a durable cross-instance limit would need KV/Redis.

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 60;

type Window = {
  count: number;
  resetAt: number;
};

const windows = new Map<string, Window>();

function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for may be a comma-separated chain; the first entry is the client.
    return forwarded.split(",")[0]!.trim();
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export type RateLimitResult = {
  limited: boolean;
  retryAfterSeconds: number;
};

export function checkRateLimit(request: NextRequest): RateLimitResult {
  const key = clientKey(request);
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { limited: false, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > MAX_REQUESTS_PER_WINDOW) {
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  return { limited: false, retryAfterSeconds: 0 };
}

/**
 * Returns a 429 response when the caller is over the limit, otherwise null so
 * the route can proceed. Call at the top of each public market-data handler.
 */
export function rateLimitResponse(request: NextRequest): NextResponse | null {
  const result = checkRateLimit(request);
  if (!result.limited) return null;

  return NextResponse.json(
    { error: "Too many requests. Please slow down." },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSeconds) },
    },
  );
}

/** Test helper: clears all tracked windows. */
export function clearRateLimitState() {
  windows.clear();
}
