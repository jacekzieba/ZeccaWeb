import { expect, test } from "@playwright/test";

test("reports show target vs actual per asset class once a plan is set", async ({ page }) => {
  await page.goto("/reports");
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Alokacja" }).click();

  // No plan yet: native empty-state copy, actual shares still listed.
  await expect(main.getByText("Brak ustawionej alokacji docelowej.")).toBeVisible();
  await expect(main.getByTestId("allocation-gap-equity")).toBeVisible();

  await page.goto("/settings");
  await page.getByRole("button", { name: "Alokacja Portfel główny" }).click();
  await page.getByLabel("Akcje / ETF procent").fill("60");
  await page.getByLabel("Obligacje procent").fill("40");
  await page.getByRole("button", { name: "Zapisz" }).click();
  await expect(page.getByText("Alokacja docelowa")).toBeHidden();

  // Client-side navigation keeps the in-memory fake store.
  await page.locator('a[href="/reports"]:visible').first().click();
  await expect(page).toHaveURL(/\/reports/);
  await page.getByRole("main").getByRole("button", { name: "Alokacja" }).click();

  const equity = page.getByTestId("allocation-gap-equity");
  // Aggregate target = each portfolio's plan weighted by its share of total value
  // (native parity), so only the first portfolio's 60% contributes a fraction.
  await expect(equity).toHaveText(/\/ \d+,\d{2}%[+-]\d+,\d{2}pp/);
  await expect(equity).not.toContainText("/ 0,00%");
  await expect(page.getByText("Brak ustawionej alokacji docelowej.")).toBeHidden();
});
