import { expect, test } from "@playwright/test";
import {
  expectNoDocumentOverflow,
  RESPONSIVE_VIEWPORTS,
} from "../support/responsive";

const APP_ROUTES = [
  { path: "/dashboard", text: "Wartość portfela" },
  { path: "/portfolios", text: "Portfele" },
  { path: "/positions", text: "Pozycje" },
  { path: "/transactions", text: "Transakcje" },
  { path: "/instruments", text: "Instrumenty" },
  { path: "/earnings", text: "Zarobki" },
  { path: "/benchmark", text: "Porównanie portfolio" },
  { path: "/reports", text: "Raporty" },
  { path: "/import", text: "Import / Eksport" },
  { path: "/settings", text: "Ustawienia" },
] as const;

test.describe("responsive application", () => {
  for (const viewport of RESPONSIVE_VIEWPORTS) {
    test(`renders primary routes on ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.setViewportSize(viewport);

      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));

      for (const route of APP_ROUTES) {
        await test.step(route.path, async () => {
          await page.goto(route.path);

          const main = page.getByRole("main");
          await expect(main).toBeVisible();
          await expect(main.getByText(route.text, { exact: true }).first()).toBeVisible();
          await expectNoDocumentOverflow(page);
        });
      }

      await expect(pageErrors).toEqual([]);
    });

    test(`keeps navigation usable on ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/dashboard");

      const menuButton = page.getByRole("button", { name: "Menu" });
      if (viewport.width < 1024) {
        await expect(menuButton).toBeVisible();
        await expect(menuButton).toHaveCSS("width", "44px");
        await expect(page.getByRole("button", { name: "Szukaj" })).toHaveCSS("width", "44px");
        await expect(page.getByRole("link", { name: "Profil" })).toHaveCSS("width", "44px");
        await menuButton.click();
      } else {
        await expect(menuButton).toBeHidden();
      }

      await page.locator("aside").getByRole("link", { name: "Transakcje", exact: true }).click();
      await expect(page).toHaveURL(/\/transactions$/);
      await expect(page.getByRole("main").getByText("Transakcje", { exact: true }).first()).toBeVisible();
      await expectNoDocumentOverflow(page);
    });
  }
});

test("keeps transaction rows usable on a phone", async ({ page }) => {
  await page.setViewportSize(RESPONSIVE_VIEWPORTS[0]);
  await page.goto("/transactions");

  const main = page.getByRole("main");
  const row = main.locator(".transactions-table-row").first();
  await expect(row).toBeVisible();
  await expect(main.locator(".transactions-table-header")).toBeHidden();
  await expect(row.getByRole("button", { name: "Edytuj" })).toBeVisible();
  await expect(row.getByRole("button", { name: "Usuń" })).toBeVisible();
  await expectNoDocumentOverflow(page);
});
