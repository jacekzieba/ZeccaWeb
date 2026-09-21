import { expect, test } from "@playwright/test";
import { chooseOption } from "../support/select";

// Sprzedaż ponad stan to ostrzeżenie, nie blokada: użytkownik widzi, że silnik odetnie
// nadwyżkę, ale może zapisać (na webie decyduje sam; natywnie taki zapis jest odrzucany).
test("sprzedaż ponad stan pokazuje ostrzeżenie w modalu, a przycisk zapisu zostaje aktywny", async ({ page }) => {
  await page.goto("/transactions");
  await page.getByRole("main").getByRole("button", { name: "Dodaj transakcję" }).click();
  const modal = page.locator(".transaction-modal-panel");
  await modal.getByRole("button", { name: "Sprzedaż", exact: true }).click();
  await chooseOption(modal.getByRole("combobox", { name: "Portfel" }), "Portfel główny");
  await chooseOption(modal.getByRole("combobox", { name: "Instrument" }), /AAPL/);

  const quantity = modal.getByRole("textbox", { name: "Liczba" });
  await quantity.fill("1");
  await expect(modal.getByTestId("oversell-warning")).toHaveCount(0);

  await quantity.fill("999999");
  const warning = modal.getByTestId("oversell-warning");
  await expect(warning).toBeVisible();
  await expect(warning).toContainText("nadwyżka zostanie pominięta");
  await expect(modal.getByRole("button", { name: /^Dodaj/ })).toBeEnabled();
});
