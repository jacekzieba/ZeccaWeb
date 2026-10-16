import { expect, test, type Locator, type Page } from "@playwright/test";

// Warstwy modalne spoza edytorów (szuflada menu, paleta ⌘K, arkusz transakcji
// pozycji) mają działać z klawiatury jak każde okno: Tab nie wychodzi pod spód,
// Escape zamyka, a fokus wraca tam, skąd okno otwarto.

const BASE_URL = "http://127.0.0.1:3100";

test.beforeEach(async ({ page }) => {
  await page.context().addCookies([{ name: "zecca-demo", value: "1", url: BASE_URL }]);
});

async function expectTabStaysInside(page: Page, dialog: Locator, presses = 25) {
  for (let i = 0; i < presses; i += 1) {
    await page.keyboard.press(i % 2 === 0 ? "Tab" : "Shift+Tab");
    if (i % 3 === 0) await page.keyboard.press("Tab");
    expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  }
}

test("szuflada menu na telefonie: nazwany dialog, Tab w środku, Escape i powrót fokusu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  const trigger = page.getByRole("button", { name: "Menu", exact: true });
  await trigger.click();

  const drawer = page.getByRole("dialog", { name: "Menu" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Zamknij menu" })).toBeVisible();
  await expectTabStaysInside(page, drawer, 60);

  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("paleta ⌘K: Tab w środku, Escape i powrót fokusu", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByTestId("dashboard-grid")).toBeVisible({ timeout: 20_000 });
  const opener = page.getByRole("link", { name: "Pozycje", exact: true });
  await opener.focus();
  await page.keyboard.press("ControlOrMeta+k");

  const palette = page.getByRole("dialog", { name: "Szukaj w Zecce" });
  await expect(palette.getByRole("combobox")).toBeFocused();
  await expectTabStaysInside(page, palette);

  await page.keyboard.press("Escape");
  await expect(palette).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("arkusz transakcji pozycji: Escape zamyka, fokus wraca na wiersz", async ({ page }) => {
  await page.goto("/positions");
  const row = page.getByRole("row", { name: /Pokaż transakcje instrumentu/ }).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.focus();
  await page.keyboard.press("Enter");

  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("button", { name: "Zamknij historię transakcji" })).toBeFocused();
  await expectTabStaysInside(page, sheet);

  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(row).toBeFocused();
});
