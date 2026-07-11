import { expect, test } from "@playwright/test";

test("adds, edits and removes a cash transaction in fake sync", async ({ page }) => {
  await page.goto("/transactions");

  const main = page.getByRole("main");
  await expect(main.getByText("Transakcje", { exact: true })).toBeVisible();

  await main.getByRole("button", { name: "Dodaj transakcję" }).click();
  const modal = page.locator(".transaction-modal-panel");
  await expect(modal).toBeVisible();
  await modal.getByRole("button", { name: "Wpłata gotówki", exact: true }).click();
  await modal.locator('label:has-text("Portfel") + select').selectOption({ label: "Portfel główny" });
  const grossAmount = modal.locator('label:has-text("Kwota (brutto)") + input');
  await grossAmount.fill("2500");
  await modal.locator(".transaction-modal-submit").click();
  await expect(modal).toBeHidden();

  await main.getByPlaceholder("Szukaj instrumentu, portfela…").fill("Portfel główny");
  const createdAmount = main.getByText("+2500,00", { exact: true });
  const createdRow = createdAmount.locator("..").locator("..");
  await expect(createdRow).toBeVisible();

  await createdRow.getByRole("button", { name: "Edytuj" }).click();
  await expect(modal).toBeVisible();
  await grossAmount.fill("2750");
  await modal.locator(".transaction-modal-submit").click();
  await expect(modal).toBeHidden();
  const editedAmount = main.getByText("+2750,00", { exact: true });
  await expect(editedAmount).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await editedAmount.locator("..").locator("..").getByRole("button", { name: "Usuń" }).click();
  await expect(editedAmount).toBeHidden();
});
