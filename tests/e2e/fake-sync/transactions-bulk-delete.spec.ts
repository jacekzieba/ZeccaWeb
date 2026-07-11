import { expect, test } from "@playwright/test";

test("filters transactions by type and deletes the visible selection", async ({ page }) => {
  await page.goto("/transactions");

  const main = page.getByRole("main");
  const filters = main.getByRole("combobox");
  await filters.nth(1).selectOption({ label: "Wpłata" });
  await expect(main.getByLabel("Zaznacz transakcję cashDeposit")).not.toHaveCount(0);

  await main.getByLabel("Zaznacz widoczne transakcje").check();
  await expect(main.getByText(/Zaznaczone: \d+/)).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await main.getByRole("button", { name: "Usuń zaznaczone" }).click();

  await expect(main.getByText("Brak transakcji dla wybranych filtrów")).toBeVisible();
});
