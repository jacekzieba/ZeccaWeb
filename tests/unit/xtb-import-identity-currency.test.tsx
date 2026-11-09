import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ImportPage } from "@/features/import/import-page";
import { useSyncStore } from "@/sync/store/sync-store";
import { saveRecord } from "@/sync/records/record-writer";
import { makeRecord } from "./helpers/records";

vi.mock("@/sync/records/record-writer", () => ({ saveRecord: vi.fn().mockResolvedValue({ queued: false }) }));
vi.mock("@/lib/env", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/env")>(), isFakeSyncEnabled: () => false }));
vi.mock("@/features/import/etf-catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/import/etf-catalog")>();
  return { ...actual, loadEtfCatalog: vi.fn().mockResolvedValue(actual.buildEtfCatalog([])) };
});
vi.mock("@/features/import/read-spreadsheet", () => ({ readSpreadsheet: vi.fn().mockResolvedValue([
  ["ID", "Type", "Time", "Ticker", "Instrument", "Comment", "Amount"],
  [1, "Deposit", 45569.5, "", "", "Deposit", 1000],
  [2, "Stock purchase", 45569.5, "VWRL.NL", "Vanguard", "OPEN BUY 1 @ 10", -40],
  [3, "Dividend", 45569.6, "VWRL.NL", "Vanguard", "VWRL.NL USD 0.0100/ SHR", 0.01],
  [4, "Dividend", 45569.7, "VWRL.NL", "Vanguard", "corr VWRL.NL USD 0.0100/ SHR", -0.01],
]) }));
beforeEach(() => { vi.stubGlobal("crypto", webcrypto); });
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe("XTB import identity currency", () => {
  it("changes only trade currency when the user confirms a different listing currency", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    useSyncStore.setState({ records: [makeRecord("account", id, { id, recordType: "account", name: "XTB", baseCurrency: "PLN" })], userDataKey: {} as CryptoKey, supabase: {} as never, publicDemo: false, setSync: vi.fn() });
    const { container } = render(<ImportPage />);
    fireEvent.click(screen.getByRole("button", { name: /^XTB / }));
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(["dummy"], "report.xlsx")] } });
    const currency = await screen.findByLabelText("Waluta rozliczenia: VWRL.NL");
    expect((currency as HTMLInputElement).value).toBe("EUR");
    fireEvent.change(currency, { target: { value: "USD" } });
    fireEvent.change(screen.getByLabelText("ISIN: VWRL.NL"), { target: { value: "IE00B3RBWM25" } });
    fireEvent.change(screen.getByLabelText("Giełda / listing: VWRL.NL"), { target: { value: "LSE" } });
    fireEvent.change(screen.getByLabelText("Ticker notowania: VWRL.NL"), { target: { value: "VWRL.L" } });
    fireEvent.click(screen.getByLabelText("Potwierdzam tożsamość instrumentu i źródło jego notowań."));
    fireEvent.click(screen.getByRole("button", { name: /Importuj wybrane/ }));
    await waitFor(() => expect(vi.mocked(saveRecord).mock.calls).toHaveLength(5));
    const transactions = vi.mocked(saveRecord).mock.calls.map(call => call[3]).filter(payload => payload.recordType === "transaction");
    expect(transactions.find(tx => tx.transactionType === "buy")?.currency).toBe("USD");
    expect(transactions.find(tx => tx.transactionType === "dividend")?.currency).toBe("PLN");
    expect(transactions.find(tx => tx.externalImportID === "xtb:4")?.currency).toBe("PLN");
  });
});
