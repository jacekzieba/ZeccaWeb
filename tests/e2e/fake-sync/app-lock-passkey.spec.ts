import { expect, test, type Page } from "@playwright/test";

async function enterPin(page: Page, pin: string) {
  for (const digit of pin) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
  await page.getByRole("button", { name: "Odblokuj", exact: true }).click();
}

test("passkey unlocks the PIN screen lock via a platform authenticator", async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });

  // WebAuthn rejects IP addresses as RP ID; "localhost" is allowed.
  await page.goto("http://localhost:3101/settings");
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Ustaw blokadę" }).click();
  await enterPin(page, "1234");
  await enterPin(page, "1234"); // confirm

  await main.getByRole("button", { name: "Dodaj passkey" }).click();
  await expect(main.getByRole("button", { name: "Usuń passkey" })).toBeVisible();

  // Simulate coming back to a locked tab: drop the "verified" flag and reload.
  await page.evaluate(() => sessionStorage.removeItem("investor-app-lock-verified"));
  await page.reload();

  await expect(page.getByText("Podaj PIN, aby odblokować")).toBeVisible();
  await page.getByRole("button", { name: "Odblokuj biometrią (passkey)" }).click();
  await expect(page.getByText("Podaj PIN, aby odblokować")).toBeHidden();
  await expect(page.getByRole("main")).toBeVisible();
});
