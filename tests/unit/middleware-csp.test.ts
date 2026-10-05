import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Gość bez sesji — CSP ma być ustawiony niezależnie od stanu logowania.
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}));

import { middleware } from "../../middleware";

function scriptSrc(csp: string): string {
  const directive = csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("script-src "));
  if (!directive) throw new Error(`brak script-src w: ${csp}`);
  return directive;
}

async function cspFor(path: string): Promise<{ response: string; forwarded: string | null }> {
  const response = await middleware(new NextRequest(`http://localhost:3000${path}`));
  return {
    response: response.headers.get("content-security-policy") ?? "",
    // Next czyta nonce z nagłówka CSP żądania (x-middleware-request-*), żeby
    // ostemplować nim własne skrypty — musi to być ta sama polityka co w odpowiedzi.
    forwarded: response.headers.get("x-middleware-request-content-security-policy"),
  };
}

describe("middleware CSP", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("w produkcji egzekwuje script-src z nonce i strict-dynamic, bez 'unsafe-inline'", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const { response, forwarded } = await cspFor("/");
    const scripts = scriptSrc(response);

    expect(scripts).toMatch(/'nonce-[A-Za-z0-9+/_-]+={0,2}'/);
    expect(scripts).toContain("'strict-dynamic'");
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
    expect(forwarded).toBe(response);
  });

  it("losuje nowy nonce dla każdego żądania", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const nonceOf = (csp: string) => scriptSrc(csp).match(/'nonce-([^']+)'/)?.[1];
    const first = nonceOf((await cspFor("/login")).response);
    const second = nonceOf((await cspFor("/login")).response);

    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(first).not.toBe(second);
  });

  it("przekierowanie do logowania też niesie politykę z nonce", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await middleware(new NextRequest("http://localhost:3000/dashboard"));

    expect(response.status).toBe(307);
    expect(scriptSrc(response.headers.get("content-security-policy") ?? "")).toContain(
      "'strict-dynamic'",
    );
  });
});
