import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { RecordType } from "@/domain/models/investor-data";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";
import { makeRecord } from "./helpers/records";
import { AddTransactionModal } from "@/features/transactions/add-transaction-modal";
import { refreshSyncStore, saveRecord } from "@/sync/records/record-writer";

const store = vi.hoisted(() => ({
  state: {
    records: [] as DecryptedRecord[],
    snapshot: null as unknown,
    userDataKey: {} as CryptoKey,
    supabase: {} as unknown,
    setSync: vi.fn(),
    addTransactionOpen: false,
    closeAddTransaction: vi.fn(),
  },
}));

vi.mock("@/sync/store/sync-store", () => ({
  useSyncStore: (selector: (state: typeof store.state) => unknown) =>
    selector(store.state),
}));

vi.mock("@/sync/records/record-writer", () => ({
  refreshSyncStore: vi.fn(),
  saveRecord: vi.fn(),
}));

vi.mock("@/lib/telemetry", () => ({
  getTelemetryService: () => ({ signal: vi.fn() }),
  TelemetryEvent: { transactionAdded: "transaction_added" },
  telemetrySnakeCased: (value: string) => value,
}));

const accountID = "11111111-1111-4111-8111-111111111111";
const newAssetID = "22222222-2222-4222-8222-222222222229";

const record = (
  type: RecordType,
  id: string,
  payload: unknown,
  updatedAt = "2026-05-15T10:00:00.000Z",
) => makeRecord(type, id, payload, updatedAt);

const accountRecord = record("account", accountID, {
  recordType: "account",
  id: accountID,
  name: "Maklerski",
  accountType: "custom",
  baseCurrency: "PLN",
});

const newAssetRecord = record("asset", newAssetID, {
  recordType: "asset",
  id: newAssetID,
  kind: "stock",
  symbol: "AAPL",
  name: "Apple Inc.",
  currency: "PLN",
});

describe("AddTransactionModal inline instrument creation", () => {
  beforeEach(() => {
    store.state.records = [accountRecord];
    store.state.snapshot = null;
    store.state.setSync = vi.fn((records: DecryptedRecord[], snapshot: unknown) => {
      store.state.records = records;
      store.state.snapshot = snapshot;
    });
    store.state.closeAddTransaction = vi.fn();
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(newAssetID);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.mocked(saveRecord).mockResolvedValue({ queued: false });
    vi.mocked(refreshSyncStore).mockResolvedValue({
      records: [accountRecord, newAssetRecord],
      snapshot: null as never,
      summary: null as never,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("adds a missing instrument without leaving the transaction form", async () => {
    render(<AddTransactionModal open initialValue={null} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Nowy" })).toBeTruthy();
    });

    expect(screen.queryByRole("link", { name: "Nowy" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Nowy" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Dodaj instrument" })).toBeTruthy();
    });
    fireEvent.change(screen.getByPlaceholderText("np. VWCE, BTC, EDO1033"), {
      target: { value: "AAPL" },
    });
    fireEvent.change(screen.getByPlaceholderText("np. Vanguard FTSE All-World"), {
      target: { value: "Apple Inc." },
    });
    fireEvent.change(screen.getByLabelText("Ticker Yahoo"), {
      target: { value: "AAPL" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Dodaj instrument" }));

    await waitFor(() => {
      expect(saveRecord).toHaveBeenCalledWith(
        store.state.supabase,
        store.state.userDataKey,
        "asset",
        expect.objectContaining({
          id: newAssetID,
          recordType: "asset",
          symbol: "AAPL",
          name: "Apple Inc.",
          marketDataID: "AAPL",
        }),
        { baseUpdatedAt: null },
      );
    });

    await waitFor(() => {
      const selected = screen.getByDisplayValue("AAPL · Apple Inc.") as HTMLSelectElement;
      expect(selected.value).toBe(newAssetID);
    });
    expect(screen.getByRole("button", { name: "Anuluj" })).toBeTruthy();
  });
});
