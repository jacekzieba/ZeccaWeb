import { expect, test, type Page } from "@playwright/test";
import * as XLSX from "xlsx";

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
  ["Type", "Instrument", "Ticker", "Time", "Amount", "ID", "Comment"],
  ["Deposit", "", "", 45569, 1000, "guardrail-deposit", "Anonymous CI fixture"],
  ["Free funds interest", "", "", 45569, -10, "guardrail-interest", "Anonymous CI fixture"],
]), "Cash Operations");
const file = { name: "import-review.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) };

async function exportTransactions(page: Page) {
  await page.getByRole("button", { name: "Eksport", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Pobierz CSV", exact: true }).first().click();
  const download = await downloaded;
  const stream = await download.createReadStream();
  let csv = "";
  for await (const chunk of stream!) csv += chunk.toString();
  const sheet = XLSX.read(csv, { type: "string", raw: true });
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet.Sheets[sheet.SheetNames[0]]);
  return rows.filter(row => row.external_import_id?.startsWith("xtb:guardrail-"));
}

for (const action of ["edit", "exclude"] as const) {
  test(`XTB invalid source → ${action} → saved values → reupload without duplicates`, async ({ page }) => {
    await page.goto("/import");
    await page.getByRole("button", { name: /^XTB / }).click();
    await page.locator('input[type="file"]').setInputFiles(file);
    await expect(page.getByText("Import wymaga sprawdzenia: 1 pozycji")).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("button", { name: "Importuj wybrane" })).toBeDisabled();
    if (action === "edit") {
      await page.getByRole("button", { name: "Edytuj pozycję z wiersza 3" }).click();
      await page.getByRole("textbox", { name: "Kwota na rachunku (PLN)" }).fill("10");
      await page.getByRole("button", { name: "Zapisz zmiany" }).click();
    } else {
      await page.getByRole("button", { name: "Usuń z importu pozycję z wiersza 3" }).click();
      await page.getByRole("button", { name: "Usuń 1 powiązanych pozycji" }).click();
    }
    await expect(page.getByText("Pozycje źródłowe zostały sprawdzone")).toBeVisible();
    await page.getByRole("button", { name: "Importuj wybrane" }).click();
    await expect(page.getByText(new RegExp(`Zaimportowano ${action === "edit" ? 2 : 1} rekordów`))).toBeVisible();
    const saved = await exportTransactions(page);
    expect(saved).toHaveLength(action === "edit" ? 2 : 1);
    expect(saved.find(row => row.external_import_id === "xtb:guardrail-deposit")?.gross_amount).toBe("1000");
    if (action === "edit") expect(saved.find(row => row.external_import_id === "xtb:guardrail-interest")?.gross_amount).toBe("10");
    else expect(saved.some(row => row.type === "interest")).toBe(false);

    await page.getByRole("button", { name: "Import", exact: true }).click();
    await page.locator('input[type="file"]').setInputFiles(file);
    if (action === "exclude") {
      // Exclusions belong to the draft. A fresh upload requires that decision again.
      await expect(page.getByText("Import wymaga sprawdzenia: 1 pozycji")).toBeVisible({ timeout: 30000 });
      await page.getByRole("button", { name: "Usuń z importu pozycję z wiersza 3" }).click();
      await page.getByRole("button", { name: "Usuń 1 powiązanych pozycji" }).click();
    }
    await expect(page.getByText("Pozycje źródłowe zostały sprawdzone")).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("button", { name: "Importuj wybrane" })).toBeDisabled();
    expect(await exportTransactions(page)).toEqual(saved);
  });
}
