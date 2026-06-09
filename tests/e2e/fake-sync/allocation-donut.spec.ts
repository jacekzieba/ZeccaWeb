import { expect, test } from "@playwright/test";

// A9 parity: hovering a slice (or its legend row) reveals that slice's
// share % + name in the donut hole, replacing the default summary.
test("allocation donut shows a center label on hover", async ({ page }) => {
  await page.goto("/reports");

  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Alokacja" }).click();

  const donut = page.getByTestId("allocation-donut");
  await expect(donut).toBeVisible();

  const activePercent = donut.getByTestId("allocation-donut-active-percent");
  const activeLabel = donut.getByTestId("allocation-donut-active-label");

  // Default state: center summary is shown, the active label is empty.
  await expect(donut.locator("text", { hasText: "ALOKACJA" })).toBeVisible();
  await expect(activePercent).toHaveText("");
  await expect(activeLabel).toHaveText("");

  // Hover the first legend row → its share % + name appear in the hole.
  await donut.getByTestId("allocation-donut-legend").first().hover();
  await expect(activePercent).toHaveText(/\d+[,.]\d%/);
  await expect(activeLabel).not.toHaveText("");

  // Moving away (onto another tab) restores the empty center label.
  await main.getByRole("button", { name: "Wyniki" }).hover();
  await expect(activePercent).toHaveText("");
});
