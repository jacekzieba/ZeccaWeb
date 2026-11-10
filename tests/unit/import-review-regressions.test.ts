import { describe, expect, it } from "vitest";
import { createImportReview, evaluateImportReview, changeImportReview, reviewFields, reviewProblemCount } from "@/features/import/import-review";
import { buildImportReferenceData } from "@/features/import/import-parser";
import { makeRecord } from "./helpers/records";
const portfolioID = "11111111-1111-4111-8111-111111111111";
const context = { portfolioID, references: buildImportReferenceData([makeRecord("account", portfolioID, { id: portfolioID, recordType: "account", name: "Review" })]) };
const header = ["Type", "Instrument", "Ticker", "Time", "Amount", "ID", "Comment"];
const row = ["Deposit", "", "", "45569", "100", "same", ""];
const csvID = "22222222-2222-4222-8222-222222222222";

describe("source review regressions", () => {
  it("edits the amount, date, currency and fee from supported CSV aliases", () => {
    const initial = evaluateImportReview(createImportReview("generic", [["data", "type", "amount", "currencycode", "fee"], ["bad-date", "interest", "-10", "?", "-1"]], "aliases"), context);
    const fields = reviewFields(initial.review, initial.review.rows[0]);
    const values = Object.fromEntries([["Data", "2024-10-04"], ["Kwota", "10"], ["Waluta", "PLN"], ["Prowizja", "0"]].map(([label, value]) => {
      const field = fields.find(field => field.label === label);
      expect(field, label).toBeDefined();
      return [field!.key, value];
    }));
    const edited = evaluateImportReview(changeImportReview(initial.review, "2", values), context);
    expect(reviewProblemCount(edited.review)).toBe(0);
    expect(edited.validRows[0].payload).toMatchObject({ grossAmount: 10, currency: "PLN", fees: 0 });
  });
  it.each([
    { format: "xtb" as const, table: [header, row, row], count: 1 },
    { format: "generic" as const, table: [["date", "type", "gross_amount", "currency", "transaction_id"], ["2024-10-04", "interest", "10", "PLN", csvID], ["2024-10-04", "interest", "10", "PLN", csvID]], count: 1 },
    { format: "generic" as const, table: [["date", "type", "gross_amount", "currency", "transaction_id", "external_import_id"], ["2024-10-04", "interest", "10", "PLN", "", "broker:interest"], ["2024-10-04", "interest", "10", "PLN", "", "broker:interest"]], count: 1 },
    { format: "pko" as const, table: [["DATA DYSPOZYCJI", "RODZAJ DYSPOZYCJI", "KOD OBLIGACJI", "NR ZAPISU", "SERIA", "LICZBA OBLIGACJI", "KWOTA OPERACJI", "STATUS"], ["2024-10-04", "zakup papierów", "EDO0432", "123", "432", "2", "200", "zrealizowana"], ["2024-10-04", "zakup papierów", "EDO0432", "123", "432", "2", "200", "zrealizowana"]], count: 2 },
  ])("classifies identical $format rows with a source ID as duplicates", ({ format, table, count }) => {
    const result = evaluateImportReview(createImportReview(format, table, "duplicate"), context);
    expect(reviewProblemCount(result.review)).toBe(0);
    expect(result.review.rows.filter(row => row.duplicate)).toHaveLength(1);
    expect(result.validRows).toHaveLength(count);
  });
  it("rebuilds a long history and keeps the edited source mapped to one transaction", () => {
    const table = [header, ...Array.from({ length: 8000 }, (_, index) => ["Deposit", "", "", "45569", "10", String(index + 1), ""])];
    const initial = evaluateImportReview(createImportReview("xtb", table, "large"), context);
    const edited = evaluateImportReview(changeImportReview(initial.review, "8001", { amount: "20" }), context);
    expect(reviewProblemCount(edited.review)).toBe(0);
    expect(edited.validRows).toHaveLength(8000);
    expect(new Set(edited.validRows.map(row => row.payload!.id)).size).toBe(8000);
    expect(edited.validRows.reduce((sum, row) => sum + Number(row.payload!.grossAmount), 0)).toBe(80010);
  });
  it("repairs repeated invalid source once and still blocks conflicting amounts", () => {
    const invalid = ["Free funds interest", "", "", "45569", "-10", "same", ""];
    const initial = evaluateImportReview(createImportReview("xtb", [header, invalid, invalid], "repair"), context);
    expect(reviewProblemCount(initial.review)).toBe(1);
    const edited = evaluateImportReview(changeImportReview(initial.review, "2", { amount: "10" }), context);
    expect(reviewProblemCount(edited.review)).toBe(0);
    expect(edited.validRows).toHaveLength(1);
    const conflicting = evaluateImportReview(createImportReview("xtb", [header, row, ["Deposit", "", "", "45569", "200", "same", ""]], "conflict"), context);
    expect(reviewProblemCount(conflicting.review)).toBeGreaterThan(0);
  });
});
