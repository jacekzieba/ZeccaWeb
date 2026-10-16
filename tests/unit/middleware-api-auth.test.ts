import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}));

import { middleware } from "../../middleware";

describe("middleware bez sesji", () => {
  it("chronione API odpowiada 401 JSON, a nie przekierowaniem na stronę logowania", async () => {
    // fetch idzie za przekierowaniem i dostaje HTML /login ze statusem 200 —
    // klient pokazywał wtedy błąd parsowania JSON zamiast „sesja wygasła”.
    const response = await middleware(new NextRequest("http://localhost:3000/api/sync/bootstrap"));

    expect(response.status).toBe(401);
    expect(response.headers.get("location")).toBeNull();
    await expect(response.json()).resolves.toMatchObject({ error: expect.any(String) });
  });

  it("chroniona strona nadal przekierowuje na /login z parametrem next", async () => {
    const response = await middleware(new NextRequest("http://localhost:3000/dashboard?tab=1"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/dashboard?tab=1");
  });
});
