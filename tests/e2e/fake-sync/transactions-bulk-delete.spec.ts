import { expect, test } from "@playwright/test";
import { chooseOption } from "../support/select";
import { confirmDialog } from "../support/confirm";

test("filters transactions by type and deletes the visible selection", async ({ page }) => {
  await page.goto("/transactions");

  const main = page.getByRole("main");
  const filters = main.getByRole("combobox");
  await chooseOption(filters.nth(1), "Wpłata");
  await expect(main.getByRole("checkbox", { name: /^Zaznacz transakcję: Wpłata/ })).not.toHaveCount(0);

  await main.getByLabel("Zaznacz widoczne transakcje").check();
  await expect(main.getByText(/Zaznaczone: \d+/)).toBeVisible();
  await main.getByRole("button", { name: "Usuń zaznaczone" }).click();
  await confirmDialog(page);

  await expect(main.getByText("Brak transakcji dla wybranych filtrów")).toBeVisible();
});
