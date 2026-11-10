import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ImportPage } from "@/features/import/import-page";
import { useSyncStore } from "@/sync/store/sync-store";
import { saveRecord } from "@/sync/records/record-writer";
import { makeRecord } from "./helpers/records";

vi.mock("@/sync/records/record-writer", () => ({ saveRecord: vi.fn() }));
vi.mock("@/lib/env", async original => ({ ...await original<typeof import("@/lib/env")>(), isFakeSyncEnabled: () => false }));
vi.mock("@/features/import/etf-catalog", async original => {
  const actual = await original<typeof import("@/features/import/etf-catalog")>();
  return { ...actual, loadEtfCatalog: vi.fn().mockResolvedValue(actual.buildEtfCatalog([])) };
});
vi.mock("@/features/import/read-spreadsheet", () => ({ readSpreadsheet: vi.fn().mockResolvedValue([
  ["ID", "Type", "Time", "Ticker", "Instrument", "Comment", "Amount"],
  [1, "Deposit", 45569.5, "", "", "Deposit", 1000],
  [2, "Stock purchase", 45569.5, "VWRL.NL", "Vanguard", "OPEN BUY 1 @ 10", -40],
]) }));
const originalState = useSyncStore.getState();
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  vi.mocked(saveRecord).mockReset().mockResolvedValue({ queued: false });
  useSyncStore.setState({ ...originalState, records: [makeRecord("account", id, { id, recordType: "account", name: "Queue", baseCurrency: "PLN" })], userDataKey: {} as CryptoKey, supabase: {} as never, publicDemo: false });
});
afterEach(() => { cleanup(); useSyncStore.setState(originalState); vi.unstubAllGlobals(); });

async function uploadAndConfirm() {
  const { container } = render(<ImportPage />);
  fireEvent.click(screen.getByRole("button", { name: /^XTB / }));
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(["queue-source"], "queue.xlsx")] } });
  await screen.findByLabelText("Waluta rozliczenia: VWRL.NL");
  fireEvent.change(screen.getByLabelText("ISIN: VWRL.NL"), { target: { value: "IE00B3RBWM25" } });
  fireEvent.change(screen.getByLabelText("Giełda / listing: VWRL.NL"), { target: { value: "AMS" } });
  fireEvent.change(screen.getByLabelText("Ticker notowania: VWRL.NL"), { target: { value: "VWRL.AS" } });
  fireEvent.click(screen.getByLabelText("Potwierdzam tożsamość instrumentu i źródło jego notowań."));
}

describe("import persistence status", () => {
  it.each([
    { name: "queued asset", queuedTypes: ["asset"], saved: 2, queued: 1 },
    { name: "queued transactions", queuedTypes: ["transaction"], saved: 1, queued: 2 },
    { name: "all records queued", queuedTypes: ["asset", "transaction"], saved: 0, queued: 3 },
  ])("reports every record for $name", async ({ queuedTypes, saved, queued }) => {
    await uploadAndConfirm();
    vi.mocked(saveRecord).mockImplementation(async (_client, _key, type) => ({ queued: queuedTypes.includes(type) }));
    fireEvent.click(screen.getByRole("button", { name: "Importuj wybrane" }));
    await screen.findByText(new RegExp(`Zapisano ${saved} rekordów, ${queued} czeka w kolejce sync`));
    expect(saveRecord).toHaveBeenCalledTimes(3);
  });

  it("retains a queued asset after transport failure and retries only missing transactions", async () => {
    await uploadAndConfirm();
    vi.mocked(saveRecord).mockResolvedValueOnce({ queued: true }).mockRejectedValueOnce(new Error("Transport failed"));
    fireEvent.click(screen.getByRole("button", { name: "Importuj wybrane" }));
    await screen.findByText(/Zapisano lub zakolejkowano 1 rekordów \(w kolejce: 1\)/);
    expect(useSyncStore.getState().records?.filter(record => record.envelope.type === "asset")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Importuj wybrane" }));
    await screen.findByText(/Zaimportowano 2 rekordów/);
    expect(vi.mocked(saveRecord).mock.calls.filter(call => call[2] === "asset")).toHaveLength(1);
    expect(saveRecord).toHaveBeenCalledTimes(4);
  });
});
