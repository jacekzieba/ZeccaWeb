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
  // Komunikat w regionie alert — czytnik ekranu ogłasza go bez szukania.
  await expect(register.getByRole("alert")).toHaveText("Hasło i potwierdzenie różnią się.");
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
  await expect(register.getByRole("alert")).toHaveText("Hasło musi zawierać małą literę, wielką literę i cyfrę.");
  expect(authRequests).toEqual([]);
});

// Błędy z Supabase Auth podstawione lokalnie — w CI adres Supabase jest zastępczy.
test("login announces rejected credentials", async ({ page }) => {
  await page.route("**/auth/v1/**", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" }),
    }),
  );
  await page.goto("/login");
  const login = page.locator("form");
  await login.getByPlaceholder("twój@email.com").fill("e2e@example.com");
  await login.getByPlaceholder("••••••••").fill("Password1");
  await login.getByRole("button", { name: "Zaloguj się" }).click();
  await expect(login.getByRole("alert")).toContainText("Nieprawidłowy e-mail lub hasło.");
});

test("forgot-password announces a failed request", async ({ page }) => {
  await page.route("**/auth/v1/**", (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({ code: 429, error_code: "over_email_send_rate_limit", msg: "Email rate limit exceeded" }),
    }),
  );
  await page.goto("/forgot-password");
  const form = page.locator("form");
  await form.getByPlaceholder("twój@email.com").fill("e2e@example.com");
  await form.getByRole("button", { name: "Wyślij link resetujący" }).click();
  await expect(form.getByRole("alert")).toHaveText("Zbyt wiele prób w krótkim czasie. Odczekaj chwilę i spróbuj ponownie.");
});
