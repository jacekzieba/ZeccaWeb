import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { parsePkoBondsXls } from "@/features/import/pko-parser";
import { buildImportReferenceData } from "@/features/import/import-parser";
import { selectedImportPayloads } from "@/features/import/import-selection";
import { enrichTreasuryBondParams } from "@/features/import/treasury-bond-enrichment";
import { parseBondEmissionLetter } from "@/market-data/providers/treasury-bond-params";
import { makeRecord } from "./helpers/records";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";
import type { RecordType } from "@/domain/models/investor-data";
import type { WriteRecordPayload } from "@/sync/records/record-writer";

const portfolioID = "11111111-1111-4111-8111-111111111111";
const header = ["DATA DYSPOZYCJI", "RODZAJ DYSPOZYCJI", "KOD OBLIGACJI", "NR ZAPISU", "SERIA", "LICZBA OBLIGACJI", "KWOTA OPERACJI", "STATUS"];
const buy = ["2023-12-11", "zakup papierów", "EDO1233", 1001, 11, 5, 500, "zrealizowana"];
const rows = [header, buy];
function parse(data = rows, records: DecryptedRecord[] = []) {
  return parsePkoBondsXls(data, portfolioID, buildImportReferenceData(records));
}
const params = JSON.parse(JSON.stringify(parseBondEmissionLetter(
  readFileSync(resolve(process.cwd(), "tests/fixtures/bond-pages/EDO1233.html"), "utf8"), "EDO1233",
))) as Record<string, unknown>;
const ids = (preview: ReturnType<typeof parse>) => new Set(preview.validRows.map(row => row.payload!.id));
const record = (payload: WriteRecordPayload) => makeRecord(payload.recordType as RecordType, payload.id, payload);

describe("PKO reimport safety", () => {
  it("repairs parameters only through an approved update while reimports add zero transactions", async () => {
    const first = await enrichTreasuryBondParams(parse(), [], vi.fn().mockResolvedValue(params));
    const oldAsset = { ...first.newInstrumentPayloads[0], bondParams: { ...first.newInstrumentPayloads[0].bondParams as object, firstPeriodRate: 1.5, parserVersion: 1 } };
    const records = [record(oldAsset), ...first.validRows.map(row => record(row.payload!))];
    const before = structuredClone(records);
    const txIDs = records.filter(r => r.envelope.type === "transaction").map(r => r.id);

    const reimport = await enrichTreasuryBondParams(parse(rows, records), records, vi.fn().mockResolvedValue(params));
    expect(reimport.validRows).toHaveLength(0);
    expect(reimport.newInstrumentPayloads).toHaveLength(0);
    expect(records).toEqual(before); // Cancelling preview cannot alter source records.
    const selected = selectedImportPayloads(reimport, new Set(), records);
    expect(selected.rows).toHaveLength(0);
    expect(selected.updatedInstrumentPayloads).toHaveLength(1);
    expect(selected.updatedInstrumentPayloads[0].id).toBe(oldAsset.id);
    expect(selected.updatedInstrumentPayloads[0].bondParams).toMatchObject({ firstPeriodRate: 7, parserVersion: 2 });

    const committed = records.map(r => r.id === oldAsset.id ? record(selected.updatedInstrumentPayloads[0]) : r);
    const third = await enrichTreasuryBondParams(parse(rows, committed), committed, vi.fn().mockResolvedValue(params));
    expect(third.validRows).toHaveLength(0);
    expect(third.newInstrumentPayloads).toHaveLength(0);
    expect(committed.filter(r => r.envelope.type === "transaction").map(r => r.id)).toEqual(txIDs);
    expect(third.updatedInstrumentPayloads).toHaveLength(0);
  });

  it("rechecks external IDs when an already prepared preview is committed again", async () => {
    const preview = await enrichTreasuryBondParams(parse(), [], vi.fn().mockResolvedValue(params));
    const first = selectedImportPayloads(preview, ids(preview), []);
    const records = [...first.newInstrumentPayloads, ...first.rows.map(row => row.payload!)].map(record);
    const second = selectedImportPayloads(preview, ids(preview), records);
    expect(second.rows).toHaveLength(0);
    expect(second.newInstrumentPayloads).toHaveLength(0);
  });

  it("remaps remaining rows to the same symbol arriving from native sync under another UUID", () => {
    const preview = parse([header, buy, [...buy.slice(0, 3), 1002, ...buy.slice(4)]]);
    const nativeID = "22222222-2222-4222-8222-222222222222";
    const firstPair = preview.validRows.slice(0, 2).map((row, index) => ({
      ...row.payload!, id: index === 0 ? "33333333-3333-4333-8333-333333333333" : "44444444-4444-4444-8444-444444444444",
      instrumentID: row.payload!.instrumentID ? nativeID : undefined,
    }));
    const records = [record({ ...preview.newInstrumentPayloads[0], id: nativeID }), ...firstPair.map(record)];
    const selected = selectedImportPayloads(preview, ids(preview), records);
    expect(selected.rows).toHaveLength(2);
    expect(selected.newInstrumentPayloads).toHaveLength(0);
    expect(selected.rows.find(row => row.payload!.transactionType === "buy")!.payload!.instrumentID).toBe(nativeID);
    expect(selected.updatedInstrumentPayloads).toHaveLength(0);
  });

  it("deduplicates repeated realisations but keeps different record numbers", () => {
    expect(parse([header, buy, buy]).validRows).toHaveLength(2);
    expect(parse([header, buy, [...buy.slice(0, 3), 1002, ...buy.slice(4)]]).validRows).toHaveLength(4);
  });

  it("preserves old values when refresh fails", async () => {
    const first = parse();
    const records = [record({ ...first.newInstrumentPayloads[0], bondParams: { ...params, firstPeriodRate: 1.5 } }), ...first.validRows.map(row => record(row.payload!))];
    const preview = await enrichTreasuryBondParams(parse(rows, records), records, vi.fn().mockRejectedValue(new Error("offline")));
    expect(preview.updatedInstrumentPayloads).toHaveLength(0);
    expect(preview.bondRefreshFailures).toEqual(["EDO1233"]);
    expect((records[0].envelope.payload as WriteRecordPayload).bondParams).toMatchObject({ firstPeriodRate: 1.5 });
  });
});
