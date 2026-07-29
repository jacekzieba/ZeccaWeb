import { expect, test, type Page } from "@playwright/test";

// These run against the real auth gate (no fake sync), which is the point:
// the demo cookie must open the app *pages* for a signed-out visitor while
// every protected `/api/*` route stays closed.

const BASE_URL = "http://127.0.0.1:3100";

async function enterDemo(page: Page) {
  await page.context().addCookies([
    { name: "zecca-demo", value: "1", url: BASE_URL },
  ]);
}

test("demo cookie opens the app pages with sample data", async ({ page }) => {
  await enterDemo(page);
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("demo-badge")).toBeVisible();
  await expect(page.getByTestId("dashboard-grid")).toBeVisible();

  // Sample data is seeded without replaying the tour — reloading a page deeper
  // in the app must not throw the visitor back into the intro cards.
  await expect(page.getByTestId("onboarding-next")).toHaveCount(0);
  await expect(page.getByTestId("tour-next")).toHaveCount(0);

  // Every analysis screen is reachable.
  for (const [label, path] of [
    ["Pozycje", "/positions"],
    ["Transakcje", "/transactions"],
    ["Instrumenty", "/instruments"],
    ["Zarobki", "/earnings"],
    ["Porównanie", "/benchmark"],
    ["Raporty", "/reports"],
  ] as const) {
    await page.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByTestId("demo-badge")).toBeVisible();
  }
});

test("demo can open the transaction form but not save it", async ({ page }) => {
  await enterDemo(page);
  await page.goto("/dashboard");

  await page.getByRole("button", { name: "Dodaj transakcję" }).click();

  await expect(
    page.getByText("Tryb demo — możesz obejrzeć cały formularz", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Dodaj zakup" })).toBeDisabled();
});

test("demo explains that import is off and hides account deletion", async ({ page }) => {
  await enterDemo(page);

  await page.goto("/import");
  await expect(page.getByText("Import jest wyłączony w trybie demo")).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("button", { name: "Usuń konto" })).toHaveCount(0);
});

test("demo cookie does not open protected API routes", async ({ page }) => {
  await enterDemo(page);
  await page.goto("/dashboard");

  const response = await page.request.get("/api/sync/bootstrap", {
    maxRedirects: 0,
  });

  expect(response.status()).toBe(307);
  expect(response.headers()["location"]).toContain("/login");
});

test("leaving the demo restores the auth gate", async ({ page }) => {
  await enterDemo(page);
  await page.goto("/dashboard");

  await page.getByTestId("exit-demo").click();
  await expect(page).toHaveURL(`${BASE_URL}/`);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
});
