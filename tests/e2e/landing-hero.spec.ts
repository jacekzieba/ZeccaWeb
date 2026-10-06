import { expect, test } from "@playwright/test";

test("publishes locally edited landing copy to the regular page", async ({ page }) => {
  const publishedHeading = "Tekst opublikowany lokalnie";

  await page.goto("/?edit=1");
  const heading = page.getByRole("heading", { level: 1 });
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

test("renders the hero headline, CTAs and an interactive demo chart", async ({ page }) => {
  await page.goto("/");

  const hero = page.locator("header.hero");
  await expect(hero.getByRole("heading", { level: 1, name: "Każda liczba ma źródło." })).toBeVisible();
  await expect(hero.getByRole("link", { name: "Załóż konto", exact: true })).toHaveAttribute("href", "/register");
  await expect(hero.getByRole("link", { name: "Zobacz demo", exact: true })).toHaveAttribute("href", "/demo");

  // Wykres w panelu hero reaguje na wybór zakresu.
  const heroPanel = page.getByRole("complementary", { name: "Wartość portfela demonstracyjnego" });
  const range = heroPanel.getByRole("radio", { name: "1R" });
  await range.click();
  await expect(range).toHaveAttribute("aria-checked", "true");
  await expect(heroPanel.locator(".static-vvd-chart svg")).toHaveAttribute("data-chart-range", "1Y");

  await expect(page.locator(".product-card")).toHaveCount(2);
  await expect(page.locator("#jak-dziala .steps-row")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "Ten sam portfel. Dokładnie tam, gdzie go potrzebujesz." })).toBeVisible();
  await expect(page.locator("[data-platform-panel]")).toHaveCount(3);
  // Zakładki podpina efekt LandingInteractions (ten sam, który dodaje js-reveal).
  await expect(page.locator(".zlanding")).toHaveClass(/js-reveal/);
  const macTab = page.getByRole("tab", { name: "macOS" });
  await macTab.click();
  await expect(macTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-platform-panel="macos"]')).toBeVisible();
  await expect(page.locator('[data-platform-panel="web"]')).toBeHidden();
  const iosTab = page.getByRole("tab", { name: "iOS" });
  await iosTab.click();
  await expect(iosTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: /iOS/ }).getByRole("img")).toBeVisible();
});

test("uses the requested menu, smooth in-page links, and active Discord link", async ({ page }) => {
  await page.goto("/");

  const nav = page.locator(".nav-links");
  await expect(nav.getByRole("link")).toHaveText([
    "Funkcje",
    "Aplikacje",
    "Kontakt",
    "Zobacz demo",
    "Zaloguj się",
    "Załóż konto",
  ]);
  await expect(nav.getByRole("link", { name: "Zobacz demo" })).toHaveAttribute("href", "/demo");
  await expect(nav.getByRole("link", { name: "Zaloguj się" })).toHaveAttribute("href", "/login");
  await expect(nav.getByRole("link", { name: "Załóż konto" })).toHaveAttribute("href", "/register");
  // Kontakt to adres z polityki prywatności — sekcji #kontakt na stronie nie ma.
  await expect(nav.getByRole("link", { name: "Kontakt" })).toHaveAttribute("href", "mailto:kontakt@jacekzieba.pl");

  await nav.getByRole("link", { name: "Funkcje" }).click();
  await expect(page).toHaveURL(/#funkcje$/);
  await expect(page.locator("#funkcje")).toBeInViewport();

  const footer = page.locator(".zlanding footer");
  await expect(footer.getByRole("link", { name: "Discord" })).toHaveAttribute("href", "https://discord.gg/Y7yJep36bq");
  await expect(footer.getByRole("link", { name: "Polityka prywatności" })).toHaveAttribute("href", "/privacy-policy");
  await expect(footer.getByRole("link", { name: "Kontakt" })).toHaveAttribute("href", "mailto:kontakt@jacekzieba.pl");
  // Sklepy jeszcze niedostępne: oznaczone, ale nie jako linki.
  await expect(footer.locator(".foot-link-unavailable")).toHaveCount(3);
  await expect(footer.getByRole("link", { name: /App Store|TestFlight/ })).toHaveCount(0);
});

test("stacks the product modules on mobile and disables card motion for reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.locator(".product-card")).toHaveCount(2);
  // Jedna kolumna: tekst rejestru nad kartami, nie obok nich.
  await expect(page.locator(".register-grid")).toHaveCSS("grid-template-columns", /^[\d.]+px$/);
  // Bez ruchu karta poza ekranem jest od razu widoczna — bez reduced motion
  // czekałaby ukryta (opacity 0, przesunięta) na wjazd przy przewinięciu.
  await expect(page.locator(".zlanding")).toHaveClass(/js-reveal/);
  const offscreenCard = page.locator(".feature-card").last();
  await expect(offscreenCard).not.toBeInViewport();
  await expect(offscreenCard).toHaveCSS("transform", "none");
  await expect(offscreenCard).toHaveCSS("opacity", "1");
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    )
    .toBe(true);
});
