import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createEncryptedKeyBackup,
  generateUserDataKeyBytes,
  unlockUserDataKey,
  type EncryptedKeyBackup,
} from "@/sync/encryption/key-backup";
import { SyncUnlockPanel } from "@/features/sync/sync-unlock-panel";

// Hasło konta jest teraz zarazem passphrase, z której wyprowadzany jest klucz
// danych (pending-auth-password.ts przenosi je przez przeładowanie strony).
// Te testy trzymają obietnicę tej zmiany: własne hasło odblokowuje bez pytania,
// a konto ze starą, osobną passphrase NIGDY nie zostaje zablokowane ani
// straszone błędem — spada do zwykłego formularza. Kryptografia jest prawdziwa
// (WebCrypto), mockowana jest tylko sieć i IndexedDB.

const PENDING_KEY = "zecca:pending-auth-password";
const LABEL = /Hasło lub passphrase backupu klucza/;
const ITERATIONS = 1_000; // szybki KDF; unlock czyta liczbę iteracji z backupu

const net = vi.hoisted(() => ({
  bootstrap: { keyBackup: null as unknown, encryptedRecords: [] as unknown[] },
  upsert: vi.fn(),
  cachedKey: null as CryptoKey | null,
}));

vi.mock("@/supabase/client", () => ({
  createBrowserSupabaseClientOrNull: () => ({}),
}));

vi.mock("@/sync/encryption/key-cache", () => ({
  loadCachedUserDataKey: vi.fn(async () => net.cachedKey),
  saveCachedUserDataKey: vi.fn(async () => undefined),
  clearCachedUserDataKey: vi.fn(async () => undefined),
}));

vi.mock("@/sync/records/supabase-sync-store", () => ({
  fetchActiveEncryptedRecords: vi.fn(async () => []),
  fetchEncryptedKeyBackup: vi.fn(async () => net.bootstrap.keyBackup),
  refreshEncryptedKeyBackup: vi.fn(async () => net.bootstrap.keyBackup),
  registerWebDevice: vi.fn(async () => undefined),
  upsertEncryptedKeyBackup: (...args: unknown[]) => net.upsert(...args),
}));

vi.mock("@/sync/records/record-writer", () => ({
  flushPendingSyncOperations: vi.fn(async () => undefined),
}));

async function backupWrappedWith(passphrase: string): Promise<EncryptedKeyBackup> {
  return createEncryptedKeyBackup({
    rawUserDataKey: generateUserDataKeyBytes(),
    passphrase,
    iterations: ITERATIONS,
  });
}

function renderPanel() {
  const onSyncLoaded = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SyncUnlockPanel initialUser={{ id: "user-1", email: "a@b.pl" }} onSyncLoaded={onSyncLoaded} />
    </QueryClientProvider>,
  );
  return onSyncLoaded;
}

beforeEach(() => {
  sessionStorage.clear();
  net.bootstrap = { keyBackup: null, encryptedRecords: [] };
  net.cachedKey = null;
  net.upsert.mockReset();
  net.upsert.mockImplementation(async (_supabase, _userId, backup) => {
    net.bootstrap.keyBackup = backup; // po zapisie serwer zwraca już backup
  });
  vi.spyOn(globalThis, "fetch").mockImplementation(
    async () =>
      new Response(JSON.stringify(net.bootstrap), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SyncUnlockPanel — hasło jako klucz", () => {
  it("odblokowuje hasłem z logowania bez pokazywania formularza i sprząta hasło", async () => {
    net.bootstrap.keyBackup = await backupWrappedWith("Haslo-Konta1");
    sessionStorage.setItem(PENDING_KEY, "Haslo-Konta1");

    const onSyncLoaded = renderPanel();

    await waitFor(() => expect(onSyncLoaded).toHaveBeenCalledTimes(1));
    expect(screen.queryByLabelText(LABEL)).toBeNull();
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it("konto ze starą, osobną passphrase: cicho spada do formularza, bez komunikatu o błędzie", async () => {
    net.bootstrap.keyBackup = await backupWrappedWith("stara-osobna-fraza");
    sessionStorage.setItem(PENDING_KEY, "Haslo-Konta1"); // inne niż fraza

    const onSyncLoaded = renderPanel();

    // formularz ręczny jest dostępny...
    await screen.findByLabelText(LABEL);
    // ...nic nie zostało odblokowane, a użytkownik nie widzi fałszywego błędu
    expect(onSyncLoaded).not.toHaveBeenCalled();
    expect(screen.queryByText(/Nie udało się/)).toBeNull();
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it("po cichej porażce działa ręczne wpisanie starej passphrase", async () => {
    net.bootstrap.keyBackup = await backupWrappedWith("stara-osobna-fraza");
    sessionStorage.setItem(PENDING_KEY, "Haslo-Konta1");

    const onSyncLoaded = renderPanel();
    const input = await screen.findByLabelText(LABEL);
    fireEvent.change(input, { target: { value: "stara-osobna-fraza" } });
    fireEvent.click(screen.getByRole("button", { name: /Odblokuj/ }));

    await waitFor(() => expect(onSyncLoaded).toHaveBeenCalledTimes(1));
  });

  it("bez hasła w sessionStorage od razu pokazuje formularz (brak próby automatycznej)", async () => {
    net.bootstrap.keyBackup = await backupWrappedWith("Haslo-Konta1");

    const onSyncLoaded = renderPanel();

    await screen.findByLabelText(LABEL);
    expect(onSyncLoaded).not.toHaveBeenCalled();
  });

  it("konto bez backupu: sam tworzy backup z hasła, który da się odblokować tym hasłem", async () => {
    sessionStorage.setItem(PENDING_KEY, "Haslo-Konta1");

    const onSyncLoaded = renderPanel();

    await waitFor(() => expect(onSyncLoaded).toHaveBeenCalledTimes(1), { timeout: 15_000 });
    expect(net.upsert).toHaveBeenCalledTimes(1);
    const [, userId, backup] = net.upsert.mock.calls[0] as [unknown, string, EncryptedKeyBackup];
    expect(userId).toBe("user-1");
    // klucz z backupu odblokowuje się dokładnie hasłem konta, a innym nie
    await expect(unlockUserDataKey(backup, "Haslo-Konta1")).resolves.toBeTruthy();
    await expect(unlockUserDataKey(backup, "inne-haslo")).rejects.toBeTruthy();
    // użytkownik nie zobaczył formularza „utwórz backup"
    expect(screen.queryByRole("button", { name: /Utwórz backup klucza/ })).toBeNull();
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
  }, 20_000);

  it("konto bez backupu i bez hasła: pokazuje ręczne tworzenie backupu jak dotąd (np. konto Google/Apple)", async () => {
    renderPanel();

    await screen.findByRole("button", { name: /Utwórz backup klucza/ });
    expect(net.upsert).not.toHaveBeenCalled();
  });

  it("zaufana przeglądarka odblokowuje kluczem z cache i nie zostawia hasła w sessionStorage", async () => {
    net.bootstrap.keyBackup = await backupWrappedWith("Haslo-Konta1");
    net.cachedKey = await unlockUserDataKey(net.bootstrap.keyBackup as EncryptedKeyBackup, "Haslo-Konta1");
    sessionStorage.setItem(PENDING_KEY, "Haslo-Konta1");

    const onSyncLoaded = renderPanel();

    await waitFor(() => expect(onSyncLoaded).toHaveBeenCalledTimes(1));
    // hasło nie jest już potrzebne — nie może leżeć w storage do końca karty
    await waitFor(() => expect(sessionStorage.getItem(PENDING_KEY)).toBeNull());
  });
});
