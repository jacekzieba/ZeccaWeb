import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseXtbXlsx } from "@/features/import/xtb-parser";
import { readSpreadsheet } from "@/features/import/read-spreadsheet";
import { buildImportReferenceData, parseTransactionCsvImport } from "@/features/import/import-parser";
import { validateImportTransactions } from "@/features/import/import-identity-validation";
import { selectedImportPayloads } from "@/features/import/import-selection";
import { transactionsCsvLines } from "@/features/import/csv-export";
import { buildInvestorDataSnapshot, buildTransactionList } from "@/sync/records/investor-snapshot";
import type { WriteRecordPayload } from "@/sync/records/record-writer";
import type { RecordType } from "@/domain/models/investor-data";
import { makeRecord } from "./helpers/records";

const portfolioID = "11111111-1111-4111-8111-111111111111";
const account = makeRecord("account", portfolioID, { id: portfolioID, recordType: "account", name: "XTB", baseCurrency: "PLN" });
const record = (payload: WriteRecordPayload) => makeRecord(payload.recordType as RecordType, payload.id, payload);

describe("XTB dividend corrections", () => {
  it("reads the shared XLSX, validates and values the entire import, then deduplicates reimports", async () => {
    const bytes = readFileSync(resolve(__dirname, "../fixtures/native-golden/xtb_dividend_correction.xlsx"));
    const file = new File([bytes], "xtb_dividend_correction.xlsx");
    Object.assign(file, { arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
    const rows = await readSpreadsheet(file, { sheet: "Cash Operations" });
    const preview = parseXtbXlsx(rows, portfolioID, buildImportReferenceData([account]));
    expect(preview.validRows).toHaveLength(3);
    const correction = preview.validRows.find(row => row.payload?.externalImportID === "xtb:3")!.payload!;
    expect(correction).toMatchObject({ transactionType: "dividend", grossAmount: -0.01, currency: "PLN", notes: "corr NVDA.US USD 0.0100/ SHR" });
    expect(preview.validRows.filter(row => row.payload?.transactionType === "dividend")).toHaveLength(2);
    expect(validateImportTransactions(preview.validRows)).toEqual([]);

    const ids = new Set(preview.validRows.map(row => row.payload!.id));
    const selected = selectedImportPayloads(preview, ids, [account]);
    const records = [account, ...selected.newInstrumentPayloads.map(record), ...selected.rows.map(row => record(row.payload!))];
    const snapshot = buildInvestorDataSnapshot(records, { asOf: new Date("2024-10-05T12:00:00Z") });
    expect(snapshot.totalValue).toBeCloseTo(1000, 6);
    expect(snapshot.cashflows.dividends).toBeCloseTo(0, 6);
    expect(snapshot.netInvestedSeries.at(-1)?.value).toBeCloseTo(1000, 6);
    const repeatedCommit = selectedImportPayloads(preview, ids, records);
    expect(repeatedCommit.rows).toHaveLength(0);
    expect(repeatedCommit.newInstrumentPayloads).toHaveLength(0);
    const csv = transactionsCsvLines(buildTransactionList(records)).join("\n");
    const csvReimport = parseTransactionCsvImport(csv, buildImportReferenceData(records.filter(record => record.envelope.type !== "transaction")));
    expect(csvReimport.errorRows).toHaveLength(0);
    expect(csvReimport.validRows).toHaveLength(3);
    expect(csvReimport.validRows.find(row => row.payload?.externalImportID === "xtb:3")?.payload)
      .toMatchObject({ transactionType: "dividend", grossAmount: -0.01, currency: "PLN", notes: "corr NVDA.US USD 0.0100/ SHR" });
    const reimport = parseXtbXlsx(rows, portfolioID, buildImportReferenceData(records));
    expect(reimport.validRows).toHaveLength(0);
  });
});
