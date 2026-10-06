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

      await expect(page.locator("header.hero h1")).toBeVisible();
      // js-reveal dokłada ten sam efekt, który podpina menu i zakładki —
      // kliknięcie przed nim trafiłoby w martwy HTML.
      await expect(page.locator(".zlanding")).toHaveClass(/js-reveal/);
      await expectNoDocumentOverflow(page);

      // Do 980px linki chowają się za przyciskiem menu.
      const visibleNavLinks = page.locator(".nav-links a.lnk:visible");
      const burger = page.getByRole("button", { name: "Otwórz menu" });
      if (viewport.width <= 980) {
        await expect(visibleNavLinks).toHaveCount(0);
        await burger.click();
        await expect(page.getByRole("button", { name: "Zamknij menu" })).toHaveAttribute("aria-expanded", "true");
        await expect(visibleNavLinks).toHaveCount(6);
        await expectNoDocumentOverflow(page);
        await page.keyboard.press("Escape");
        await expect(visibleNavLinks).toHaveCount(0);
      } else {
        await expect(burger).toBeHidden();
        await expect(visibleNavLinks).toHaveCount(6);
      }

      // Sekcje mają overflow: hidden, więc za szeroki blok nie rozpycha
      // dokumentu, tylko zostaje ucięty — sprawdzamy krawędzie wprost.
      for (const selector of [".hero-panel", ".register-visual", ".alloc-ring", ".platform-stage", ".faq-list"]) {
        const box = await page.locator(selector).boundingBox();
        expect(box, selector).not.toBeNull();
        expect(box!.x, selector).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width, selector).toBeLessThanOrEqual(viewport.width);
      }
      await expect(page.locator(".register-grid")).toHaveCSS(
        "grid-template-columns",
        viewport.width <= 980 ? /^[\d.]+px$/ : /^[\d.]+px [\d.]+px$/,
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
