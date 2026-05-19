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
  expect(body.providers.stooq).toMatchObject({
    requiredEnv: "STOOQ_API_KEY",
  });
  expect(typeof body.providers.stooq.configured).toBe("boolean");
});
