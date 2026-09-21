import { expect, test } from "@playwright/test";
import { chooseOption } from "../support/select";
import { confirmDialog } from "../support/confirm";

test("adds, edits and removes a cash transaction in fake sync", async ({ page }) => {
  await page.goto("/transactions");

  const main = page.getByRole("main");
  await expect(main.getByText("Transakcje", { exact: true }).first()).toBeVisible();

  await main.getByRole("button", { name: "Dodaj transakcję" }).click();
  const modal = page.locator(".transaction-modal-panel");
  await expect(modal).toBeVisible();
  await modal.getByRole("button", { name: "Wpłata gotówki", exact: true }).click();
  await chooseOption(modal.getByRole("combobox", { name: "Portfel" }), "Portfel główny");
  const grossAmount = modal.getByRole("textbox", { name: "Kwota (brutto)" });
  await grossAmount.fill("2500");
  await modal.getByRole("button", { name: /^Dodaj/ }).click();
  await expect(modal).toBeHidden();

  const createdRow = main.getByRole("row").filter({ hasText: /\+2[\s  ]?500,00/ }).first();
  await expect(createdRow).toBeVisible();

  await createdRow.getByRole("button", { name: /^Edytuj/ }).click();
  await expect(modal).toBeVisible();
  await grossAmount.fill("2750");
  await modal.getByRole("button", { name: /^(Zapisz|Dodaj|Aktualizuj)/ }).click();
  await expect(modal).toBeHidden();
  const editedRow = main.getByRole("row").filter({ hasText: /\+2[\s  ]?750,00/ }).first();
  await expect(editedRow).toBeVisible();

  await editedRow.getByRole("button", { name: /^Usuń/ }).click();
  await confirmDialog(page);
  await expect(editedRow).toBeHidden();
});
