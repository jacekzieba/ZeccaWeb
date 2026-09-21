import { expect, test } from "@playwright/test";

test("manually refreshes the web snapshot from the global topbar", async ({ page }) => {
  await page.goto("/dashboard");

  const syncButton = page.getByRole("button", { name: "Synchronizuj teraz" });
  await expect(syncButton).toBeVisible();
  await syncButton.click();

  // Na stronie jest kilka regionów role=status (baner jakości danych, ukryty komunikat
  // powłoki) — sprawdzamy ten z komunikatem, nie pierwszy z brzegu.
  await expect(page.getByRole("status").filter({ hasText: "Dane zsynchronizowane." })).toBeVisible();
  await expect(syncButton).toBeEnabled();
});
