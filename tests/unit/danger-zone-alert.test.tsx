import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// Odmowa usunięcia konta (np. logowanie starsze niż 5 minut) pojawiała się jako
// zwykły tekst — czytnik ekranu nie mówił, dlaczego nic się nie stało.

vi.mock("@/supabase/client", () => ({
  createBrowserSupabaseClientOrNull: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
  }),
}));

vi.mock("@/features/settings/account-deletion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/settings/account-deletion")>()),
  requestAccountDeletion: async () => "reauthentication_required",
}));

vi.mock("@/components/layout/app-shell", () => ({ handleLogout: vi.fn() }));

afterEach(cleanup);

describe("usuwanie konta w Ustawieniach", () => {
  it("ogłasza odmowę serwera jako alert", async () => {
    const { DangerZone } = await import("@/features/settings/settings-page");
    render(<DangerZone />);

    fireEvent.click(screen.getByRole("button", { name: "Usuń konto" }));
    fireEvent.click(screen.getByRole("button", { name: "Usuń trwale" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("wymaga świeżego logowania");
    expect(screen.getByRole("button", { name: "Wyloguj i zaloguj ponownie" })).toBeTruthy();
  });
});
