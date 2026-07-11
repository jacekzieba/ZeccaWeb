import { expect, test, type APIRequestContext } from "@playwright/test";

const MAILPIT_URL = "http://127.0.0.1:54324";

type MailpitMessage = {
  ID: string;
  To?: Array<{ Address?: string }>;
};

async function waitForEmailLink(
  request: APIRequestContext,
  recipient: string,
  marker: string,
) {
  await expect
    .poll(async () => {
      const response = await request.get(`${MAILPIT_URL}/api/v1/messages?limit=100`);
      const body = await response.json() as { messages?: MailpitMessage[] };
      const message = body.messages?.find((candidate) =>
        candidate.To?.some((address) => address.Address?.toLowerCase() === recipient.toLowerCase()),
      );
      if (!message) return null;

      const detailResponse = await request.get(`${MAILPIT_URL}/api/v1/message/${message.ID}`);
      const detail = await detailResponse.json() as { HTML?: string; Text?: string };
      const content = `${detail.HTML ?? ""}\n${detail.Text ?? ""}`;
      const link = content.match(/https?:\/\/[^\s"'<]+/g)?.find((url) => url.includes(marker));
      return link ?? null;
    }, { timeout: 15_000 })
    .not.toBeNull();

  const response = await request.get(`${MAILPIT_URL}/api/v1/messages?limit=100`);
  const body = await response.json() as { messages?: MailpitMessage[] };
  const message = body.messages?.find((candidate) =>
    candidate.To?.some((address) => address.Address?.toLowerCase() === recipient.toLowerCase()),
  );
  const detailResponse = await request.get(`${MAILPIT_URL}/api/v1/message/${message!.ID}`);
  const detail = await detailResponse.json() as { HTML?: string; Text?: string };
  const content = `${detail.HTML ?? ""}\n${detail.Text ?? ""}`;
  return content
    .match(/https?:\/\/[^\s"'<]+/g)!
    .find((url) => url.includes(marker))!
    .replaceAll("&amp;", "&");
}

test("signup confirmation, password login and recovery work through local Supabase", async ({ page, request }) => {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = `e2e-auth-${nonce}@example.test`;
  const initialPassword = "Zecca-Initial-123";
  const newPassword = "Zecca-Recovered-456";

  await page.goto("/register");
  const register = page.locator("form");
  await register.getByPlaceholder("twój@email.com").fill(email);
  await register.getByPlaceholder("min. 8 znaków").fill(initialPassword);
  await register.getByPlaceholder("••••••••").fill(initialPassword);
  await register.getByRole("button", { name: /Utwórz konto/ }).click();
  await expect(page.getByText("Sprawdź swoją skrzynkę")).toBeVisible();

  const confirmationLink = await waitForEmailLink(request, email, "/auth/v1/verify");
  await page.goto(confirmationLink).catch(() => null);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.context().clearCookies();
  await page.goto("/login");
  const login = page.locator("form");
  await login.getByPlaceholder("twój@email.com").fill(email);
  await login.getByPlaceholder("••••••••").fill(initialPassword);
  await login.getByRole("button", { name: "Zaloguj się" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.context().clearCookies();
  await page.goto("/forgot-password");
  const forgot = page.locator("form");
  await forgot.getByPlaceholder("twój@email.com").fill(email);
  await forgot.getByRole("button", { name: "Wyślij link resetujący" }).click();
  await expect(page.getByText("Sprawdź swoją skrzynkę")).toBeVisible();

  const recoveryLink = await waitForEmailLink(request, email, "type=recovery");
  await page.goto(recoveryLink).catch(() => null);
  await expect(page).toHaveURL(/\/reset-password$/);
  const reset = page.locator("form");
  await reset.getByPlaceholder("min. 8 znaków").fill(newPassword);
  await reset.getByPlaceholder("••••••••").fill(newPassword);
  await reset.getByRole("button", { name: "Ustaw nowe hasło" }).click();
  await expect(page.getByText("Hasło zmienione")).toBeVisible();

  await page.context().clearCookies();
  await page.goto("/login");
  await login.getByPlaceholder("twój@email.com").fill(email);
  await login.getByPlaceholder("••••••••").fill(newPassword);
  await login.getByRole("button", { name: "Zaloguj się" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
