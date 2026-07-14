import { expect, test } from "@playwright/test";

test("publishes locally edited landing copy to the regular page", async ({ page }) => {
  const publishedHeading = "Tekst opublikowany lokalnie";

  await page.goto("/?edit=1");
  const heading = page.getByRole("heading", { name: "Wszystkie Twoje inwestycje w jednym miejscu" });
  await expect(heading).toHaveAttribute("contenteditable", "true");
  await heading.fill(publishedHeading);
  await Promise.all([
    page.waitForURL(/\/$/),
    page.getByRole("button", { name: "Opublikuj" }).click(),
  ]);

  await expect(page.getByRole("heading", { name: publishedHeading })).toBeVisible();
});

test("makes FAQ questions and answers editable in copy-editing mode", async ({ page }) => {
  await page.goto("/?edit=1");

  await expect(page.locator('[data-landing-edit-id="faq.items.0.question"]')).toHaveAttribute("contenteditable", "true");
  await expect(page.locator('[data-landing-edit-id="faq.items.0.answer"]')).toHaveAttribute("contenteditable", "true");
});

test("renders an interactive product hero without submitting the beta waitlist", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Wszystkie Twoje inwestycje w jednym miejscu" })).toBeVisible();
  await expect(page.locator(".product-card")).toHaveCount(3);
  await expect(page.locator(".trust-item")).toHaveCount(4);
  await expect(page.getByRole("heading", { name: "Zecca prezentuje dane i wykresy dotyczące wszystkich Twoich inwestycji" })).toBeVisible();
  await expect(page.locator(".process-step")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "Ten sam portfel. Dokładnie tam, gdzie go potrzebujesz." })).toBeVisible();
  await expect(page.locator("[data-platform-panel]")).toHaveCount(3);
  const webTab = page.getByRole("tab", { name: "Web" });
  await webTab.click();
  await expect(webTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-platform-panel="web"]')).toBeVisible();
  const iosTab = page.getByRole("tab", { name: "iOS" });
  await iosTab.click();
  await expect(iosTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: /iOS/ }).getByRole("img")).toBeVisible();

  const range = page.getByRole("radio", { name: "1R" });
  await range.click();
  await expect(range).toHaveAttribute("aria-checked", "true");
  await expect(page.locator('.static-vvd-chart svg')).toHaveAttribute("data-chart-range", "1Y");

  const waitlistRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("airtable") || request.url().includes("waitlist")) {
      waitlistRequests.push(request.url());
    }
  });

  const betaSection = page.locator("#lista-beta");
  await expect(betaSection.getByRole("heading", { name: "Zapisy uruchomimy w kontrolowany sposób." })).toBeVisible();
  const waitlistForm = betaSection.locator("#betaWaitlistForm");
  const waitlistEnabled = await waitlistForm.getAttribute("data-enabled");
  const emailField = betaSection.getByPlaceholder("ty@przyklad.pl");
  const consentField = waitlistForm.getByRole("checkbox");
  if (waitlistEnabled === "true") {
    await expect(betaSection.getByRole("button", { name: "Dołącz do listy" })).toBeEnabled();
    await expect(emailField).toBeEnabled();
    await expect(consentField).toBeEnabled();
  } else {
    await expect(betaSection.getByRole("button", { name: "Wkrótce" })).toBeDisabled();
    await expect(emailField).toBeDisabled();
    await expect(consentField).toBeDisabled();
  }
  // The hero now leads with App Store / Mac App Store badges instead of an inline
  // waitlist field; they point at the beta section and submit nothing.
  await expect(page.locator(".landing-hero .store-badge")).toHaveCount(2);
  expect(waitlistRequests).toEqual([]);
});

test("uses the requested menu, smooth in-page links, and active Discord link", async ({ page }) => {
  await page.goto("/");

  const nav = page.locator(".nav-links");
  await expect(nav.getByRole("link")).toHaveText(["Beta: zapisy", "Funkcje", "Aplikacje", "Feedback"]);
  await expect(page.getByRole("link", { name: "Zaloguj się" })).toHaveCount(0);

  await nav.getByRole("link", { name: "Feedback" }).click();
  await expect(page).toHaveURL(/#kontakt$/);
  await expect(page.locator("#kontakt")).toBeInViewport();

  const footer = page.locator(".zlanding footer");
  await expect(footer.getByRole("link", { name: "Discord" })).toHaveAttribute("href", "https://discord.gg/wrKjxVyFQ");
  await expect(footer.getByRole("link", { name: "Polityka prywatności" })).toHaveAttribute("href", "/privacy-policy");
  await expect(footer.locator(".foot-link-unavailable")).toHaveCount(3);
  await expect(page.locator(".landing-hero .store-badge.is-unavailable")).toHaveCount(2);
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
