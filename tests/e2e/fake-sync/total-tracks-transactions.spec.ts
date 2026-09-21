import { expect, test, type Locator, type Page } from "@playwright/test";
import { chooseOption } from "../support/select";
import { confirmDialog } from "../support/confirm";

// Liczba na ekranie musi wynikać z transakcji: wpłata podnosi wartość portfela dokładnie
// o swoją kwotę, edycja zmienia ją o różnicę, a usunięcie przywraca stan wyjściowy.
// Testy jednostkowe sprawdzają silnik; ten sprawdza, że UI pokazuje to, co silnik liczy
// (łączna wartość w panelu bocznym, zaokrąglona do pełnych złotych).

async function totalValue(page: Page): Promise<number> {
  const text = await page
    .locator("aside")
    .filter({ hasText: /Łączna wartość/i })
    .first()
    .innerText();
  const match = /([\d\s\u00a0\u202f]+)(?:,\d+)?\s*zł/.exec(text.replace(/\n/g, " "));
  if (!match) throw new Error(`Nie znaleziono łącznej wartości w: ${text}`);
  return Number(match[1].replace(/[\s\u00a0\u202f]/g, ""));
}

const modalOf = (page: Page) => page.locator(".transaction-modal-panel");

async function addCashTransaction(page: Page, kind: "Wpłata gotówki" | "Wypłata gotówki", amount: string) {
  await page.getByRole("main").getByRole("button", { name: "Dodaj transakcję" }).click();
  const modal = modalOf(page);
  await expect(modal).toBeVisible();
  await modal.getByRole("button", { name: kind, exact: true }).click();
  await chooseOption(modal.getByRole("combobox", { name: "Portfel" }), "Portfel główny");
  await modal.getByRole("textbox", { name: "Kwota (brutto)" }).fill(amount);
  await modal.getByRole("button", { name: /^Dodaj/ }).click();
  await expect(modal).toBeHidden();
}

/** Wiersz tabeli transakcji z daną kwotą (format pl-PL: spacja tysięcy, przecinek dziesiętny). */
const rowWithAmount = (page: Page, amount: RegExp): Locator =>
  page.getByRole("main").getByRole("row").filter({ hasText: amount }).first();

test("łączna wartość rośnie o wpłatę, zmienia się o edycję i wraca po usunięciu", async ({ page }) => {
  await page.goto("/transactions");
  await expect(page.getByRole("main").getByText("Transakcje", { exact: true }).first()).toBeVisible();
  const baseline = await totalValue(page);

  await addCashTransaction(page, "Wpłata gotówki", "2500");
  await expect.poll(() => totalValue(page)).toBeCloseTo(baseline + 2500, -1);

  await rowWithAmount(page, /\+2[\s\u00a0\u202f]?500,00/).getByRole("button", { name: /^Edytuj/ }).click();
  const modal = modalOf(page);
  await modal.getByRole("textbox", { name: "Kwota (brutto)" }).fill("2750");
  await modal.getByRole("button", { name: /^(Zapisz|Dodaj|Aktualizuj)/ }).click();
  await expect(modal).toBeHidden();
  await expect.poll(() => totalValue(page)).toBeCloseTo(baseline + 2750, -1);

  await rowWithAmount(page, /\+2[\s\u00a0\u202f]?750,00/).getByRole("button", { name: /^Usuń/ }).click();
  await confirmDialog(page);
  await expect.poll(() => totalValue(page)).toBeCloseTo(baseline, -1);
});

test("wypłata obniża łączną wartość o swoją kwotę", async ({ page }) => {
  await page.goto("/transactions");
  const baseline = await totalValue(page);

  await addCashTransaction(page, "Wypłata gotówki", "300");
  await expect.poll(() => totalValue(page)).toBeCloseTo(baseline - 300, -1);

  await rowWithAmount(page, /[−-]300,00/).getByRole("button", { name: /^Usuń/ }).click();
  await confirmDialog(page);
  await expect.poll(() => totalValue(page)).toBeCloseTo(baseline, -1);
});
