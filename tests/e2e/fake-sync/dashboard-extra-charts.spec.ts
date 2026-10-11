import { expect, test } from "@playwright/test";

const EXTRA = [
  { id: "chartPnLOverTime", label: "Wynik w czasie", chart: "Wartość portfela minus wpłaty w czasie" },
  { id: "chartDrawdown", label: "Obsunięcie", chart: "Obsunięcie portfela od szczytu w procentach" },
  { id: "chartBenchmarkVsInflation", label: "Portfel vs inflacja", chart: "Zwrot portfela na tle inflacji, start = 100" },
] as const;

test("extra chart sections are hidden by default and can be turned on", async ({ page }) => {
  await page.goto("/dashboard");
  const main = page.getByRole("main");
  await expect(main.getByText(/pozycji w portfelu/)).toBeVisible();

  for (const { id } of EXTRA) {
    await expect(page.getByTestId(`dashboard-section-${id}`)).toHaveCount(0);
  }

  await main.getByRole("button", { name: "Dostosuj" }).click();
  await main.getByRole("button", { name: /^Wykresy/ }).click();

  for (const { id, label, chart } of EXTRA) {
    await main.getByRole("checkbox", { name: `Pokaż sekcję ${label}` }).check();
    const card = page.getByTestId(`dashboard-section-${id}`);
    await expect(card).toBeVisible();
    await expect(card.getByRole("img", { name: chart })).toBeVisible();
  }

  for (const label of ["Dywidendy", "Odsetki", "Podział walut", "Zwroty roczne", "Docelowa vs aktualna"]) {
    await main.getByRole("checkbox", { name: `Pokaż sekcję ${label}` }).check();
  }
  await expect(page.getByTestId("dashboard-section-chartDividends")).toBeVisible();
  await expect(page.getByTestId("dashboard-section-chartInterest")).toBeVisible();
  await expect(page.getByTestId("dashboard-section-chartCurrencyBreakdown")).toBeVisible();
  await expect(page.getByTestId("dashboard-section-chartAnnualReturns")).toBeVisible();
  await expect(page.getByTestId("dashboard-section-allocationTargetVsActual")).toBeVisible();
});
