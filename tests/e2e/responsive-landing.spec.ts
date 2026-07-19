import { expect, test } from "@playwright/test";
import {
  expectNoDocumentOverflow,
  RESPONSIVE_VIEWPORTS,
} from "./support/responsive";

test.describe("responsive landing page", () => {
  for (const viewport of RESPONSIVE_VIEWPORTS) {
    test(`works on ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize(viewport);
      await page.goto("/");

      await expect(page.locator(".landing-hero h1")).toBeVisible();
      await expectNoDocumentOverflow(page);

      const visibleNavLinks = page.locator(".nav-links a.lnk:visible");
      const expectedNavLinks = viewport.width <= 440 ? 1 : viewport.width <= 980 ? 3 : 7;
      await expect(visibleNavLinks).toHaveCount(expectedNavLinks);

      const comparison = page.locator(".compare-scroll");
      await expect(comparison).toBeVisible();
      await expect
        .poll(() =>
          comparison.evaluate((element) => element.scrollWidth <= element.clientWidth),
        )
        .toBe(true);
      await expect(page.locator(".compare-table tbody tr").first()).toHaveCSS(
        "display",
        viewport.width <= 840 ? "block" : "table-row",
      );

      const iosTab = page.getByRole("tab", { name: "iOS" });
      await iosTab.click();
      await expect(iosTab).toHaveAttribute("aria-selected", "true");
      const iosPanel = page.getByRole("tabpanel", { name: /iOS/ });
      await expect(iosPanel).toBeVisible();
      await expect(iosPanel.getByRole("img")).toBeVisible();

      const closedFaq = page.locator("details.faq").nth(1);
      await closedFaq.locator("summary").click();
      await expect(closedFaq).toHaveAttribute("open", "");
      await expectNoDocumentOverflow(page);
    });
  }
});
