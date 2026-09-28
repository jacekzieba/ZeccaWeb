import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { unlockUserDataKey, type EncryptedKeyBackup } from "@/sync/encryption/key-backup";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";
import { peekPendingAuthPassword } from "@/features/auth/pending-auth-password";
import { deriveAuthSecret } from "@/features/auth/auth-secret";

// Reset przez link e-mail nie zna starego hasła, więc nie może przepakować
// istniejącego backupu klucza. Ekran ma o tym uczciwie powiedzieć i — co
// najważniejsze — nigdy nie kasować backupu bez wyraźnego kliknięcia, bo konto
// ze starą, osobną passphrase wciąż da się odblokować bez żadnego resetu.

const NEW_PASSWORD = "Nowe-Haslo1";

const backend = vi.hoisted(() => ({
  updateUser: vi.fn(),
  existingBackup: null as unknown,
  fetchThrows: false,
  upsert: vi.fn(),
  deleteAll: vi.fn(),
  calls: [] as string[],
}));

vi.mock("@/supabase/client", () => ({
  createBrowserSupabaseClientOrNull: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1", email: "a@b.pl" } } }),
      updateUser: (...a: unknown[]) => backend.updateUser(...a),
    },
  }),
}));

vi.mock("@/sync/records/supabase-sync-store", () => ({
  fetchEncryptedKeyBackup: vi.fn(async () => {
    if (backend.fetchThrows) throw new Error("network");
    return backend.existingBackup;
  }),
  upsertEncryptedKeyBackup: (...a: unknown[]) => {
    backend.calls.push("upsert");
    return backend.upsert(...a);
  },
  deleteAllEncryptedRecords: (...a: unknown[]) => {
    backend.calls.push("deleteAll");
    return backend.deleteAll(...a);
  },
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
  backend.deleteAll.mockReset().mockResolvedValue(undefined);
  backend.calls = [];
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
    expect(peekPendingAuthPassword()).toBe(NEW_PASSWORD);
    // Auth dostaje sekret wyprowadzony z hasła; surowe hasło zostaje na urządzeniu.
    expect(backend.updateUser).toHaveBeenCalledWith({ password: await deriveAuthSecret("a@b.pl", NEW_PASSWORD) });
  });

  it("„zacznij od nowa” wymaga drugiego potwierdzenia, zanim cokolwiek skasuje", async () => {
    backend.existingBackup = { encrypted_user_data_key: "x", nonce: "x", salt: "x", kdf: "pbkdf2-sha256", kdf_iterations: 1 };
    render(<ResetPasswordForm />);
    await submitNewPassword();

    fireEvent.click(await screen.findByRole("button", { name: /zacznij od nowa/ }));

    expect(await screen.findByRole("button", { name: /Tak, usuń dane/ })).toBeTruthy();
    expect(backend.deleteAll).not.toHaveBeenCalled();
    expect(backend.upsert).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Anuluj/ }));
    expect(screen.queryByRole("button", { name: /Tak, usuń dane/ })).toBeNull();
    expect(backend.deleteAll).not.toHaveBeenCalled();
  });

  it("po potwierdzeniu usuwa stare rekordy PRZED zapisaniem świeżego backupu, który odblokowuje się nowym hasłem", async () => {
    // Rekordy zaszyfrowane starym kluczem, zostawione obok nowego backupu,
    // wywracają każde odblokowanie (jeden nieodszyfrowalny rekord odrzuca
    // wszystkie) — konto byłoby zablokowane na stałe.
    backend.existingBackup = { encrypted_user_data_key: "x", nonce: "x", salt: "x", kdf: "pbkdf2-sha256", kdf_iterations: 1 };
    render(<ResetPasswordForm />);
    await submitNewPassword();

    fireEvent.click(await screen.findByRole("button", { name: /zacznij od nowa/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Tak, usuń dane/ }));

    await waitFor(() => expect(backend.upsert).toHaveBeenCalledTimes(1), { timeout: 15_000 });
    expect(backend.calls).toEqual(["deleteAll", "upsert"]);
    expect(backend.deleteAll.mock.calls[0]?.[1]).toBe("user-1");
    const [, userId, backup] = backend.upsert.mock.calls[0] as [unknown, string, EncryptedKeyBackup];
    expect(userId).toBe("user-1");
    await expect(unlockUserDataKey(backup, NEW_PASSWORD)).resolves.toBeTruthy();
  }, 20_000);

  it("gdy usunięcie rekordów się nie uda, nie zapisuje nowego backupu (stary klucz wciąż pasuje do danych)", async () => {
    backend.existingBackup = { encrypted_user_data_key: "x", nonce: "x", salt: "x", kdf: "pbkdf2-sha256", kdf_iterations: 1 };
    backend.deleteAll.mockRejectedValue(new Error("network"));
    render(<ResetPasswordForm />);
    await submitNewPassword();

    fireEvent.click(await screen.findByRole("button", { name: /zacznij od nowa/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Tak, usuń dane/ }));

    await screen.findByText(/network/);
    expect(backend.upsert).not.toHaveBeenCalled();
  });

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
