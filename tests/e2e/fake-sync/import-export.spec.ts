import { expect, test } from "@playwright/test";

test("imports a valid CSV locally, then exports the resulting transaction list", async ({ page }) => {
  await page.goto("/import");

  const main = page.getByRole("main");
  await expect(main.getByText("Import / Eksport", { exact: true })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: "e2e-import.csv",
    mimeType: "text/csv",
    buffer: Buffer.from([
      "date,portfolio,transactionType,grossAmount,currency,fees,taxes,note",
      "2026-06-20,Portfel główny,cashDeposit,1234.56,PLN,0,0,E2E import",
      "2026-06-21,Portfel główny,cashDeposit,999,PLN,0,0,E2E pominięty",
    ].join("\n")),
  });

  await expect(main.getByText("Podgląd importu transakcji")).toBeVisible();
  await expect(main.getByText(/2 poprawnych/)).toBeVisible();
  await main.getByRole("checkbox", { name: /Importuj pozycję 2/ }).uncheck();
  await expect(main.getByText(/1 wybranych/)).toBeVisible();
  await expect(main.getByText("Pominięte")).toBeVisible();
  await expect(main.getByRole("button", { name: "Importuj wybrane" })).toBeVisible();

  await main.getByRole("button", { name: "Sprawdź import" }).click();
  await expect(main.getByText(/Symulacja: 1 wybranych pozycji gotowych do zapisu/)).toBeVisible();

  await main.getByRole("button", { name: "Importuj wybrane" }).click();
  await expect(main.getByText("Zaimportowano 1 rekordów.")).toBeVisible();

  await main.getByRole("button", { name: "Eksport", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await main.getByRole("button", { name: "Pobierz CSV" }).first().click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^investor-transakcje-\d{4}-\d{2}-\d{2}\.csv$/);
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  let csv = "";
  for await (const chunk of stream!) {
    csv += chunk.toString();
  }
  expect(csv).toContain("2026-06-20,Portfel główny,,cashDeposit,,,1234.56,PLN,0,0");
  expect(csv).not.toContain("2026-06-21,Portfel główny,,cashDeposit,,,999,PLN,0,0");
});
