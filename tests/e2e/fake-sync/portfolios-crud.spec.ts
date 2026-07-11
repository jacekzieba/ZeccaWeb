import { expect, test } from "@playwright/test";

test("adds, edits and removes an empty portfolio in fake sync", async ({ page }) => {
  await page.goto("/portfolios");

  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Dodaj portfel" }).click();
  const form = page.locator("form").filter({ has: page.getByText("Nazwa portfela", { exact: true }) });
  await form.getByPlaceholder("np. IKZE, Obligacje, Interactive Brokers").fill("E2E Portfel");
  await form.getByRole("button", { name: "Dodaj portfel" }).click();

  const createdLink = main.getByRole("link", { name: "E2E Portfel", exact: true });
  await expect(createdLink).toBeVisible();
  const createdRow = createdLink.locator("..").locator("..").locator("..");
  await createdRow.getByRole("button", { name: "Edytuj" }).click();

  await form.getByPlaceholder("np. IKZE, Obligacje, Interactive Brokers").fill("E2E Portfel edytowany");
  await form.getByRole("button", { name: "Zapisz zmiany" }).click();

  const editedLink = main.getByRole("link", { name: "E2E Portfel edytowany", exact: true });
  await expect(editedLink).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await editedLink.locator("..").locator("..").locator("..").getByRole("button", { name: "Usuń" }).click();
  await expect(editedLink).toBeHidden();
});
