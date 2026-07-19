import { expect, test } from "@playwright/test";

// Fake-sync seeds real records, so onboarding never auto-starts here; the
// replay entry (?tour=1, same path as the FAQ/settings links) exercises the
// full flow: intro cards → 5 spotlight steps with cross-route navigation →
// finale card → transient state reset.
test("tour replay walks intro → all steps → finale and does not auto-reopen", async ({ page }) => {
  await page.goto("/dashboard?tour=1");

  // Intro card 1 → 2 → start tour.
  const next = page.getByTestId("onboarding-next");
  await expect(next).toBeVisible();
  await expect(page.getByRole("heading", { name: "Monitoruj swoje inwestycje" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Animowany podgląd wyniku i struktury portfela" })).toBeVisible();
  await next.click(); // card 2
  await expect(page.getByRole("heading", { name: "Dostęp do Twojego portfela masz tylko Ty" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Szyfrowane dane dostępne tylko na Twoich urządzeniach" })).toBeVisible();
  await next.click(); // "Zacznij tour po aplikacji"

  // 5 tour steps; each shows the expected copy next to a highlighted element.
  const tourNext = page.getByTestId("tour-next");
  const expectedTitles = [
    "Wartość Twojego portfela w czasie",
    "Instrumenty w Twoim portfelu",
    "Każdy portfel pod ręką",
    "Każda złotówka ma swoją historię",
    "Monitoruj także zarobki",
  ];
  for (let i = 1; i <= 5; i++) {
    await expect(page.getByText(`TOUR · KROK ${i} / 5`)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("dialog", { name: expectedTitles[i - 1] })).toBeVisible();
    if (i === 1) {
      const syncDot = await page.getByTestId("sync-status-dot").boundingBox();
      expect(syncDot?.width).toBe(syncDot?.height);
    }
    await tourNext.click();
  }

  // Cross-route navigation happened along the way.
  await expect(page).toHaveURL(/\/earnings/);

  // Finale card → finish.
  const finish = page.getByTestId("onboarding-finish");
  await expect(finish).toBeVisible();
  await expect(page.getByText("To już wszystko. Możesz rozpocząć korzystanie z aplikacji.", { exact: false })).toBeVisible();
  await finish.click();

  // Completed → plain dashboard, no onboarding on the next visit.
  await page.goto("/dashboard");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByTestId("onboarding-next")).toHaveCount(0);
  await expect(page.getByTestId("tour-next")).toHaveCount(0);
});

test("Esc skips the tour immediately", async ({ page }) => {
  await page.goto("/dashboard?tour=1");
  await page.getByTestId("onboarding-next").click();
  await page.getByTestId("onboarding-next").click();
  await expect(page.getByText("TOUR · KROK 1 / 5")).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("tour-next")).toHaveCount(0);
});

test("settings exposes Discord and e-mail support links", async ({ page }) => {
  await page.goto("/settings");

  await expect(page.getByRole("link", { name: "Dołącz →" })).toHaveAttribute(
    "href",
    "https://discord.gg/wrKjxVyFQ",
  );
  await expect(page.getByRole("link", { name: "Napisz →" })).toHaveAttribute(
    "href",
    "mailto:zecca.barista363@passmail.net",
  );
});

test("public demo stays on /demo and ends with login or registration", async ({ page }) => {
  test.slow();
  await page.goto("/demo");

  const introNext = page.getByTestId("onboarding-next");
  await expect(introNext).toBeVisible();
  await introNext.click();
  await introNext.click();

  const tourNext = page.getByTestId("tour-next");
  for (let step = 1; step <= 5; step++) {
    await expect(page.getByText(`TOUR · KROK ${step} / 5`)).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/demo$/);
    await tourNext.click();
  }

  await expect(page.getByText("Dane przykładowe nie zostaną zapisane.", { exact: false })).toBeVisible();
  await expect(page.getByTestId("onboarding-public-login")).toBeVisible();
  await page.getByTestId("onboarding-public-register").click();
  await expect(page).toHaveURL(/\/register$/);

  // Public demo is always available again, independently of the account flag.
  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Monitoruj swoje inwestycje" })).toBeVisible();
});
