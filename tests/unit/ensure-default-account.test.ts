import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useEnsureDefaultAccount } from "@/components/layout/use-ensure-default-account";
import { useSyncStore } from "@/sync/store/sync-store";
import type { BrowserSupabaseClient } from "@/supabase/client";

const writer = vi.hoisted(() => ({ saveRecord: vi.fn() }));

vi.mock("@/sync/records/record-writer", () => ({
  saveRecord: writer.saveRecord,
  refreshSyncStore: vi.fn(),
}));

afterEach(() => {
  useSyncStore.getState().clearSync();
  writer.saveRecord.mockReset();
});

describe("useEnsureDefaultAccount", () => {
  it("ponawia zakolejkowany portfel startowy pod tym samym ID, zamiast mnożyć portfele", async () => {
    // Zapis nie dochodzi do serwera (kolejka), a odświeżanie w tle co chwilę
    // podmienia `records` — każda próba z nowym ID dokładała kolejny „Główny”.
    writer.saveRecord.mockResolvedValue({ queued: true });
    useSyncStore.setState({
      records: [],
      userDataKey: {} as CryptoKey,
      supabase: {} as BrowserSupabaseClient,
    });

    renderHook(() => useEnsureDefaultAccount());
    await waitFor(() => expect(writer.saveRecord).toHaveBeenCalledTimes(1));
    act(() => useSyncStore.setState({ records: [] }));
    await waitFor(() => expect(writer.saveRecord).toHaveBeenCalledTimes(2));

    const ids = writer.saveRecord.mock.calls.map((call) => (call[3] as { id: string }).id);
    expect(ids[1]).toBe(ids[0]);
  });
});
