import { describe, expect, it } from "vitest";
import {
  parseCsvImport,
  parseTransactionCsvImport,
  parseTransactionTable,
  type ImportReferenceData,
} from "@/features/import/import-parser";

const references: ImportReferenceData = {
  portfolios: [
    { id: "11111111-1111-4111-8111-111111111111", name: "IKE" },
  ],
  instruments: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      symbol: "AAPL",
      name: "Apple Inc.",
      currency: "USD",
    },
  ],
  existingTransactionIds: new Set(["33333333-3333-4333-8333-333333333333"]),
  existingManualValuationIds: new Set(),
};

describe("parseTransactionCsvImport", () => {
  it("parses valid transaction CSV rows into sync payloads", () => {
    const preview = parseTransactionCsvImport(
      [
        "date,portfolio,instrument,transactionType,quantity,price,grossAmount,currency,fees,taxes",
        "2026-05-17,IKE,AAPL,buy,2,190.5,381,USD,1,2",
        "18.05.2026,IKE,,cashDeposit,,,1000,PLN,0,0",
      ].join("\n"),
      references,
    );

    expect(preview.errorRows).toHaveLength(0);
    expect(preview.validRows).toHaveLength(2);
    expect(preview.validRows[0].payload).toMatchObject({
      recordType: "transaction",
      portfolioID: references.portfolios[0].id,
      instrumentID: references.instruments[0].id,
      transactionType: "buy",
      quantity: 2,
      price: 190.5,
      grossAmount: 381,
      currency: "USD",
      fees: 1,
      taxes: 2,
    });
    expect(preview.validRows[1].payload).toMatchObject({
      recordType: "transaction",
      transactionType: "cashDeposit",
      grossAmount: 1000,
      currency: "PLN",
    });
  });

  it("reports unresolved references and duplicate imported ids", () => {
    const preview = parseTransactionCsvImport(
      [
        "id;date;portfolio;instrument;transactionType;quantity;price;grossAmount;currency;fees;taxes",
        "33333333-3333-4333-8333-333333333333;2026-05-17;IKE;UNKNOWN;buy;2;190,5;381;USD;0;0",
      ].join("\n"),
      references,
    );

    expect(preview.validRows).toHaveLength(0);
    expect(preview.errorRows).toHaveLength(1);
    expect(preview.errorRows[0].errors).toEqual(
      expect.arrayContaining([
        "Transakcja o tym ID już istnieje.",
        "Nie znaleziono instrumentu.",
        "Ten typ transakcji wymaga instrumentu.",
      ]),
    );
  });

  it("flags a non-UUID id as a row error instead of throwing mid-import", () => {
    const preview = parseTransactionCsvImport(
      [
        "id,date,portfolio,transactionType,grossAmount,currency",
        "TX-001,2026-05-17,IKE,cashDeposit,100,PLN",
        ",2026-05-18,IKE,cashDeposit,200,PLN",
      ].join("\n"),
      references,
    );

    expect(preview.errorRows).toHaveLength(1);
    expect(preview.errorRows[0].errors).toContain(
      "Nieprawidłowe ID — wymagany format UUID.",
    );
    // The healthy row must still import.
    expect(preview.validRows).toHaveLength(1);
  });

  it("reports duplicate ids inside spreadsheet imports", () => {
    const duplicateId = "44444444-4444-4444-8444-444444444444";
    const preview = parseTransactionTable(
      [
        ["id", "date", "portfolio", "transactionType", "grossAmount", "currency"],
        [duplicateId, "2026-05-17", "IKE", "cashDeposit", "100", "PLN"],
        [duplicateId, "2026-05-18", "IKE", "cashDeposit", "200", "PLN"],
      ],
      references,
    );

    expect(preview.validRows).toHaveLength(1);
    expect(preview.errorRows).toHaveLength(1);
    expect(preview.errorRows[0].errors).toContain("Duplikat ID w importowanym pliku.");
  });
});

describe("parseCsvImport manual valuations", () => {
  it("parses statement totals into unit manual valuations", () => {
    const valuationReferences: ImportReferenceData = {
      ...references,
      instruments: [
        ...references.instruments,
        {
          id: "44444444-4444-4444-8444-444444444444",
          symbol: "ROS0229",
          name: "ROS0229",
          currency: "PLN",
        },
      ],
    };

    const preview = parseCsvImport(
      [
        "date,instrument,quantity,totalValue,currency,note",
        "2026-06-05,ROS0229,100,12390.00,PLN,PKO stan rachunku",
      ].join("\n"),
      valuationReferences,
    );

    expect(preview.kind).toBe("manualValuation");
    expect(preview.errorRows).toHaveLength(0);
    expect(preview.validRows[0].payload).toMatchObject({
      recordType: "manualValuation",
      instrumentID: "44444444-4444-4444-8444-444444444444",
      value: 123.9,
      currency: "PLN",
      note: "PKO stan rachunku",
    });
  });

  it("flags a non-UUID id as a row error", () => {
    const preview = parseCsvImport(
      [
        "id,date,instrument,value,currency",
        "WYC-1,2026-06-05,AAPL,190.5,USD",
      ].join("\n"),
      references,
    );

    expect(preview.kind).toBe("manualValuation");
    expect(preview.errorRows).toHaveLength(1);
    expect(preview.errorRows[0].errors).toContain(
      "Nieprawidłowe ID — wymagany format UUID.",
    );
  });
});

describe("import warning for a price-less instrument transaction", () => {
  it("says the transaction will not count towards results", () => {
    const preview = parseTransactionCsvImport(
      [
        "date,portfolio,instrument,transactionType,quantity,price,grossAmount,currency,fees,taxes",
        "2026-05-17,IKE,AAPL,buy,2,,381,USD,0,0",
      ].join("\n"),
      references,
    );

    // Import deliberately accepts this record, but both engines skip it, so the
    // old wording ("zostanie zapisana") was only half the story — the user had
    // no way to learn it contributes nothing until the snapshot silently
    // ignored it. The snapshot now also raises a `transaction-incomplete`
    // diagnostic; the two messages have to agree.
    expect(preview.errorRows).toHaveLength(0);
    expect(preview.validRows).toHaveLength(1);
    expect(preview.validRows[0].warnings.join(" ")).toContain("nie wliczy się do wyników");
  });
});
