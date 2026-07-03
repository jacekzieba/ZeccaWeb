import { expect, test } from "@playwright/test";

// Fake-sync seeds real records, so onboarding never auto-starts here; the
// replay entry (?tour=1, same path as the FAQ/settings links) exercises the
// full flow: intro cards → 5 spotlight steps with cross-route navigation →
// finale card → completed flag.
test("tour replay walks intro → all steps → finale and does not auto-reopen", async ({ page }) => {
  await page.goto("/dashboard?tour=1");

  // Intro card 1 → 2 → start tour.
  const next = page.getByTestId("onboarding-next");
  await expect(next).toBeVisible();
  await next.click(); // card 2
  await next.click(); // "Zacznij tour po aplikacji"

  // 5 tour steps; each shows the step counter next to a highlighted element.
  const tourNext = page.getByTestId("tour-next");
  for (let i = 1; i <= 5; i++) {
    await expect(page.getByText(`TOUR · KROK ${i} / 5`)).toBeVisible({ timeout: 10_000 });
    await tourNext.click();
  }

  // Cross-route navigation happened along the way.
  await expect(page).toHaveURL(/\/earnings/);

  // Finale card → finish.
  const finish = page.getByTestId("onboarding-finish");
  await expect(finish).toBeVisible();
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
