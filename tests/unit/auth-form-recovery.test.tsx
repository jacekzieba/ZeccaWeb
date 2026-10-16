import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LoginForm } from "@/features/auth/login-form";
import { SignupForm } from "@/features/auth/signup-form";

const signInWithPassword = vi.fn();
const signInWithOAuth = vi.fn();
const signUp = vi.fn();

vi.mock("@/supabase/client", () => ({
  createBrowserSupabaseClientOrNull: () => ({ auth: { signInWithPassword, signInWithOAuth, signUp } }),
}));

afterEach(() => {
  cleanup();
  signInWithPassword.mockReset();
  signInWithOAuth.mockReset();
  signUp.mockReset();
});

const OAUTH_ERROR = { data: { provider: "google", url: null }, error: { message: "Provider is not enabled" } };

describe("formularze logowania i rejestracji wracają z blokady po błędzie", () => {
  it("logowanie: wyjątek z Supabase odblokowuje przycisk i pokazuje błąd", async () => {
    signInWithPassword.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "a@b.pl" } });
    fireEvent.change(screen.getByLabelText("Hasło"), { target: { value: "Dobre-haslo1" } });
    fireEvent.click(screen.getByRole("button", { name: "Zaloguj się" }));

    await screen.findByRole("alert", undefined, { timeout: 10_000 });
    expect(screen.getByRole("button", { name: "Zaloguj się" }).hasAttribute("disabled")).toBe(false);
  }, 15_000);

  it("logowanie: błąd zwrócony przez OAuth odblokowuje przyciski i pokazuje błąd", async () => {
    signInWithOAuth.mockResolvedValue(OAUTH_ERROR);
    render(<LoginForm />);
    fireEvent.click(screen.getByRole("button", { name: /Kontynuuj z Google/ }));

    expect((await screen.findByRole("alert")).textContent).toContain("Provider is not enabled");
    expect(screen.getByRole("button", { name: /Kontynuuj z Google/ }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "Zaloguj się" }).hasAttribute("disabled")).toBe(false);
  });

  it("rejestracja: wyjątek przy zakładaniu konta odblokowuje przycisk i pokazuje błąd", async () => {
    signUp.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<SignupForm />);
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "a@b.pl" } });
    fireEvent.change(screen.getByLabelText("Hasło"), { target: { value: "Dobre-haslo-123" } });
    fireEvent.change(screen.getByLabelText("Powtórz hasło"), { target: { value: "Dobre-haslo-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Utwórz konto" }));

    await screen.findByRole("alert", undefined, { timeout: 10_000 });
    expect(screen.getByRole("button", { name: "Utwórz konto" }).hasAttribute("disabled")).toBe(false);
  }, 15_000);

  it("rejestracja: błąd zwrócony przez OAuth odblokowuje przyciski i pokazuje błąd", async () => {
    signInWithOAuth.mockResolvedValue(OAUTH_ERROR);
    render(<SignupForm />);
    fireEvent.click(screen.getByRole("button", { name: /Kontynuuj z Apple/ }));

    expect((await screen.findByRole("alert")).textContent).toContain("Provider is not enabled");
    expect(screen.getByRole("button", { name: "Utwórz konto" }).hasAttribute("disabled")).toBe(false);
  });
});
