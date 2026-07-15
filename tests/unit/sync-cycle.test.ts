import { beforeEach, describe, expect, it, vi } from "vitest";
import { runSyncCycle } from "@/sync/records/sync-cycle";
import {
  flushPendingSyncOperations,
  refreshSyncStore,
} from "@/sync/records/record-writer";

vi.mock("@/sync/records/record-writer", () => ({
  flushPendingSyncOperations: vi.fn(),
  refreshSyncStore: vi.fn(),
}));

describe("runSyncCycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shares one in-flight cycle between manual and background sync", async () => {
    let releaseFlush: (() => void) | undefined;
    vi.mocked(flushPendingSyncOperations).mockImplementation(
      () => new Promise((resolve) => {
        releaseFlush = () => resolve({ attempted: 0, sent: 0, remaining: [] });
      }),
    );
    vi.mocked(refreshSyncStore).mockResolvedValue({
      records: [],
      snapshot: { portfolios: [] } as never,
      summary: null as never,
    });

    const supabase = {} as never;
    const userDataKey = {} as CryptoKey;
    const manual = runSyncCycle(supabase, userDataKey);
    const background = runSyncCycle(supabase, userDataKey);

    expect(background).toBe(manual);
    expect(flushPendingSyncOperations).toHaveBeenCalledTimes(1);

    releaseFlush?.();
    await Promise.all([manual, background]);

    expect(refreshSyncStore).toHaveBeenCalledTimes(1);
  });
});
