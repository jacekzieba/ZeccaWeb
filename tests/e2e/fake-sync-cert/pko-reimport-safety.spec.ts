import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import * as XLSX from "xlsx";
import { chooseOption } from "../support/select";

test("reupload repairs legacy parameters without adding transactions again", async ({ page }) => {
  let firstPeriodRate = 1.75;
  let parserVersion = 1;
  await page.route("**/api/market-data/bond-params**", route => route.fulfill({
    json: { data: {
      series: "ROD", fullCode: "ROD0135", issueDate: "2023-01-01T00:00:00.000Z",
      maturityDate: "2035-01-01T00:00:00.000Z", nominalValue: 100, firstPeriodRate,
      subsequentBase: "inflacja", marginOverBase: 1.75, capitalization: "roczna",
      interestPayment: "przy wykupie", earlyRedemptionFee: 2, parserVersion,
      sourceURL: "https://www.obligacjeskarbowe.pl/oferta-obligacji/obligacje-12-letnie-rod/rod0135/",
    } },
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["DATA DYSPOZYCJI", "RODZAJ DYSPOZYCJI", "KOD OBLIGACJI", "NR ZAPISU", "SERIA", "LICZBA OBLIGACJI", "KWOTA OPERACJI", "STATUS"],
    ["2023-01-19", "dyspozycja zakupu", "ROD0135", 731001, 19, 5, 500, "zrealizowana"],
    ["2023-01-19", "zakup papierów", "ROD0135", 731001, 19, 5, 500, "zrealizowana"],
  ]), "Historia");
  const file = { name: "pko-reimport.xls", mimeType: "application/vnd.ms-excel", buffer: XLSX.write(workbook, { type: "buffer", bookType: "biff8" }) };

  await page.goto("/import");
  const main = page.getByRole("main");
  await main.getByRole("button", { name: /PKO Obligacje XLS/ }).click();
  await chooseOption(main.getByRole("combobox").first(), "IKZE Obligacje");
  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(main.getByRole("button", { name: "Importuj wybrane" })).toBeEnabled({ timeout: 30000 });
  await main.getByRole("button", { name: "Importuj wybrane" }).click();
  await expect(main.getByText("Zaimportowano 2 rekordów.")).toBeVisible();
  const before = await exportedTransactions(page);

  firstPeriodRate = 7.5;
  parserVersion = 2;
  await main.getByRole("button", { name: "Import", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(main.getByText(/ROD0135: oprocentowanie/)).toContainText("1.75 → 7.5%", { timeout: 30000 });
  await expect(main.getByRole("button", { name: "Importuj wybrane" })).toBeEnabled();
  await main.getByRole("button", { name: "Importuj wybrane" }).click();
  await expect(main.getByText("Zaktualizowano 1 emisji. Zaimportowano 0 rekordów.")).toBeVisible();
  expect(await exportedTransactions(page)).toBe(before);

  await main.getByRole("button", { name: "Import", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(main.getByText("Podgląd importu transakcji")).toBeVisible({ timeout: 30000 });
  await expect(main.getByRole("button", { name: "Importuj wybrane" })).toBeDisabled();
  await expect(main.getByText("Aktualizacja parametrów istniejących emisji po zatwierdzeniu")).toHaveCount(0);
  expect(await exportedTransactions(page)).toBe(before);
});

async function exportedTransactions(page: Page) {
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Eksport", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await main.getByRole("button", { name: "Pobierz CSV", exact: true }).first().click();
  const download = await downloaded;
  return readFileSync((await download.path())!, "utf8");
}
