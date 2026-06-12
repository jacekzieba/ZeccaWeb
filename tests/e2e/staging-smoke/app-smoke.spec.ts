import { expect, test } from "@playwright/test";

test("renders login and keeps protected routes behind the auth gate", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/login");

  await expect(page).toHaveTitle(/Zecca/);
  await expect(page.getByRole("heading", { name: "Logowanie" })).toBeVisible();
  await expect(page.getByRole("textbox").first()).toBeVisible();
  await expect(page.getByPlaceholder("••••••••")).toBeVisible();

  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  await expect(page.getByRole("heading", { name: "Logowanie" })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("keeps public health and market data status routes available", async ({ request }) => {
  const health = await request.get("/api/health");
  await expect(health).toBeOK();
  await expect(health.json()).resolves.toMatchObject({
    ok: true,
    service: "ZeccaWeb",
  });

  const status = await request.get("/api/market-data/status");
  await expect(status).toBeOK();
  await expect(status.json()).resolves.toMatchObject({
    providers: {
      yahoo: { configured: true },
      nbp: { configured: true },
      stooq: { requiredEnv: "STOOQ_API_KEY" },
    },
  });

  const pln = await request.get("/api/market-data/fx?code=PLN");
  await expect(pln).toBeOK();
  await expect(pln.json()).resolves.toMatchObject({
    data: {
      provider: "nbp",
      base: "PLN",
      quote: "PLN",
      rate: 1,
    },
  });
});
