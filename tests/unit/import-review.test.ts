import { describe, expect, it } from "vitest";
import cases from "../fixtures/import-review/negative_amount_cases.json";
import { createImportReview, evaluateImportReview, changeImportReview, reviewProblemCount, reviewCashTotal, type ReviewFormat } from "@/features/import/import-review";
import { buildImportReferenceData } from "@/features/import/import-parser";
import { buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";
import { makeRecord } from "./helpers/records";
import type { RecordType } from "@/domain/models/investor-data";
const portfolioID = "11111111-1111-4111-8111-111111111111";
const assetID = "22222222-2222-4222-8222-222222222222";
const account = makeRecord("account", portfolioID, { id: portfolioID, recordType: "account", name: "Review", baseCurrency: "PLN" });
const asset = makeRecord("asset", assetID, { id: assetID, recordType: "asset", kind: "stock", symbol: "ABC.PL", name: "ABC", currency: "PLN" });
const context = { portfolioID, references: buildImportReferenceData([account, asset]) };
describe("source import review", () => {
  it.each(cases.cases)("$name matches the independent native cashflow anchors", testCase => {
    const format: ReviewFormat = testCase.broker === "pkoBonds" ? "pko" : testCase.broker === "transactionsCSV" ? "generic" : "xtb";
    let preview = evaluateImportReview(createImportReview(format, testCase.table, "shared-fixture-v1"), context);
    expect(preview.review.rows.filter(row => row.issues.length > 0).map(row => row.rowNumber)).toEqual(testCase.initialProblemRows);
    if (testCase.action) {
      const action = testCase.action as { rowID: string; values?: Record<string, string>; excluded?: boolean };
      preview = evaluateImportReview(changeImportReview(preview.review, action.rowID, action.values, action.excluded), context);
    }
    expect(reviewProblemCount(preview.review)).toBe(0);
    expect(preview.validRows.map(row => row.payload!.transactionType).sort()).toEqual(testCase.finalTypes);
    const records = [account, asset, ...preview.newInstrumentPayloads.map(payload => makeRecord("asset", payload.id, payload)), ...preview.validRows.map(row => makeRecord(row.payload!.recordType as RecordType, row.payload!.id, row.payload!))];
    const snapshot = buildInvestorDataSnapshot(records, { asOf: new Date("2027-01-15T00:00:00Z") });
    expect(snapshot.cash).toBeCloseTo(testCase.finalCashPLN, 6);
    expect(snapshot.cashflows.dividends + snapshot.cashflows.interest).toBeCloseTo(testCase.finalIncomePLN, 6);
    const repeated = evaluateImportReview(preview.review, { portfolioID, references: buildImportReferenceData(records) });
    expect(repeated.validRows).toHaveLength(0);
    expect(reviewProblemCount(repeated.review)).toBe(0);
  });
  it("requires a decision if editing a trade reparents its commission", () => {
    const table = [["Type", "Instrument", "Ticker", "Time", "Amount", "ID", "Comment"],
      ["Stock purchase", "ABC", "ABC.PL", "45569.5", "-100", "a", "OPEN BUY 1 @ 100"],
      ["Stock purchase", "ABC", "ABC.PL", "45569.501", "-100", "b", "OPEN BUY 1 @ 100"],
      ["Commission", "ABC", "ABC.PL", "45569.5", "-5", "c", ""]];
    const initial = evaluateImportReview(createImportReview("xtb", table, "reparent"), context);
    const edited = evaluateImportReview(changeImportReview(initial.review, "2", { time: "45570" }), context);
    expect(edited.review.rows.find(row => row.id === "4")?.issues.some(issue => issue.code === "changed_parent")).toBe(true);
  });
  it("recognizes repaired fallback identities when the original broken file is read again", () => {
    const table = [["Type", "Instrument", "Ticker", "Time", "Amount", "ID", "Comment"], ["Free funds interest", "", "", "bad-date", "10", "", ""]];
    const initial = evaluateImportReview(createImportReview("xtb", table, "same-file"), context);
    const repaired = evaluateImportReview(changeImportReview(initial.review, "2", { time: "45569" }), context);
    const records = [account, ...repaired.validRows.map(row => makeRecord("transaction", row.payload!.id, row.payload!))];
    const reimport = evaluateImportReview(createImportReview("xtb", table, "same-file"), { portfolioID, references: buildImportReferenceData(records) });
    expect(reviewProblemCount(reimport.review)).toBe(0);
    expect(reimport.validRows).toHaveLength(0);
    expect(reimport.review.rows[0].duplicate).toBe(true);
  });
  it("compares Total with the original source, while permitting explicit value edits", () => {
    const table = [["Type", "Instrument", "Ticker", "Time", "Amount", "ID", "Comment"],
      ["Deposit", "", "", "45569", "1000", "1", ""], ["Total", "", "", "", "1000", "", ""]];
    const original = evaluateImportReview(createImportReview("xtb", table, "total"), context);
    const edited = evaluateImportReview(changeImportReview(original.review, "2", { amount: "1100" }), context);
    expect(reviewProblemCount(edited.review)).toBe(0);
    expect(reviewCashTotal(edited.review, true)).toBe(1000);
    expect(reviewCashTotal(edited.review)).toBe(1100);
  });
  it("keeps an inconsistent original Total as a blocking integrity problem", () => {
    const table = [["Type", "Instrument", "Ticker", "Time", "Amount", "ID", "Comment"],
      ["Deposit", "", "", "45569", "1000", "1", ""], ["Total", "", "", "", "999", "", ""]];
    const reviewed = evaluateImportReview(createImportReview("xtb", table, "broken-total"), context);
    expect(reviewProblemCount(reviewed.review)).toBe(1);
  });

});
