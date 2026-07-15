import { expect, test } from "@playwright/test";

test("adds, edits and removes an unheld instrument in fake sync", async ({ page }) => {
  await page.goto("/instruments");

  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Dodaj instrument" }).click();
  const form = page.locator("form").filter({ has: page.getByText("Symbol", { exact: true }) });
  await form.getByLabel("Symbol").fill("E2E1");
  await form.getByLabel("Nazwa").fill("E2E Instrument");
  await form.getByLabel("Ticker Yahoo").fill("E2E1");
  await form.getByRole("button", { name: "Dodaj instrument" }).click();

  const createdRow = main.getByRole("row", { name: "E2E1 E2E Instrument" });
  await expect(createdRow).toBeVisible();
  await createdRow.getByRole("button", { name: "Edytuj" }).click();

  await form.getByLabel("Nazwa").fill("E2E Instrument edytowany");
  await form.getByRole("button", { name: "Zapisz zmiany" }).click();

  const editedRow = main.getByRole("row", { name: "E2E1 E2E Instrument edytowany" });
  await expect(editedRow).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await editedRow.getByRole("button", { name: "Usuń" }).click();
  await expect(editedRow).toBeHidden();
});
