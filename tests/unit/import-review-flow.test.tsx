import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  ["Type", "Instrument", "Ticker", "Time", "Amount", "ID", "Comment"],
  ["Deposit", "", "", 45569, 1000, "deposit", ""],
  ["Free funds interest", "", "", 45569, -10, "interest", ""],
]) }));
const originalState = useSyncStore.getState();
const portfolioID = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  vi.mocked(saveRecord).mockReset().mockResolvedValue({ queued: false });
  useSyncStore.setState({ ...originalState, records: [makeRecord("account", portfolioID, { id: portfolioID, recordType: "account", name: "Review", baseCurrency: "PLN" })], userDataKey: {} as CryptoKey, supabase: {} as never, publicDemo: false });
});
afterEach(() => { cleanup(); useSyncStore.setState(originalState); vi.unstubAllGlobals(); });

async function upload() {
  const { container } = render(<ImportPage />);
  fireEvent.click(screen.getByRole("button", { name: /^XTB / }));
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(["anonymous-source"], "review.xlsx")] } });
  await screen.findByText("Import wymaga sprawdzenia: 1 pozycji");
  return container;
}
async function edit(amount: string) {
  fireEvent.click(screen.getByRole("button", { name: "Edytuj pozycję z wiersza 3" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Kwota na rachunku (PLN)" }), { target: { value: amount } });
  fireEvent.click(screen.getByRole("button", { name: "Zapisz zmiany" }));
}
describe("source import review user flow", () => {
  it("blocks all writes until editing resolves the issue, then commits the corrected value", async () => {
    await upload();
    expect((screen.getByRole("button", { name: "Importuj wybrane" }) as HTMLButtonElement).disabled).toBe(true);
    expect(saveRecord).not.toHaveBeenCalled();
    await edit("10");
    await screen.findByText("Pozycje źródłowe zostały sprawdzone");
    fireEvent.click(screen.getByRole("button", { name: "Importuj wybrane" }));
    await waitFor(() => expect(useSyncStore.getState().snapshot?.totalValue).toBe(1010));
    expect(saveRecord).toHaveBeenCalledTimes(2);
    expect(vi.mocked(saveRecord).mock.calls.find(call => call[3].transactionType === "interest")?.[3].grossAmount).toBe(10);
  });
  it("keeps the import blocked when an edit is still invalid", async () => {
    await upload();
    await edit("NaN");
    await screen.findByText("Kwota musi być poprawną, skończoną liczbą.");
    expect((screen.getByRole("button", { name: "Importuj wybrane" }) as HTMLButtonElement).disabled).toBe(true);
    expect(saveRecord).not.toHaveBeenCalled();
  });
  it("explicitly excludes the invalid source row and saves only the remaining deposit", async () => {
    await upload();
    fireEvent.click(screen.getByRole("button", { name: "Usuń z importu pozycję z wiersza 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Usuń 1 powiązanych pozycji" }));
    await screen.findByText("Pozycje źródłowe zostały sprawdzone");
    fireEvent.click(screen.getByRole("button", { name: "Importuj wybrane" }));
    await waitFor(() => expect(useSyncStore.getState().snapshot?.totalValue).toBe(1000));
    expect(saveRecord).toHaveBeenCalledTimes(1);
  });
  it("retains the draft and deduplicates records already saved before a transport failure", async () => {
    await upload(); await edit("10");
    await screen.findByText("Pozycje źródłowe zostały sprawdzone");
    vi.mocked(saveRecord).mockResolvedValueOnce({ queued: false }).mockRejectedValueOnce(new Error("Transport failed"));
    fireEvent.click(screen.getByRole("button", { name: "Importuj wybrane" }));
    await screen.findByText(/Zapisano lub zakolejkowano 1 rekordów/);
    expect(useSyncStore.getState().records?.filter(record => record.envelope.type === "transaction")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Importuj wybrane" }));
    await waitFor(() => expect(useSyncStore.getState().snapshot?.totalValue).toBe(1010));
    expect(saveRecord).toHaveBeenCalledTimes(3);
  });
});
