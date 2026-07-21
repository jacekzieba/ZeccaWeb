import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleLogout } from "@/components/layout/app-shell";
import { getPendingSyncOperations } from "@/sync/records/record-writer";

// Mirror of record-writer's private PENDING_SYNC_KEY, used only to seed the queue.
const PENDING_SYNC_KEY = "investor-web-pending-sync-v1";

vi.mock("@/supabase/client", () => ({
  createBrowserSupabaseClientOrNull: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  })),
}));

vi.mock("@/sync/encryption/key-cache", () => ({
  clearCachedUserDataKey: vi.fn(async () => {}),
}));

describe("app-shell handleLogout", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    const localStorageMock = {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        storage.delete(key);
      }),
      clear: vi.fn(() => {
        storage.clear();
      }),
    };

    Object.defineProperty(globalThis, "localStorage", {
      value: localStorageMock,
      configurable: true,
    });
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      configurable: true,
    });

    Object.defineProperty(window, "location", {
      value: { assign: vi.fn() },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("clears the pending-sync queue on logout", async () => {
    localStorage.setItem(
      PENDING_SYNC_KEY,
      JSON.stringify([{ operationId: "op-1", operation: "upsert" }]),
    );
    expect(getPendingSyncOperations()).toHaveLength(1);

    await handleLogout();

    expect(getPendingSyncOperations()).toHaveLength(0);
  });
});
