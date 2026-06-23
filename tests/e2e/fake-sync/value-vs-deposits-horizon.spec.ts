// tests/e2e/fake-sync/value-vs-deposits-horizon.spec.ts
import { expect, test } from "@playwright/test";

test("value-vs-deposits chart exposes a horizon selector defaulting to MAX", async ({ page }) => {
  await page.goto("/dashboard");
  const main = page.getByRole("main");
  await expect(main.getByText(/pozycji w portfelu/)).toBeVisible();

  // The value-vs-deposits section carries its own period radiogroup.
  const section = page.getByTestId("dashboard-section-valueVsDeposits");
  const horizon = section.getByRole("radiogroup", { name: "Zakres wykresu wartość vs wpłaty" });
  await expect(horizon).toBeVisible();
  await expect(horizon.getByRole("radio", { name: "MAX" })).toHaveAttribute("aria-checked", "true");

  await horizon.getByRole("radio", { name: "3M" }).click();
  await expect(horizon.getByRole("radio", { name: "3M" })).toHaveAttribute("aria-checked", "true");
  await expect(horizon.getByRole("radio", { name: "MAX" })).toHaveAttribute("aria-checked", "false");
});
