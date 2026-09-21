import { type Page } from "@playwright/test";

/** Potwierdza własne okno `ConfirmDialog` (src/components/feedback/confirm-dialog.tsx).
 *
 * Wcześniej usuwanie używało natywnego `window.confirm`, który testy łapały przez
 * `page.once("dialog", …)`. Teraz to zwykły element strony z przyciskiem „Usuń”. */
export async function confirmDialog(page: Page, confirmName = "Usuń") {
  const dialog = page
    .locator('[role="alertdialog"], [role="dialog"]')
    .filter({ has: page.getByRole("button", { name: confirmName, exact: true }) });
  await dialog.getByRole("button", { name: confirmName, exact: true }).click();
}
