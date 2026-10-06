import { expect, test } from "@playwright/test";

// Czysta przeglądarka — bez decyzji zapisanej w playwright.config.ts.
test.use({ storageState: { cookies: [], origins: [] } });

test("asks a fresh visitor about usage statistics and remembers the refusal", async ({ page }) => {
  await page.goto("/");

  const prompt = page.getByRole("region", { name: "Pomóż ulepszać Zecca" });
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: "Nie, dziękuję" }).click();
  await expect(prompt).toBeHidden();

  await page.reload();
  await expect(page.locator(".zlanding")).toHaveClass(/js-reveal/);
  await expect(prompt).toHaveCount(0);
});
