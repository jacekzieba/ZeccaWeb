import { expect, test } from "@playwright/test";

test("sets a per-portfolio target allocation over all asset classes and persists it", async ({ page }) => {
  await page.goto("/settings");

  const main = page.locator("main");

  // The seeded account row appears once sync data loads, starting without an allocation.
  await expect(main.getByText("Portfel główny", { exact: true })).toBeVisible();
  const allocButton = main.getByRole("button", { name: "Alokacja Portfel główny" });
  await expect(allocButton).toBeVisible();
  await allocButton.click();

  await expect(page.getByText("Alokacja docelowa")).toBeVisible();
  await expect(page.getByText("Portfel główny", { exact: true }).last()).toBeVisible();

  // All six macOS asset classes are present.
  for (const label of ["Akcje / ETF", "Obligacje", "Kryptowaluty", "Inne aktywa", "Lokaty", "Gotówka"]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }

  // Set equity 60, bonds 25, crypto 15 → sum 100.
  await page.getByLabel("Akcje / ETF procent").fill("60");
  await page.getByLabel("Obligacje procent").fill("25");
  await page.getByLabel("Kryptowaluty procent").fill("15");

  await expect(page.getByText("100%", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Zapisz" }).click();

  // Modal closes and the row reflects the saved allocation.
  await expect(page.getByText("Alokacja docelowa")).toBeHidden();
  await expect(main.getByText("Alokacja 100%")).toBeVisible();

  // Reopen and confirm the values round-tripped through the synced record.
  await allocButton.click();
  await expect(page.getByLabel("Akcje / ETF procent")).toHaveValue("60");
  await expect(page.getByLabel("Obligacje procent")).toHaveValue("25");
  await expect(page.getByLabel("Kryptowaluty procent")).toHaveValue("15");

  // Other classes stayed at zero.
  await expect(page.getByLabel("Lokaty procent")).toHaveValue("0");
  await expect(page.getByLabel("Inne aktywa procent")).toHaveValue("0");
});
