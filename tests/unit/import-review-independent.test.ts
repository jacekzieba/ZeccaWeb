import { describe, expect, it } from "vitest";
import { createImportReview, evaluateImportReview, changeImportReview, reviewProblemCount, relatedReviewRows } from "@/features/import/import-review";
import { buildImportReferenceData, type ImportReferenceData } from "@/features/import/import-parser";
import { makeRecord } from "./helpers/records";
const portfolioID = "11111111-1111-4111-8111-111111111111";
const stockID = "22222222-2222-4222-8222-222222222222";
const account = makeRecord("account", portfolioID, { id: portfolioID, recordType: "account", name: "QA", baseCurrency: "PLN" });
const stock = makeRecord("asset", stockID, { id: stockID, recordType: "asset", kind: "stock", symbol: "ABC.PL", name: "ABC", currency: "PLN" });
const references = buildImportReferenceData([account, stock]);
const context = { portfolioID, references };
const pkoHeader = ["DATA DYSPOZYCJI", "RODZAJ DYSPOZYCJI", "KOD OBLIGACJI", "NR ZAPISU", "SERIA", "LICZBA OBLIGACJI", "KWOTA OPERACJI", "STATUS"];
const xtbHeader = ["Type", "Instrument", "Ticker", "Time", "Amount", "ID", "Comment"];
describe("independent source review", () => {
  it("excludes a PKO purchase together with its supporting disposition and synthetic funding", () => {
    const preview = evaluateImportReview(createImportReview("pko", [pkoHeader,
      ["2024-10-04", "dyspozycja zakupu", "EDO0432", "123", "432", "2", "200", "zrealizowana"],
      ["2024-10-04", "zakup papierów", "EDO0432", "123", "432", "2", "200", "zrealizowana"],
    ], "qa"), context);
    expect(preview.validRows).toHaveLength(2);
    const excluded = evaluateImportReview(changeImportReview(preview.review, "3", undefined, true), context);
    expect(excluded.validRows).toHaveLength(0);
    expect(reviewProblemCount(excluded.review)).toBe(0);
    const restored = evaluateImportReview(changeImportReview(excluded.review, "3", undefined, false), context);
    expect(restored.validRows.map(row => row.payload?.id)).toEqual(preview.validRows.map(row => row.payload?.id));
  });
  it.each([-1.9, 1.9])("retains normal PKO cost convention %s", amount => {
    const preview = evaluateImportReview(createImportReview("pko", [pkoHeader,
      ["2024-10-04", "naliczenie odsetek na 2024-10-04", "EDO0432", "0", "432", "0", "10", "zrealizowana"],
      ["2024-10-04", "podatek", "EDO0432", "0", "432", "0", String(amount), "zrealizowana"],
    ], "qa"), context);
    expect(reviewProblemCount(preview.review)).toBe(0);
    expect(preview.validRows[0]?.payload?.taxes).toBe(1.9);
    expect([...relatedReviewRows(preview.review, "2")].sort()).toEqual(["2", "3"]);
    const edited = evaluateImportReview(changeImportReview(preview.review, "3", { datadyspozycji: "2024-11-04" }), context);
    expect(reviewProblemCount(edited.review)).toBe(1);
  });
  it("keeps a valid CSV UUID and missing external ID unchanged", () => {
    const id = "33333333-3333-4333-8333-333333333333";
    const preview = evaluateImportReview(createImportReview("generic", [
      ["transaction_id", "date", "type", "portfolio_id", "gross_amount", "currency"],
      [id, "2024-10-04", "cashDeposit", portfolioID, "1000", "PLN"],
    ], "qa"), context);
    expect(reviewProblemCount(preview.review)).toBe(0);
    expect(preview.validRows[0]?.payload?.id).toBe(id);
    expect(preview.validRows[0]?.payload?.externalImportID).toBeUndefined();
  });
  it("does not infer a positive quantity from a negative PKO redemption quantity", () => {
    const initial = evaluateImportReview(createImportReview("pko", [pkoHeader,
      ["2024-10-05", "przedterminowy wykup", "EDO0432", "0", "432", "-1", "100", "zrealizowana"],
    ], "qa"), context);
    expect(reviewProblemCount(initial.review)).toBe(1);
    expect(initial.review.rows[0].issues.some(issue => issue.field === "liczbaobligacji")).toBe(true);
    const edited = evaluateImportReview(changeImportReview(initial.review, "2", { liczbaobligacji: "1" }), context);
    expect(reviewProblemCount(edited.review)).toBe(0);
    expect(edited.validRows[0]?.payload?.quantity).toBe(1);
  });
  it("preserves PKO legacy IDs when amount and source date are edited", () => {
    const initial = evaluateImportReview(createImportReview("pko", [pkoHeader,
      ["2024-10-04", "zakup papierów", "EDO0432", "0", "432", "2", "200", "zrealizowana"],
    ], "qa"), context);
    const edited = evaluateImportReview(changeImportReview(initial.review, "2", { kwotaoperacji: "300", datadyspozycji: "2024-10-05" }), context);
    expect(reviewProblemCount(edited.review)).toBe(0);
    expect(edited.validRows.map(row => row.payload?.externalImportID)).toEqual(initial.validRows.map(row => row.payload?.externalImportID));
    expect(edited.validRows.map(row => row.payload?.id)).toEqual(initial.validRows.map(row => row.payload?.id));
    expect(edited.validRows.map(row => row.payload?.grossAmount)).toEqual([300, 300]);
  });
  it("uses the same deterministic fallback identity as native after repairing an unreadable source", () => {
    const table = [xtbHeader, ["Deposit", "", "", "bad-date", "100", "", ""]];
    const initial = evaluateImportReview(createImportReview("xtb", table, "independent"), context);
    const edited = evaluateImportReview(changeImportReview(initial.review, "2", { time: "45569" }), context);
    expect(reviewProblemCount(edited.review)).toBe(0);
    expect(edited.validRows[0]?.payload?.externalImportID).toBe("import-review:xtb:independent:Cash Operations:2:cashDeposit:0");
    const existing: ImportReferenceData = { ...references, existingExternalImportIds: new Set(edited.validRows.map(row => String(row.payload?.externalImportID))) };
    const repeated = evaluateImportReview(createImportReview("xtb", table, "independent"), { portfolioID, references: existing });
    expect(reviewProblemCount(repeated.review)).toBe(0);
    expect(repeated.validRows).toHaveLength(0);
  });
  it("requires a decision for an unrecognized source label containing a known word", () => {
    const preview = evaluateImportReview(createImportReview("xtb", [xtbHeader,
      ["Unexpected dividend adjustment", "ABC", "ABC.PL", "45569", "-10", "1", ""],
    ], "qa"), context);
    expect(reviewProblemCount(preview.review)).toBe(1);
    expect(preview.review.rows[0].issues.some(issue => issue.code === "unsupported_type")).toBe(true);
  });
});
