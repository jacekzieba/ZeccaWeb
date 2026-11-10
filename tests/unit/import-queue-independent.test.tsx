import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ImportPage } from "@/features/import/import-page";
import { parsePkoBondsXls } from "@/features/import/pko-parser";
import { buildImportReferenceData } from "@/features/import/import-parser";
import { parseBondEmissionLetter } from "@/market-data/providers/treasury-bond-params";
import { useSyncStore } from "@/sync/store/sync-store";
import { saveRecord } from "@/sync/records/record-writer";
import { makeRecord } from "./helpers/records";

vi.mock("@/sync/records/record-writer", () => ({ saveRecord: vi.fn() }));
vi.mock("@/lib/env", async original => ({ ...await original<typeof import("@/lib/env")>(), isFakeSyncEnabled: () => false }));
vi.mock("@/features/import/read-spreadsheet", () => ({ readSpreadsheet: vi.fn().mockResolvedValue([
  ["DATA DYSPOZYCJI", "RODZAJ DYSPOZYCJI", "KOD OBLIGACJI", "NR ZAPISU", "SERIA", "LICZBA OBLIGACJI", "KWOTA OPERACJI", "STATUS"],
  ["2023-12-11", "zakup papierów", "EDO1233", 1001, 11, 5, 500, "zrealizowana"],
]) }));

const table = [
  ["DATA DYSPOZYCJI", "RODZAJ DYSPOZYCJI", "KOD OBLIGACJI", "NR ZAPISU", "SERIA", "LICZBA OBLIGACJI", "KWOTA OPERACJI", "STATUS"],
  ["2023-12-11", "zakup papierów", "EDO1233", 1001, 11, 5, 500, "zrealizowana"],
];
const id = "11111111-1111-4111-8111-111111111111";
const params = JSON.parse(JSON.stringify(parseBondEmissionLetter(
  readFileSync(resolve(process.cwd(), "tests/fixtures/bond-pages/EDO1233.html"), "utf8"), "EDO1233",
))) as Record<string, unknown>;
const originalState = useSyncStore.getState();
let assetID: string;

beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: params }) }));
  vi.mocked(saveRecord).mockReset();
  const account = makeRecord("account", id, { id, recordType: "account", name: "Existing bond", baseCurrency: "PLN" });
  const first = parsePkoBondsXls(table, id, buildImportReferenceData([account]));
  const asset = { ...first.newInstrumentPayloads[0], name: "My existing bond", bondParams: { ...params, firstPeriodRate: 1.5, parserVersion: 1 } };
  assetID = asset.id;
  useSyncStore.setState({
    ...originalState,
    records: [account, makeRecord("asset", asset.id, asset), ...first.validRows.map(row => makeRecord("transaction", row.payload!.id, row.payload!))],
    userDataKey: {} as CryptoKey, supabase: {} as never, publicDemo: false,
  });
});
afterEach(() => { cleanup(); useSyncStore.setState(originalState); vi.unstubAllGlobals(); });

describe("existing bond update persistence status", () => {
  it.each([true, false])("reports a parameter-only update when queued=%s", async queued => {
    vi.mocked(saveRecord).mockResolvedValue({ queued });
    const { container } = render(<ImportPage />);
    fireEvent.click(screen.getByRole("button", { name: /^PKO Obligacje XLS/ }));
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(["existing-bond"], "existing.xls")] } });
    await screen.findByText("Aktualizacja parametrów istniejących emisji po zatwierdzeniu");
    fireEvent.click(screen.getByRole("button", { name: "Importuj wybrane" }));
    if (queued) {
      await screen.findByText(/Zaktualizowano 1 emisji.*Zapisano 0 rekordów, 1 czeka w kolejce sync/);
    } else {
      await screen.findByText(/Zaktualizowano 1 emisji.*Zaimportowano 0 rekordów/);
    }
    const records = useSyncStore.getState().records!;
    expect(records.filter(record => record.envelope.type === "transaction")).toHaveLength(2);
    expect(records.filter(record => record.envelope.type === "asset")).toHaveLength(1);
    expect(records.find(record => record.id === assetID)?.envelope.payload).toMatchObject({
      id: assetID, name: "My existing bond", bondParams: { firstPeriodRate: 7, parserVersion: 2 },
    });
    expect(saveRecord).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveRecord).mock.calls[0][2]).toBe("asset");
  });
});

