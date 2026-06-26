import { expect, test } from "@playwright/test";

test("renders an interactive product hero without submitting the beta waitlist", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Wszystkie Twoje inwestycje, czytane jak rocznik finansowy." })).toBeVisible();
  await expect(page.locator(".product-card")).toHaveCount(3);
  await expect(page.locator(".trust-item")).toHaveCount(4);
  await expect(page.getByRole("heading", { name: "Od historii transakcji do spokojnego obrazu majątku." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Arkusz jest dobry na start. Potem zaczyna ukrywać błędy." })).toBeVisible();
  await expect(page.locator(".process-step")).toHaveCount(3);
  await expect(page.locator(".sheet-card")).toHaveCount(5);

  const range = page.getByRole("radio", { name: "1R" });
  await range.click();
  await expect(range).toHaveAttribute("aria-checked", "true");

  const waitlistRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("airtable") || request.url().includes("waitlist")) {
      waitlistRequests.push(request.url());
    }
  });

  const betaSection = page.locator("#lista-beta");
  await expect(betaSection.getByRole("heading", { name: "Zapisy uruchomimy w kontrolowany sposób." })).toBeVisible();
  await expect(betaSection.getByRole("button", { name: "Wkrótce" })).toBeDisabled();
  await expect(betaSection.getByPlaceholder("ty@przyklad.pl")).toBeDisabled();
  await expect(betaSection.getByLabel("Chcę dostać jednorazową informację o starcie zapisów i rozumiem, że email trafi do listy beta.")).toBeDisabled();
  await expect(betaSection.getByText("Zapisy nie są jeszcze aktywne.")).toBeVisible();
  await expect(page.getByPlaceholder("Twój adres e-mail")).toBeDisabled();
  expect(waitlistRequests).toEqual([]);
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
