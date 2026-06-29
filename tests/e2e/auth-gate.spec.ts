import { expect, test } from "@playwright/test";

test("redirects protected routes to login with the next parameter", async ({ page }) => {
  await page.goto("/import");

  await expect(page).toHaveURL(/\/login\?next=%2Fimport$/);
  await expect(page.getByRole("heading", { name: "Logowanie" })).toBeVisible();
});

test("keeps public market data routes outside the auth gate", async ({ request }) => {
  const response = await request.get("/api/market-data/fx?code=PLN");

  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("application/json");
  await expect(response.json()).resolves.toMatchObject({
    data: {
      provider: "nbp",
      base: "PLN",
      quote: "PLN",
      rate: 1,
    },
  });
});

test("keeps beta waitlist API outside the auth gate", async ({ request }) => {
  const response = await request.post("/api/beta-waitlist", {
    data: {
      email: "beta@example.com",
      consent: true,
      company: "e2e honeypot",
      source: "e2e",
    },
  });

  expect([200, 503]).toContain(response.status());
  expect(response.headers()["content-type"]).toContain("application/json");
  const body = await response.json();
  expect(body).toEqual(
    response.status() === 200
      ? { ok: true }
      : { error: "Zapisy nie są jeszcze aktywne." },
  );
});

test("exposes market data provider status without auth", async ({ request }) => {
  const response = await request.get("/api/market-data/status");

  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("application/json");
  const body = await response.json();
  expect(body).toMatchObject({
    providers: {
      yahoo: {
        configured: true,
      },
      nbp: {
        configured: true,
      },
    },
  });
});
