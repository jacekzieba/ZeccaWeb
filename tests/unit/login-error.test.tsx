import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { authErrorMessage, isInvalidCredentials } from "@/features/auth/auth-error-message";
import { LoginForm } from "@/features/auth/login-form";

const signInWithPassword = vi.fn();

vi.mock("@/supabase/client", () => ({
  createBrowserSupabaseClientOrNull: () => ({ auth: { signInWithPassword } }),
}));

afterEach(() => {
  cleanup();
  signInWithPassword.mockReset();
});

describe("authErrorMessage — najczęstsze błędy Supabase Auth po polsku", () => {
  it("rozpoznaje błędne dane logowania po kodzie i po komunikacie (starsze API)", () => {
    expect(isInvalidCredentials({ message: "Invalid login credentials", code: "invalid_credentials", status: 400 })).toBe(true);
    expect(isInvalidCredentials({ message: "Invalid login credentials" })).toBe(true);
    expect(isInvalidCredentials({ message: "Email not confirmed", code: "email_not_confirmed" })).toBe(false);
    expect(authErrorMessage({ message: "Invalid login credentials" })).toBe(
      "Nieprawidłowy e-mail lub hasło. Jeśli konto zakładałeś przed 28.09.2026 albo nie pamiętasz hasła, użyj „Nie pamiętasz hasła?”.",
    );
  });

  it("niepotwierdzony e-mail", () => {
    expect(authErrorMessage({ message: "Email not confirmed", code: "email_not_confirmed", status: 400 })).toBe(
      "Adres e-mail nie jest jeszcze potwierdzony. Kliknij link z wiadomości, którą wysłaliśmy przy rejestracji, i zaloguj się ponownie.",
    );
  });

  it("limity prób i wysyłki e-maili", () => {
    const expected = "Zbyt wiele prób w krótkim czasie. Odczekaj chwilę i spróbuj ponownie.";
    expect(authErrorMessage({ message: "Request rate limit reached", code: "over_request_rate_limit", status: 429 })).toBe(expected);
    expect(authErrorMessage({ message: "Email rate limit exceeded", code: "over_email_send_rate_limit", status: 429 })).toBe(expected);
    expect(authErrorMessage({ message: "Too many requests", status: 429 })).toBe(expected);
  });

  it("inne błędy zostają bez zmian", () => {
    expect(authErrorMessage({ message: "Signups not allowed for this instance", code: "signup_disabled", status: 422 })).toBe(
      "Signups not allowed for this instance",
    );
  });
});

describe("LoginForm — błędne dane logowania", () => {
  it("pokazuje polski komunikat z linkiem do resetu hasła zamiast „Invalid login credentials”", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials", code: "invalid_credentials", status: 400 },
    });
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "a@b.pl" } });
    fireEvent.change(screen.getByLabelText("Hasło"), { target: { value: "Zle-haslo1" } });
    fireEvent.click(screen.getByRole("button", { name: "Zaloguj się" }));

    const message = await screen.findByText(/Nieprawidłowy e-mail lub hasło/, undefined, { timeout: 10_000 });
    expect(message.textContent).toContain("przed 28.09.2026");
    expect(screen.queryByText(/Invalid login credentials/)).toBeNull();
    expect(screen.getByRole("link", { name: "„Nie pamiętasz hasła?”" }).getAttribute("href")).toBe("/forgot-password");
  }, 15_000);
});
