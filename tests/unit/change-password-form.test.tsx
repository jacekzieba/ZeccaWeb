import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  createEncryptedKeyBackup,
  generateUserDataKeyBytes,
  unlockUserDataKey,
  type EncryptedKeyBackup,
} from "@/sync/encryption/key-backup";
import { ChangePasswordForm } from "@/features/auth/change-password-form";
import { deriveAuthSecret } from "@/features/auth/auth-secret";

// Hasło konta jest zarazem kluczem do backupu klucza danych. Zmiana hasła musi
// więc przepakować backup, a gdy zmiana hasła po stronie Auth się nie uda —
// przywrócić stary, żeby hasło i backup nigdy się nie rozjechały.

const OLD = "Stare-Haslo1";
const NEW = "Nowe-Haslo2";

const backend = vi.hoisted(() => ({
  providers: ["email"] as string[],
  signIn: vi.fn(),
  updateUser: vi.fn(),
  backup: null as unknown,
  upsert: vi.fn(),
  calls: [] as string[],
}));

vi.mock("@/supabase/client", () => ({
  createBrowserSupabaseClientOrNull: () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: "user-1", email: "a@b.pl", app_metadata: { providers: backend.providers } } },
      }),
      signInWithPassword: (...a: unknown[]) => backend.signIn(...a),
      updateUser: (...a: unknown[]) => {
        backend.calls.push("updateUser");
        return backend.updateUser(...a);
      },
    },
  }),
}));

vi.mock("@/sync/records/supabase-sync-store", () => ({
  fetchEncryptedKeyBackup: async () => backend.backup,
  upsertEncryptedKeyBackup: (...a: unknown[]) => {
    backend.calls.push("upsert");
    return backend.upsert(...a);
  },
}));

async function fill(current = OLD, next = NEW, confirm = next) {
  const inputs = await waitFor(() => {
    const found = document.querySelectorAll<HTMLInputElement>('input[type="password"]');
    expect(found.length).toBe(3);
    return found;
  });
  fireEvent.change(inputs[0], { target: { value: current } });
  fireEvent.change(inputs[1], { target: { value: next } });
  fireEvent.change(inputs[2], { target: { value: confirm } });
  fireEvent.click(screen.getByRole("button", { name: /Zmień hasło/ }));
}

beforeEach(async () => {
  backend.providers = ["email"];
  backend.signIn.mockReset().mockResolvedValue({ error: null });
  backend.updateUser.mockReset().mockResolvedValue({ error: null });
  backend.upsert.mockReset().mockResolvedValue(undefined);
  backend.calls = [];
  backend.backup = await createEncryptedKeyBackup({
    rawUserDataKey: generateUserDataKeyBytes(),
    passphrase: OLD,
    iterations: 1_000,
  });
});
afterEach(cleanup);

describe("ChangePasswordForm", () => {
  it("przepakowuje backup pod nowe hasło przed zmianą hasła w Auth", async () => {
    render(<ChangePasswordForm />);
    await fill();

    await screen.findByText(/Hasło zmienione/, undefined, { timeout: 10_000 });
    // Do Auth idą tylko sekrety wyprowadzone z haseł, nigdy same hasła.
    expect(backend.signIn).toHaveBeenCalledWith({ email: "a@b.pl", password: await deriveAuthSecret("a@b.pl", OLD) });
    expect(backend.updateUser).toHaveBeenCalledWith({ password: await deriveAuthSecret("a@b.pl", NEW) });
    expect(backend.calls).toEqual(["upsert", "updateUser"]);
    const [, userId, next] = backend.upsert.mock.calls[0] as [unknown, string, EncryptedKeyBackup];
    expect(userId).toBe("user-1");
    await expect(unlockUserDataKey(next, NEW)).resolves.toBeTruthy();
  }, 15_000);

  it("złe obecne hasło: nic nie zmienia", async () => {
    backend.signIn.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    render(<ChangePasswordForm />);
    await fill();

    await screen.findByText(/Obecne hasło jest nieprawidłowe/);
    expect(backend.calls).toEqual([]);
  });

  it("nieudana zmiana w Auth przywraca stary backup", async () => {
    backend.updateUser.mockResolvedValue({ error: { message: "boom" } });
    render(<ChangePasswordForm />);
    await fill();

    await screen.findByText(/boom/, undefined, { timeout: 10_000 });
    expect(backend.calls).toEqual(["upsert", "updateUser", "upsert"]);
    expect(backend.upsert.mock.calls[1]?.[2]).toEqual(backend.backup);
  }, 15_000);

  it("konto z osobną frazą sync: zmienia tylko hasło, backupu nie rusza", async () => {
    backend.backup = await createEncryptedKeyBackup({
      rawUserDataKey: generateUserDataKeyBytes(),
      passphrase: "osobna fraza sync",
      iterations: 1_000,
    });
    render(<ChangePasswordForm />);
    await fill();

    await screen.findByText(/fraza synchronizacji się nie zmienia/, undefined, { timeout: 10_000 });
    expect(backend.calls).toEqual(["updateUser"]);
  }, 15_000);

  it("słabe lub niepowtórzone nowe hasło jest odrzucane przed kontaktem z serwerem", async () => {
    render(<ChangePasswordForm />);
    await fill(OLD, NEW, "Inne-Haslo3");
    await screen.findByText(/różnią się/);
    expect(backend.signIn).not.toHaveBeenCalled();
  });

  it("konto Google/Apple bez hasła: brak formularza", async () => {
    backend.providers = ["google"];
    render(<ChangePasswordForm />);
    await screen.findByText(/logujesz się przez Google lub Apple/);
    expect(document.querySelectorAll('input[type="password"]').length).toBe(0);
  });
});
