import { expect, test } from "@playwright/test";

test("dashboard customize stores section visibility and preserves it after reload", async ({ page }) => {
  await page.goto("/dashboard");

  const main = page.getByRole("main");
  await expect(main.getByText(/pozycji w portfelu/)).toBeVisible();

  await main.getByRole("button", { name: "Dostosuj" }).click();
  await expect(main.getByText("Układ sekcji")).toBeVisible();

  await main.getByRole("button", { name: "Przesuń Instrumenty wyżej" }).click();
  await main.getByRole("radiogroup", { name: "Rozmiar sekcji Instrumenty" }).getByRole("radio", { name: "4×3" }).click();
  await expect.poll(async () => {
    return page.evaluate(() => {
      const raw = window.localStorage.getItem("zecca.dashboard.sections.v1");
      const config = raw ? JSON.parse(raw) : {};
      return {
        firstTwo: config.sectionOrder?.slice(0, 2),
        holdingsSize: config.sectionSizes?.holdings,
      };
    });
  }).toMatchObject({
    firstTwo: ["holdings", "summary"],
    holdingsSize: { width: 4, height: 3 },
  });

  await main.getByRole("checkbox", { name: "Pokaż sekcję Instrumenty" }).uncheck();

  await expect(main.getByText(/pozycji w portfelu/)).toHaveCount(0);
  await expect.poll(async () => {
    return page.evaluate(() => {
      const raw = window.localStorage.getItem("zecca.dashboard.sections.v1");
      return raw ? JSON.parse(raw).visibleSections : [];
    });
  }).not.toContain("holdings");

  await page.reload();
  await expect(main.getByText(/pozycji w portfelu/)).toHaveCount(0);

  await main.getByRole("button", { name: "Dostosuj" }).click();
  await main.getByRole("button", { name: "Przywróć domyślne" }).click();
  await expect(main.getByText(/pozycji w portfelu/)).toBeVisible();
});
