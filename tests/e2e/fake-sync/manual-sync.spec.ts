import { expect, test } from "@playwright/test";

test("manually refreshes the web snapshot from the global topbar", async ({ page }) => {
  await page.goto("/dashboard");

  const syncButton = page.getByRole("button", { name: "Synchronizuj teraz" });
  await expect(syncButton).toBeVisible();
  await syncButton.click();

  await expect(page.getByRole("status")).toHaveText("Dane zsynchronizowane.");
  await expect(syncButton).toBeEnabled();
});
