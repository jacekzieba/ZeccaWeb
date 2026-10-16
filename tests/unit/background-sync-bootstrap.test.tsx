import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { BackgroundSyncBootstrap } from "@/features/sync/background-sync-bootstrap";
import { useSyncStore } from "@/sync/store/sync-store";
import { runSyncCycle } from "@/sync/records/sync-cycle";
import type { BrowserSupabaseClient } from "@/supabase/client";

vi.mock("@/sync/records/sync-cycle", () => ({ runSyncCycle: vi.fn() }));

const supabase = {
  auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
  channel: vi.fn(),
  removeChannel: vi.fn(),
} as unknown as BrowserSupabaseClient;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.mocked(runSyncCycle).mockReset();
  useSyncStore.getState().clearSync();
});

describe("BackgroundSyncBootstrap", () => {
  it("przy trwałym błędzie wydłuża przerwy między próbami zamiast pobierać wszystko co 15 s", async () => {
    vi.useFakeTimers();
    vi.mocked(runSyncCycle).mockRejectedValue(new Error("Klucz jest poprawny, ale nie udało się odszyfrować 1 z 900 rekordów"));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    useSyncStore.setState({ supabase, userDataKey: {} as CryptoKey });
    render(<BackgroundSyncBootstrap />);

    // Pierwsza próba: mutacja (np. zapis) wyzwala synchronizację.
    await act(async () => {
      window.dispatchEvent(new CustomEvent("investor-web-sync-mutation"));
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(runSyncCycle).toHaveBeenCalledTimes(1);

    // Przez kolejne 3 minuty — bez widocznej karty, więc bez cyklu „co minutę”.
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3 * 60_000);
    });
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });

    // Co 15 s byłoby to 12 kolejnych prób; z odstępami 15 s, 30 s, 60 s, 120 s — 3.
    expect(vi.mocked(runSyncCycle).mock.calls.length).toBeLessThanOrEqual(5);
  });
});
