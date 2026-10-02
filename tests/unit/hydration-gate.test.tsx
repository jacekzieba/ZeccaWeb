import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, type ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { createRoot, hydrateRoot } from "react-dom/client";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppLock } from "@/features/auth/app-lock";
import { SyncUnlockPanel } from "@/features/sync/sync-unlock-panel";
import { setPendingAuthPassword } from "@/features/auth/pending-auth-password";

// Zalogowany użytkownik dostaje z serwera bramkę odblokowania (AppLock →
// SyncUnlockPanel), a przeglądarka hydratuje ją ze swoim localStorage /
// sessionStorage. Serwer tych magazynów nie ma, więc pierwszy render klienta
// musi wyglądać jak serwerowy — inaczej React rzuca #418 i przerysowuje drzewo.
// Test: renderToString przy pustych magazynach (= serwer), potem zasiew
// magazynów (= przeglądarka) i hydrateRoot, który zbiera błędy hydratacji.

vi.mock("@/supabase/client", () => ({
  createBrowserSupabaseClientOrNull: () => ({
    auth: { signOut: vi.fn(async () => ({ error: null })) },
  }),
}));

vi.mock("@/sync/encryption/key-cache", () => ({
  loadCachedUserDataKey: vi.fn(async () => null),
  saveCachedUserDataKey: vi.fn(async () => undefined),
  clearCachedUserDataKey: vi.fn(async () => undefined),
}));

vi.mock("@/sync/records/supabase-sync-store", () => ({
  fetchActiveEncryptedRecords: vi.fn(async () => []),
  fetchEncryptedKeyBackup: vi.fn(async () => null),
  refreshEncryptedKeyBackup: vi.fn(async () => null),
  registerWebDevice: vi.fn(async () => undefined),
  upsertEncryptedKeyBackup: vi.fn(async () => undefined),
}));

vi.mock("@/sync/records/record-writer", () => ({
  flushPendingSyncOperations: vi.fn(async () => undefined),
  clearPendingSyncOperations: vi.fn(),
}));

async function hydrationErrors(make: () => ReactElement, seedBrowserStorage: () => void) {
  const html = renderToString(make());
  seedBrowserStorage();
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  const errors: string[] = [];
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  await act(async () => {
    hydrateRoot(container, make(), {
      onRecoverableError: (error) => errors.push(String(error)),
    });
  });
  return { errors, container };
}

function unlockPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <SyncUnlockPanel initialUser={{ id: "user-1", email: "a@b.pl" }} onSyncLoaded={() => undefined} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  // Node 22+ ma własny, niedziałający bez pliku localStorage, który zasłania
  // jsdomowy — jak w section-customization.test.ts podstawiamy prosty magazyn.
  const store: Record<string, string> = {};
  const mock = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => { delete store[k]; }); },
  };
  Object.defineProperty(window, "localStorage", { value: mock, writable: true, configurable: true });
  sessionStorage.clear();
  vi.spyOn(globalThis, "fetch").mockImplementation(
    async () =>
      new Response(JSON.stringify({ keyBackup: null, encryptedRecords: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("hydratacja bramki zalogowanego użytkownika", () => {
  it("AppLock z ustawionym PIN-em hydratuje się bez niezgodności", async () => {
    const { errors, container } = await hydrationErrors(
      () => (
        <AppLock>
          <p>aplikacja</p>
        </AppLock>
      ),
      () => {
        localStorage.setItem("investor-app-lock-setup", "1");
        sessionStorage.setItem("investor-app-lock-pin", "abc");
      },
    );
    expect(errors).toEqual([]);
    // Po hydratacji blokada nadal zasłania aplikację.
    expect(container.textContent).not.toContain("aplikacja");
    expect(container.textContent).toContain("PIN");
  });

  it("AppLock zamontowany w przeglądarce (bez hydratacji) od razu jest zablokowany", async () => {
    localStorage.setItem("investor-app-lock-setup", "1");
    sessionStorage.setItem("investor-app-lock-pin", "abc");
    const mounted = vi.fn();
    function App() {
      useEffect(() => mounted(), []);
      return <p>aplikacja</p>;
    }
    const container = document.createElement("div");
    document.body.appendChild(container);

    await act(async () => {
      createRoot(container).render(<AppLock><App /></AppLock>);
    });

    // Przejście między stronami nie może uruchamiać aplikacji pod blokadą.
    expect(mounted).not.toHaveBeenCalled();
    expect(container.textContent).toContain("PIN");
  });

  it("SyncUnlockPanel bez danych w magazynach hydratuje się bez niezgodności", async () => {
    const { errors } = await hydrationErrors(unlockPanel, () => undefined);
    expect(errors).toEqual([]);
  });

  it("SyncUnlockPanel z hasłem z logowania w sessionStorage hydratuje się bez niezgodności", async () => {
    const { errors } = await hydrationErrors(unlockPanel, () => setPendingAuthPassword("Haslo-Konta1"));
    expect(errors).toEqual([]);
  });
});
