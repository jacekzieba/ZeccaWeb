import { expect, test } from "@playwright/test";

test("fetches a fake quote preview and saves it as a manual valuation", async ({ page }) => {
  await page.goto("/instruments");

  const main = page.getByRole("main");

  await expect(page).toHaveURL(/\/instruments$/);
  await expect(main.getByText("Instrumenty")).toBeVisible();
  await expect(main.getByText("Apple")).toBeVisible();
  await expect(main.getByText("Yahoo Finance jest skonfigurowany")).toBeVisible();
  await expect(main.getByText("Yahoo · OK · Stooq")).toBeVisible();

  await main.getByRole("button", { name: "Cena" }).click();

  await expect(main.getByText("140,00 USD")).toBeVisible();
  await expect(
    main.getByText("Yahoo AAPL · 2026-05-18 · zapisze jako wycenę manualną"),
  ).toBeVisible();

  await main.getByRole("button", { name: "Zapisz" }).click();

  await expect(main.getByText("Cena została zapisana lokalnie w fake sync.")).toBeVisible();
  await expect(main.getByText("140,00")).toBeVisible();
  await expect(main.getByText(/\d+ PLN/).first()).toBeVisible();
  await expect(main.getByText("zapisze jako wycenę manualną")).toBeHidden();
});
