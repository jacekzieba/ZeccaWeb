import { expect, test, type Page } from "@playwright/test";

const expandCategory = (page: Page, name: string) =>
  page.getByRole("main").getByRole("button", { name: new RegExp(`^${name}`) }).click();

test("portfolio detail customize toggles, resizes and persists per its own key", async ({ page }) => {
  await page.goto("/portfolios");
  // Navigate into the first portfolio detail.
  await page.getByRole("main").locator("a[href^='/portfolios/']").first().click();
  await expect(page).toHaveURL(/\/portfolios\/.+/);

  const main = page.getByRole("main");
  const grid = page.getByTestId("portfolio-detail-grid");
  await expect(grid).toBeVisible();

  await main.getByRole("button", { name: "Dostosuj" }).click();
  await expect(main.getByText("Układ sekcji")).toBeVisible();

  await expandCategory(page, "Dane");
  await main.getByRole("radiogroup", { name: "Szerokość sekcji Pozycje" }).getByRole("radio", { name: "2 kolumny" }).click();
  await expect.poll(async () =>
    page.evaluate(() => {
      const raw = window.localStorage.getItem("zecca.portfolio-detail.sections.v1");
      return raw ? JSON.parse(raw).sectionSizes?.holdings : null;
    }),
  ).toEqual({ width: 2 });

  // Toggle "Pozycje" (holdings) — always present, even in portfolios with no cash
  await main.getByRole("checkbox", { name: "Pokaż sekcję Pozycje" }).uncheck();
  await page.reload();
  await expect.poll(async () =>
    page.evaluate(() => {
      const raw = window.localStorage.getItem("zecca.portfolio-detail.sections.v1");
      return raw ? JSON.parse(raw).visibleSections : [];
    }),
  ).not.toContain("holdings");

  await main.getByRole("button", { name: "Dostosuj" }).click();
  await main.getByRole("button", { name: "Przywróć domyślne" }).click();
  await expect.poll(async () =>
    page.evaluate(() => {
      const raw = window.localStorage.getItem("zecca.portfolio-detail.sections.v1");
      return raw ? JSON.parse(raw).visibleSections : [];
    }),
  ).toContain("holdings");
});
