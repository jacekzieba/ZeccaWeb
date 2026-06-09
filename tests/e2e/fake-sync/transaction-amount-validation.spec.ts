import { expect, test } from "@playwright/test";

// Faza 1.4 parity: the add-transaction modal must refuse to save amounts above
// the 1e12 magnitude cap instead of letting garbage through to the sync payload.
//
// Note: the truly non-finite case ("1e999" → Infinity) is already guarded one
// layer earlier — the <input type="number"> sanitization clears it, so it can
// never reach the handler. That branch is covered by the parse-amount unit
// tests; here we exercise the cap on a *finite* over-range value that the input
// does accept, which only `parseAmount` rejects.
test("add-transaction blocks amounts over the 1e12 cap", async ({ page }) => {
  await page.goto("/transactions");

  await page.getByRole("main").getByRole("button", { name: "Dodaj transakcję" }).click();

  const cancel = page.getByRole("button", { name: "Anuluj" });
  await expect(cancel).toBeVisible();

  const amount = page.locator('label:has-text("Kwota (brutto)") + input');
  const submit = page.locator(".transaction-modal-submit");
  const amountError = page.getByText("Podaj poprawną kwotę.");

  // 9e99 — finite but far above the 1e12 cap → rejected, modal stays open.
  await amount.fill("9e99");
  await submit.click();
  await expect(amountError).toBeVisible();
  await expect(cancel).toBeVisible();

  // 1e13 — just over the cap → same block.
  await amount.fill("1e13");
  await submit.click();
  await expect(amountError).toBeVisible();

  // A finite, in-range amount clears the validation error.
  await amount.fill("1500");
  await submit.click();
  await expect(amountError).toBeHidden();
});
