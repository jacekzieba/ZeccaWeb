import { expect, test } from "@playwright/test";

test("fetches a fake quote preview and saves it as a manual valuation", async ({ page }) => {
  await page.goto("/instruments");

  const main = page.getByRole("main");

  await expect(page).toHaveURL(/\/instruments$/);
  await expect(main.getByText("Instrumenty")).toBeVisible();
  await expect(main.getByText("Apple")).toBeVisible();
  await expect(main.getByText("Stooq nie jest skonfigurowany")).toBeVisible();
  await expect(main.getByText("Stooq · brak klucza")).toBeVisible();

  await main.getByRole("button", { name: "Cena" }).click();

  await expect(main.getByText("140,00 USD")).toBeVisible();
  await expect(
    main.getByText("Stooq aapl.us · 2026-05-18 · zapisze jako wycenę manualną"),
  ).toBeVisible();

  await main.getByRole("button", { name: "Zapisz" }).click();

  await expect(main.getByText("Cena została zapisana lokalnie w fake sync.")).toBeVisible();
  await expect(main.getByText("140,00")).toBeVisible();
  await expect(main.getByText("2800 PLN")).toHaveCount(2);
  await expect(main.getByText("zapisze jako wycenę manualną")).toBeHidden();
});
