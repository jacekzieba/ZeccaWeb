import { expect, test } from "@playwright/test";

test("registration rejects mismatched passwords before contacting auth", async ({ page }) => {
  await page.goto("/register");
  const register = page.locator("form");
  await register.getByPlaceholder("twój@email.com").fill("e2e@example.com");
  await register.getByPlaceholder("min. 8 znaków").fill("password");
  await register.getByPlaceholder("••••••••").fill("different");
  await register.getByRole("button", { name: /Utwórz konto/ }).click();
  await expect(register.getByText("Hasło i potwierdzenie różnią się.")).toBeVisible();
});
