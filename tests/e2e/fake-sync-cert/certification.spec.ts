import { expect, test } from "@playwright/test";
import {
  ASOF,
  IKE_ID,
  IKZE_ID,
} from "../../../src/sync/dev/certification-scenario";

// The certification scenario rendered through the real UI with frozen time,
// FX and CPI inputs supplied by the fake-sync certification dataset.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(ASOF);
});

test("portfolios page shows the three scenario portfolios and the stable taxable total", async ({
  page,
}) => {
  await page.goto("/portfolios");
  const main = page.locator("main");

  await expect(main.getByText("IKE ETF", { exact: true })).toBeVisible();
  await expect(main.getByText("IKZE Obligacje", { exact: true })).toBeVisible();
  await expect(main.getByText("Portfel zwykły", { exact: true })).toBeVisible();

  // Taxable total 62 945,30 renders rounded to whole zł (maximumFractionDigits: 0),
  // with pl-PL non-breaking thousands separator. Deterministic regardless of asOf.
  await expect(main.getByText(/62[\s  ]945/)).toBeVisible();
});

test("positions page lists every scenario instrument", async ({ page }) => {
  await page.goto("/positions");
  const main = page.locator("main");

  // TOS0626 is intentionally absent — fully redeemed on maturity (position 0).
  for (const symbol of ["VWCE.DE", "CSPX.UK", "IEML.UK", "EDO0432", "CDR", "PKN", "ALE"]) {
    await expect(main.getByText(symbol, { exact: true }).first()).toBeVisible();
  }
  await expect(main.getByText("TOS0626", { exact: true })).toHaveCount(0);
});

test("converts EUR, USD and GBP holdings and the display currency", async ({ page }) => {
  await page.goto(`/portfolios/${IKE_ID}`);

  const value = page.getByTestId("portfolio-detail-section-kpiValue");
  const holdings = page.getByTestId("portfolio-detail-section-holdings");

  await expect(value).toContainText(/108[\s\u00a0\u202f]037 PLN/);
  await expect(holdings).toContainText(/VWCE\.DE[\s\S]*30[\s\u00a0\u202f]360/);
  await expect(holdings).toContainText(/CSPX\.UK[\s\S]*43[\s\u00a0\u202f]680/);
  await expect(holdings).toContainText(/IEML\.UK[\s\S]*5[\s\u00a0\u202f]?830/);

  await page.goto("/settings");
  await page.getByRole("radio", { name: "EUR", exact: true }).click();
  await page.goto(`/portfolios/${IKE_ID}`);

  await expect(page.getByTestId("portfolio-detail-section-kpiValue")).toContainText(
    /23[\s\u00a0\u202f]486 EUR/,
  );
});

test("values an inflation-indexed EDO bond through the UI", async ({ page }) => {
  await page.goto(`/portfolios/${IKZE_ID}`);

  const holdings = page.getByTestId("portfolio-detail-section-holdings");
  await holdings.getByRole("button", { name: /EDO/ }).click();

  await expect(page.getByTestId("portfolio-detail-section-kpiValue")).toContainText(
    /8[\s\u00a0\u202f]?706 PLN/,
  );
  await expect(holdings).toContainText(/EDO0432[\s\S]*113,96[\s\S]*4[\s\u00a0\u202f]?558/);
  await expect(holdings).toContainText("Obligacja skarbowa");
  await expect(holdings).not.toContainText("TOS0626");
});

test("keeps the full representative portfolio total stable", async ({ page }) => {
  await page.goto("/dashboard");

  const summary = page.getByTestId("dashboard-section-summary");
  const portfolios = page.getByTestId("dashboard-section-portfolios");

  await expect(summary).toContainText(/179[\s\u00a0\u202f]689[\s\S]*PLN/);
  await expect(portfolios).toContainText(/IKE ETF[\s\S]*108[\s\u00a0\u202f]037/);
  await expect(portfolios).toContainText(/IKZE Obligacje[\s\S]*8[\s\u00a0\u202f]?706/);
  await expect(portfolios).toContainText(/Portfel zwykły[\s\S]*62[\s\u00a0\u202f]945/);
});
