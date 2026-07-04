import { expect, test } from "@playwright/test";

test("shows macOS-style income records and supports fake-sync CRUD", async ({ page }) => {
  await page.goto("/earnings");

  const main = page.getByRole("main");
  await expect(page).toHaveURL(/\/earnings$/);
  await expect(main.getByText("UoP, B2B i obciążenia miesięczne zsynchronizowane z macOS")).toBeVisible();
  await expect(main.getByText("Wynagrodzenie · fake sync")).toBeVisible();
  await expect(main.getByText("Faktura miesięczna · fake sync")).toBeVisible();
  await expect(main.getByText("ZUS · fake sync")).toBeVisible();

  await main.getByRole("button", { name: "Obciążenia" }).click();
  await expect(main.getByText("ZUS · fake sync")).toBeVisible();
  await expect(main.getByText("Wynagrodzenie · fake sync")).toBeHidden();
  await main.getByRole("button", { name: "Wszystko" }).click();

  await main.getByRole("button", { name: "Dodaj wynagrodzenie" }).click();
  // Scope to the modal dialog — the month-pagination buttons in the chart
  // behind it ("Pokaż nowsze/starsze miesiące") also match "Miesiąc".
  const addDialog = page.getByRole("dialog", { name: "Nowy wpis zarobku" });
  await expect(addDialog).toBeVisible();
  await addDialog.getByLabel("Rok").fill("2026");
  await addDialog.getByLabel("Miesiąc").selectOption("6");
  await addDialog.getByLabel("Dochód").fill("12345");
  await addDialog.getByPlaceholder("np. Wynagrodzenie, Faktura miesięczna").fill("E2E Salary");
  await addDialog.getByRole("button", { name: "Zapisz" }).click();

  await expect(main.getByText("Zarobek zapisany lokalnie w fake sync.")).toBeVisible();
  await expect(main.getByText("E2E Salary")).toBeVisible();

  await main.getByLabel("Edytuj").first().click();
  const editDialog = page.getByRole("dialog", { name: "Edycja zarobku" });
  await expect(editDialog).toBeVisible();
  await editDialog.getByPlaceholder("np. Wynagrodzenie, Faktura miesięczna").fill("E2E Salary edited");
  await editDialog.getByRole("button", { name: "Zapisz" }).click();

  await expect(main.getByText("E2E Salary edited")).toBeVisible();
  await expect(main.getByText("E2E Salary", { exact: true })).toBeHidden();

  await main.getByLabel("Usuń").first().click();
  await expect(main.getByText("Wpis usunięty lokalnie w fake sync.")).toBeVisible();
  await expect(main.getByText("E2E Salary edited")).toBeHidden();
});
