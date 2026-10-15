import { expect, test } from "@playwright/test";

test("przełącznik podatku Belki zapisuje ustawienie", async ({ page }) => {
  await page.goto("/settings");
  const belka = page.getByRole("switch", { name: "Podatek Belki" });
  await expect(belka).toBeChecked();

  await belka.click();
  await expect(belka).not.toBeChecked();

  // Stan trzymany w rekordzie settings, więc przeżywa nawigację po stronie.
  await page.locator('a[href="/dashboard"]:visible').first().click();
  await page.locator('a[href="/settings"]:visible').first().click();
  await expect(page.getByRole("switch", { name: "Podatek Belki" })).not.toBeChecked();
});
