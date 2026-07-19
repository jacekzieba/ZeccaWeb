import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Simulate @supabase/ssr rotating the auth cookie during getUser(), as it does
// when the access token is about to expire: setAll fires mid-request with the
// refreshed value before getUser resolves.
vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: unknown,
    _key: unknown,
    config: {
      cookies: {
        setAll: (
          cookies: Array<{ name: string; value: string; options: object }>,
        ) => void;
      };
    },
  ) => ({
    auth: {
      getUser: async () => {
        config.cookies.setAll([
          { name: "sb-auth-token", value: "refreshed", options: {} },
        ]);
        return { data: { user: { id: "user-1" } } };
      },
    },
  }),
}));

import { middleware } from "../../middleware";

describe("middleware session refresh", () => {
  it("forwards the refreshed session cookie to server components", async () => {
    const request = new NextRequest("http://localhost:3000/dashboard", {
      headers: { cookie: "sb-auth-token=stale" },
    });

    const response = await middleware(request);

    // NextResponse.next({ request }) serializes the forwarded request headers
    // as x-middleware-request-*; server components read the session from this
    // Cookie header, so it must carry the rotated token, not the stale one.
    const forwardedCookie = response.headers.get("x-middleware-request-cookie");
    expect(forwardedCookie).toContain("sb-auth-token=refreshed");
  });
});
