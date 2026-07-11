import { expect, test } from "@playwright/test";

test("command palette searches pages and navigates with the keyboard", async ({ page }) => {
  await page.goto("/dashboard");

  await page.keyboard.press("Meta+k");
  const search = page.getByPlaceholder("Szukaj instrumentu, transakcji, portfela…");
  await expect(search).toBeFocused();

  await search.fill("porównanie");
  await expect(page.getByRole("button", { name: /Porównanie/ })).toBeVisible();
  await search.press("Enter");

  await expect(page).toHaveURL(/\/benchmark$/);
  await expect(page.getByText("Porównanie portfolio")).toBeVisible();
});

test("positions can be filtered and expose an instrument transaction history", async ({ page }) => {
  await page.goto("/positions");

  const main = page.getByRole("main");
  await expect(main.getByText("Pozycje", { exact: true })).toBeVisible();
  await expect(main.getByLabel("Pokaż transakcje instrumentu AAPL")).toBeVisible();

  await main.getByRole("button", { name: "Lokaty", exact: true }).click();
  await expect(main.getByLabel("Pokaż transakcje instrumentu AAPL")).toBeHidden();

  await main.getByRole("button", { name: "Wszystkie", exact: true }).click();
  await main.getByLabel("Pokaż transakcje instrumentu AAPL").click();

  const history = page.getByRole("dialog", { name: "AAPL" });
  await expect(history).toBeVisible();
  await expect(history.getByRole("columnheader", { name: "Data" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(history).toBeHidden();
});

test("benchmark selector updates the comparison and model allocation", async ({ page }) => {
  await page.goto("/benchmark");

  const main = page.getByRole("main");
  await expect(main.getByText("Twój portfel vs All Weather")).toBeVisible();

  await main.getByRole("button", { name: /S&P 500/ }).click();

  await expect(main.getByText("Twój portfel vs S&P 500")).toBeVisible();
  await expect(main.getByText("Skład modelu S&P 500")).toBeVisible();
  await expect(main.getByText("Akcje USA", { exact: true })).toBeVisible();
  await expect(main.getByText("100%", { exact: true })).toBeVisible();
});
