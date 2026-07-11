import { expect, test } from "@playwright/test";

// The certification scenario rendered through the real UI (fake-sync dataset).
//
// The live display path values with asOf=today and no injected CPI, so bond
// accrual (IKZE) and FX-dependent holdings (IKE) drift day to day — their exact
// amounts are locked in the Task 2 unit test, not here. The all-PLN taxable
// portfolio has no bonds and pinned prices, so it is stable on screen; that is
// the exact amount we assert end-to-end. Everything else is presence.

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
