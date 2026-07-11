import { expect, test } from "@playwright/test";

// Uploads the real certification fixtures through the import UI, exercising the
// full browser read path (read-excel-file + SheetJS fallback + parsers).
//
// Regression coverage for the two import bugs:
//   • PKO export is legacy BIFF8 .xls, which read-excel-file cannot read at all
//     → must go through SheetJS.
//   • XTB fixture .xlsx has empty <c t="inlineStr"/> cells → the generator now
//     writes them as blank, and SheetJS is the fallback if read-excel-file trips.
// Before the fixes the PKO upload showed "Nie udało się odczytać pliku."

const FIXTURES = "tests/e2e/fixtures/certification";

test("PKO Obligacje .xls (BIFF8) imports and previews the bonds", async ({ page }) => {
  await page.goto("/import");

  await page.getByRole("button", { name: /PKO Obligacje XLS/ }).click();
  await page.locator("select").selectOption({ label: "IKZE Obligacje" });
  await page.locator('input[type="file"]').setInputFiles(`${FIXTURES}/pko_cert_scenario.xls`);

  await expect(page.getByText(/Podgląd importu/)).toBeVisible();
  await expect(page.getByText("EDO0432").first()).toBeVisible();
  await expect(page.getByText("Gotowe").first()).toBeVisible();
  await expect(page.getByText("Nie udało się odczytać pliku")).toHaveCount(0);
});

test("XTB .xlsx imports and previews the trades", async ({ page }) => {
  await page.goto("/import");

  await page.getByRole("button", { name: /XTB XLSX/ }).click();
  await page.locator("select").selectOption({ label: "IKE ETF" });
  await page.locator('input[type="file"]').setInputFiles(`${FIXTURES}/xtb_cert_scenario.xlsx`);

  await expect(page.getByText(/Podgląd importu/)).toBeVisible();
  await expect(page.getByText("VWCE.DE").first()).toBeVisible();
  await expect(page.getByText("Gotowe").first()).toBeVisible();
  await expect(page.getByText("Nie udało się odczytać pliku")).toHaveCount(0);
});
