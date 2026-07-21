import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LoginForm } from "@/features/auth/login-form";
import { SignupForm } from "@/features/auth/signup-form";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

// A stubbed client keeps these render-only tests hermetic. Login/signup/forgot
// only touch Supabase inside submit handlers (never triggered here); the reset
// form calls getUser() on mount, so we resolve a user to let its form render.
vi.mock("@/supabase/client", () => ({
  createBrowserSupabaseClientOrNull: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "test" } } }),
    },
  }),
}));

afterEach(() => {
  cleanup();
});

describe("auth form labels are programmatically associated", () => {
  it("associates the login form fields with their inputs", () => {
    render(<LoginForm />);

    expect((screen.getByLabelText("E-mail") as HTMLInputElement).type).toBe("email");
    expect((screen.getByLabelText("Hasło") as HTMLInputElement).type).toBe("password");
  });

  it("associates the signup form fields with their inputs", () => {
    render(<SignupForm />);

    expect((screen.getByLabelText("E-mail") as HTMLInputElement).type).toBe("email");
    expect((screen.getByLabelText("Hasło") as HTMLInputElement).type).toBe("password");
    expect((screen.getByLabelText("Powtórz hasło") as HTMLInputElement).type).toBe("password");
  });

  it("associates the forgot-password email field with its input", () => {
    render(<ForgotPasswordForm />);

    expect((screen.getByLabelText("E-mail") as HTMLInputElement).type).toBe("email");
  });

  it("associates the reset-password fields with their inputs", async () => {
    render(<ResetPasswordForm />);

    expect((await screen.findByLabelText("Nowe hasło") as HTMLInputElement).type).toBe("password");
    expect((screen.getByLabelText("Powtórz nowe hasło") as HTMLInputElement).type).toBe("password");
  });
});
