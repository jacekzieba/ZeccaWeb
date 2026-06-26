import { expect, test } from "@playwright/test";

test("renders an interactive product hero without submitting the beta waitlist", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Wszystkie Twoje inwestycje, czytane jak rocznik finansowy." })).toBeVisible();
  await expect(page.locator(".product-card")).toHaveCount(3);
  await expect(page.locator(".trust-item")).toHaveCount(4);

  const range = page.getByRole("radio", { name: "1R" });
  await range.click();
  await expect(range).toHaveAttribute("aria-checked", "true");

  await expect(page.getByRole("button", { name: "Wkrótce" })).toBeDisabled();
  await expect(page.getByPlaceholder("Twój adres e-mail")).toBeDisabled();
});

test("stacks the product modules on mobile and disables card motion for reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.locator(".product-card")).toHaveCount(3);
  await expect(page.locator(".product-preview")).toHaveCSS("flex-direction", "column");
  await expect(page.locator(".product-card").first()).toHaveCSS("transform", "none");
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    )
    .toBe(true);
});
