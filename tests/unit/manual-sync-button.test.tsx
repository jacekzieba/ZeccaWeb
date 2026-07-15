import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ManualSyncButton } from "@/features/sync/manual-sync-button";
import {
  flushPendingSyncOperations,
  refreshSyncStore,
} from "@/sync/records/record-writer";

const store = vi.hoisted(() => ({
  state: {
    supabase: {} as unknown,
    userDataKey: {} as CryptoKey,
    setSync: vi.fn(),
  },
}));

vi.mock("@/sync/store/sync-store", () => ({
  useSyncStore: (selector: (state: typeof store.state) => unknown) =>
    selector(store.state),
}));

vi.mock("@/sync/records/record-writer", () => ({
  flushPendingSyncOperations: vi.fn(),
  refreshSyncStore: vi.fn(),
}));

describe("ManualSyncButton", () => {
  beforeEach(() => {
    store.state.setSync = vi.fn();
    vi.mocked(flushPendingSyncOperations).mockResolvedValue({
      attempted: 0,
      sent: 0,
      remaining: [],
    });
    vi.mocked(refreshSyncStore).mockResolvedValue({
      records: [],
      snapshot: { portfolios: [] } as never,
      summary: null as never,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("flushes pending writes, refreshes the snapshot, and reports success", async () => {
    render(<ManualSyncButton />);

    fireEvent.click(screen.getByRole("button", { name: "Synchronizuj teraz" }));

    expect(
      screen.getByRole("button", { name: "Synchronizowanie danych" }).hasAttribute("disabled"),
    ).toBe(true);
    await waitFor(() => {
      expect(flushPendingSyncOperations).toHaveBeenCalledWith(store.state.supabase);
      expect(refreshSyncStore).toHaveBeenCalledWith(
        store.state.supabase,
        store.state.userDataKey,
      );
      expect(store.state.setSync).toHaveBeenCalledWith([], { portfolios: [] });
    });
    expect(await screen.findByText("Dane zsynchronizowane.")).toBeTruthy();
  });

  it("keeps the current snapshot and exposes a refresh error", async () => {
    vi.mocked(refreshSyncStore).mockRejectedValue(new Error("Brak połączenia."));
    render(<ManualSyncButton />);

    fireEvent.click(screen.getByRole("button", { name: "Synchronizuj teraz" }));

    expect(await screen.findByText("Brak połączenia.")).toBeTruthy();
    expect(store.state.setSync).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Synchronizuj teraz" }).hasAttribute("disabled"),
    ).toBe(false);
  });
});
