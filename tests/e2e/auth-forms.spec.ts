import { expect, test, type Page } from "@playwright/test";

// Walidacja ma zatrzymać formularz, zanim cokolwiek trafi do Supabase Auth.
function recordAuthRequests(page: Page) {
  const urls: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/auth/v1/")) urls.push(request.url());
  });
  return urls;
}

test("registration rejects mismatched passwords before contacting auth", async ({ page }) => {
  const authRequests = recordAuthRequests(page);
  await page.goto("/register");
  const register = page.locator("form");
  await register.getByPlaceholder("twój@email.com").fill("e2e@example.com");
  // Hasło spełnia wymagania (mała i wielka litera, cyfra) — inaczej formularz
  // odpadłby na nich, zanim dojdzie do porównania z potwierdzeniem.
  await register.getByPlaceholder("min. 8 znaków").fill("Password1");
  await register.getByPlaceholder("••••••••").fill("Different1");
  await register.getByRole("button", { name: /Utwórz konto/ }).click();
  await expect(register.getByText("Hasło i potwierdzenie różnią się.")).toBeVisible();
  expect(authRequests).toEqual([]);
});

test("registration explains the password requirements before contacting auth", async ({ page }) => {
  const authRequests = recordAuthRequests(page);
  await page.goto("/register");
  const register = page.locator("form");
  await register.getByPlaceholder("twój@email.com").fill("e2e@example.com");
  await register.getByPlaceholder("min. 8 znaków").fill("password");
  await register.getByPlaceholder("••••••••").fill("password");
  await register.getByRole("button", { name: /Utwórz konto/ }).click();
  await expect(register.getByText("Hasło musi zawierać małą literę, wielką literę i cyfrę.")).toBeVisible();
  expect(authRequests).toEqual([]);
});
