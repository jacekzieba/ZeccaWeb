import { expect, test } from "@playwright/test";
import { chooseOption } from "../support/select";
import { confirmDialog } from "../support/confirm";

test("adds, edits and removes an empty portfolio in fake sync", async ({ page }) => {
  await page.goto("/portfolios");

  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Dodaj portfel" }).click();
  const form = page.locator("form").filter({ has: page.getByText("Nazwa portfela", { exact: true }) });
  await form.getByPlaceholder("np. IKZE, Obligacje, Interactive Brokers").fill("E2E Portfel");
  await chooseOption(form.getByRole("combobox", { name: "Typ portfela" }), "IKE");
  await form.getByRole("button", { name: "Dodaj portfel" }).click();

  const createdLink = main.getByRole("link", { name: "E2E Portfel", exact: true });
  await expect(createdLink).toBeVisible();
  const createdRow = createdLink.locator("..").locator("..").locator("..");
  await createdRow.getByRole("button", { name: "Edytuj" }).click();

  await expect(form.getByRole("combobox", { name: "Typ portfela" })).toContainText("IKE");
  await form.getByPlaceholder("np. IKZE, Obligacje, Interactive Brokers").fill("E2E Portfel edytowany");
  await chooseOption(form.getByRole("combobox", { name: "Typ portfela" }), "IKZE");
  await form.getByRole("button", { name: "Zapisz zmiany" }).click();

  const editedLink = main.getByRole("link", { name: "E2E Portfel edytowany", exact: true });
  await expect(editedLink).toBeVisible();
  await editedLink.locator("..").locator("..").locator("..").getByRole("button", { name: "Edytuj" }).click();
  await expect(form.getByRole("combobox", { name: "Typ portfela" })).toContainText("IKZE");
  await form.getByRole("button", { name: "Anuluj" }).click();
  await editedLink.locator("..").locator("..").locator("..").getByRole("button", { name: "Usuń" }).click();
  await confirmDialog(page);
  await expect(editedLink).toBeHidden();
});
