import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { unlockUserDataKey, type EncryptedKeyBackup } from "@/sync/encryption/key-backup";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

// Reset przez link e-mail nie zna starego hasła, więc nie może przepakować
// istniejącego backupu klucza. Ekran ma o tym uczciwie powiedzieć i — co
// najważniejsze — nigdy nie kasować backupu bez wyraźnego kliknięcia, bo konto
// ze starą, osobną passphrase wciąż da się odblokować bez żadnego resetu.

const PENDING_KEY = "zecca:pending-auth-password";
const NEW_PASSWORD = "Nowe-Haslo1";

const backend = vi.hoisted(() => ({
  updateUser: vi.fn(),
  existingBackup: null as unknown,
  fetchThrows: false,
  upsert: vi.fn(),
}));

vi.mock("@/supabase/client", () => ({
  createBrowserSupabaseClientOrNull: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1" } } }),
      updateUser: (...a: unknown[]) => backend.updateUser(...a),
    },
  }),
}));

vi.mock("@/sync/records/supabase-sync-store", () => ({
  fetchEncryptedKeyBackup: vi.fn(async () => {
    if (backend.fetchThrows) throw new Error("network");
    return backend.existingBackup;
  }),
  upsertEncryptedKeyBackup: (...a: unknown[]) => backend.upsert(...a),
}));

async function submitNewPassword(password = NEW_PASSWORD) {
  const [pw, confirm] = await waitFor(() => {
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="password"]');
    expect(inputs.length).toBe(2);
    return [inputs[0], inputs[1]];
  });
  fireEvent.change(pw, { target: { value: password } });
  fireEvent.change(confirm, { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: /Ustaw nowe hasło/ }));
}

beforeEach(() => {
  sessionStorage.clear();
  backend.updateUser.mockReset().mockResolvedValue({ error: null });
  backend.upsert.mockReset().mockResolvedValue(undefined);
  backend.existingBackup = null;
  backend.fetchThrows = false;
});
afterEach(cleanup);

describe("ResetPasswordForm", () => {
  it("słabe hasło (bez wielkiej litery i cyfry) jest odrzucone po polsku, zanim dotknie backendu", async () => {
    render(<ResetPasswordForm />);
    await submitNewPassword("aaaaaaaa");

    await screen.findByText(/małą literę, wielką literę i cyfrę/);
    expect(backend.updateUser).not.toHaveBeenCalled();
  });

  it("istniejący backup: najpierw nieniszcząca ścieżka, a nic nie jest kasowane bez kliknięcia", async () => {
    backend.existingBackup = { encrypted_user_data_key: "x", nonce: "x", salt: "x", kdf: "pbkdf2-sha256", kdf_iterations: 1 };
    render(<ResetPasswordForm />);
    await submitNewPassword();

    const safe = await screen.findByRole("link", { name: /spróbuj obecnej frazy/ });
    expect(safe.getAttribute("href")).toBe("/dashboard");
    expect(screen.getByRole("button", { name: /zacznij od nowa/ })).toBeTruthy();
    expect(backend.upsert).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(PENDING_KEY)).toBe(NEW_PASSWORD);
  });

  it("„zacznij od nowa” zapisuje świeży backup, który odblokowuje się nowym hasłem", async () => {
    backend.existingBackup = { encrypted_user_data_key: "x", nonce: "x", salt: "x", kdf: "pbkdf2-sha256", kdf_iterations: 1 };
    render(<ResetPasswordForm />);
    await submitNewPassword();

    fireEvent.click(await screen.findByRole("button", { name: /zacznij od nowa/ }));

    await waitFor(() => expect(backend.upsert).toHaveBeenCalledTimes(1), { timeout: 15_000 });
    const [, userId, backup] = backend.upsert.mock.calls[0] as [unknown, string, EncryptedKeyBackup];
    expect(userId).toBe("user-1");
    await expect(unlockUserDataKey(backup, NEW_PASSWORD)).resolves.toBeTruthy();
  }, 20_000);

  it("brak backupu: zwykły sukces, bez straszenia i bez przycisku kasującego", async () => {
    render(<ResetPasswordForm />);
    await submitNewPassword();

    await screen.findByText(/odblokują się tym samym hasłem/);
    expect(screen.queryByRole("button", { name: /zacznij od nowa/ })).toBeNull();
  });

  it("nie da się sprawdzić backupu: nie twierdzi niczego, czego nie zweryfikował", async () => {
    backend.fetchThrows = true;
    render(<ResetPasswordForm />);
    await submitNewPassword();

    await screen.findByText(/Nie udało się sprawdzić stanu zaszyfrowanych danych/);
    expect(screen.queryByText(/odblokują się tym samym hasłem/)).toBeNull();
    expect(screen.queryByRole("button", { name: /zacznij od nowa/ })).toBeNull();
  });
});
