import { expect, test } from "@playwright/test";

test("shows a queued sync conflict and lets the user discard it", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("investor-web-pending-sync-v1", JSON.stringify([{
      operationId: "e2e-conflict",
      operation: "upsert",
      recordType: "transaction",
      id: "99999999-9999-4999-8999-999999999999",
      baseUpdatedAt: null,
      createdAt: "2026-06-15T12:00:00.000Z",
      encryptedRecord: {},
      error: "Rekord zmienił się na innym urządzeniu.",
    }]));
  });
  await page.goto("/dashboard");

  await page.getByRole("button", { name: /Konflikt 1/ }).click();
  await expect(page.getByText("Oczekujące zmiany")).toBeVisible();
  await expect(page.getByText("Rekord zmienił się na innym urządzeniu.")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Odrzuć" }).click();
  await expect(page.getByRole("button", { name: /Konflikt 1/ })).toHaveCount(0);
});
