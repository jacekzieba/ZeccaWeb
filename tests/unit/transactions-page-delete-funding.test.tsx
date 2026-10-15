import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";
import { makeRecord } from "./helpers/records";
import { TransactionsPage } from "@/features/transactions/transactions-page";
import { deleteRecord, refreshSyncStore } from "@/sync/records/record-writer";

const store = vi.hoisted(() => ({
  state: {
    records: [] as DecryptedRecord[],
    snapshot: null as unknown,
    userDataKey: {} as CryptoKey,
    supabase: {} as unknown,
    setSync: vi.fn(),
    openAddTransaction: vi.fn(),
    publicDemo: false,
  },
}));

vi.mock("@/sync/store/sync-store", () => ({
  useSyncStore: (selector: (state: typeof store.state) => unknown) => selector(store.state),
}));

vi.mock("@/sync/records/record-writer", () => ({
  SyncConflictError: class SyncConflictError extends Error {},
  deleteRecord: vi.fn(),
  restoreRecord: vi.fn(),
  removePendingSyncOperation: vi.fn(),
  refreshSyncStore: vi.fn(),
  saveRecord: vi.fn(),
}));

vi.mock("@/features/sync/use-display-currency", () => ({
  useDisplayCurrency: () => ({ currency: "USD" }),
}));

const accountID = "11111111-1111-4111-8111-111111111111";
const assetID = "22222222-2222-4222-8222-222222222222";
const buyID = "33333333-3333-4333-8333-333333333333";
const depositID = "44444444-4444-4444-8444-444444444444";
const date = "2026-05-10T10:00:00.000Z";

const records = [
  makeRecord("account", accountID, {
    recordType: "account",
    id: accountID,
    name: "Maklerski",
    accountType: "custom",
    baseCurrency: "PLN",
  }),
  makeRecord("asset", assetID, {
    recordType: "asset",
    id: assetID,
    kind: "etf",
    symbol: "VWRL.NL",
    name: "FTSE All-World",
    currency: "USD",
  }),
  makeRecord("transaction", buyID, {
    recordType: "transaction",
    id: buyID,
    date,
    portfolioID: accountID,
    instrumentID: assetID,
    transactionType: "buy",
    quantity: 10,
    price: 10,
    grossAmount: 100,
    currency: "USD",
    fees: 0,
    taxes: 0,
  }),
  makeRecord("transaction", depositID, {
    recordType: "transaction",
    id: depositID,
    date,
    portfolioID: accountID,
    instrumentID: null,
    transactionType: "cashDeposit",
    quantity: null,
    price: null,
    grossAmount: 100,
    currency: "USD",
    fees: 0,
    taxes: 0,
    notes: "Zasilenie pod zakup VWRL.NL",
  }),
];

function openDeleteDialogForBuy() {
  fireEvent.click(screen.getByRole("button", { name: /^Usuń transakcję: Kupno/ }));
}

describe("deleting a buy that has an automatic funding deposit", () => {
  beforeEach(() => {
    store.state.records = records;
    store.state.setSync = vi.fn();
    vi.mocked(deleteRecord).mockResolvedValue({ queued: false, updatedAt: "2026-05-11T10:00:00.000Z" } as never);
    vi.mocked(refreshSyncStore).mockResolvedValue({ records, snapshot: null as never, summary: null as never });
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it("deletes the buy together with its deposit on request", async () => {
    render(<TransactionsPage />);
    openDeleteDialogForBuy();

    fireEvent.click(screen.getByRole("button", { name: "Usuń zakup i wpłatę" }));

    await waitFor(() => expect(deleteRecord).toHaveBeenCalledTimes(2));
    const ids = vi.mocked(deleteRecord).mock.calls.map((call) => call[2]);
    expect(ids).toEqual([buyID, depositID]);
  });

  it("deletes only the buy when asked to", async () => {
    render(<TransactionsPage />);
    openDeleteDialogForBuy();

    fireEvent.click(screen.getByRole("button", { name: "Tylko zakup" }));

    await waitFor(() => expect(deleteRecord).toHaveBeenCalledTimes(1));
    expect(vi.mocked(deleteRecord).mock.calls[0][2]).toBe(buyID);
  });

  it("deletes nothing when cancelled", () => {
    render(<TransactionsPage />);
    openDeleteDialogForBuy();

    fireEvent.click(screen.getByRole("button", { name: "Anuluj" }));

    expect(deleteRecord).not.toHaveBeenCalled();
  });

  it("tells the user when the deposit could not be removed", async () => {
    vi.mocked(deleteRecord)
      .mockResolvedValueOnce({ queued: false, updatedAt: "x" } as never)
      .mockRejectedValueOnce(new Error("offline"));
    render(<TransactionsPage />);
    openDeleteDialogForBuy();

    fireEvent.click(screen.getByRole("button", { name: "Usuń zakup i wpłatę" }));

    await waitFor(() => expect(deleteRecord).toHaveBeenCalledTimes(2));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/Wpłata gotówki została na koncie/);
  });
});
