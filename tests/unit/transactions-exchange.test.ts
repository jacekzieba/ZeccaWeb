import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCsvImport, type ImportReferenceData } from "@/features/import/import-parser";
import { transactionsCsvLines } from "@/features/import/csv-export";
import { buildTransactionList } from "@/sync/records/investor-snapshot";
import { warsawCalendarDay } from "@/lib/calendar-date";
import expected from "../fixtures/native-golden/transactions_exchange.expected.json";
import { makeRecord } from "./helpers/records";

// Wymiana transakcji z aplikacją natywną przez plik CSV. Ten sam plik i te same
// oczekiwania czyta natywny TransactionCSVImporterTests (fixtura z repo Zecca).

const csv = readFileSync(resolve(__dirname, "../fixtures/native-golden/transactions_exchange.csv"), "utf8");
const APPLE_REFERENCE_DATE_UNIX_MS = Date.UTC(2001, 0, 1);

const references = (): ImportReferenceData => ({
  portfolios: [expected.portfolio],
  instruments: expected.knownInstruments,
  existingTransactionIds: new Set(),
  existingManualValuationIds: new Set(),
});

type Payload = Record<string, unknown>;

function day(seconds: unknown) {
  if (typeof seconds !== "number") return null;
  return warsawCalendarDay(new Date(APPLE_REFERENCE_DATE_UNIX_MS + seconds * 1000)).toISOString().slice(0, 10);
}

function comparable(payload: Payload) {
  return {
    id: payload.id,
    date: day(payload.date),
    bookingDate: day(payload.bookingDate),
    type: payload.transactionType,
    instrumentID: payload.instrumentID ?? null,
    quantity: payload.quantity ?? null,
    price: payload.price ?? null,
    grossAmount: payload.grossAmount,
    currency: payload.currency,
    fees: payload.fees,
    taxes: payload.taxes,
    fxRateToBase: payload.fxRateToBase ?? null,
    targetCurrency: payload.targetCurrency ?? null,
    targetGrossAmount: payload.targetGrossAmount ?? null,
    notes: payload.notes ?? "",
    externalImportID: payload.externalImportID ?? null,
  };
}

describe("wymiana transakcji CSV z aplikacją natywną", () => {
  it("wspólna fixtura: te same transakcje i te same odrzucone wiersze co w aplikacji", () => {
    const preview = parseCsvImport(csv, references());
    if (preview.kind !== "transaction") throw new Error("expected a transaction preview");

    expect(preview.validRows.map((row) => comparable(row.payload as Payload))).toEqual(expected.accepted);
    expect(preview.errorRows.map((row) => row.rowNumber)).toEqual(expected.rejectedRows);
    for (const row of preview.validRows) {
      expect((row.payload as Payload).portfolioID).toBe(expected.portfolio.id);
    }
  });

  it("eksport weba ma nagłówek wspólnego formatu i wraca z importu bez zmian", () => {
    const preview = parseCsvImport(csv, references());
    if (preview.kind !== "transaction") throw new Error("expected a transaction preview");
    const records = [
      makeRecord("account", expected.portfolio.id, { recordType: "account", ...expected.portfolio, baseCurrency: "PLN" }),
      ...expected.knownInstruments.map((instrument) =>
        makeRecord("asset", instrument.id, { recordType: "asset", kind: "etf", ...instrument }),
      ),
      ...preview.validRows.map((row) => makeRecord("transaction", String((row.payload as Payload).id), row.payload)),
    ];

    const exported = transactionsCsvLines(buildTransactionList(records));
    expect(exported[0]).toBe(csv.split("\n")[0]);

    const reimported = parseCsvImport(exported.join("\n"), references());
    if (reimported.kind !== "transaction") throw new Error("expected a transaction preview");
    expect(reimported.errorRows).toEqual([]);
    const byId = new Map(expected.accepted.map((row) => [row.id, row]));
    const rows = reimported.validRows.map((row) => comparable(row.payload as Payload));
    expect(rows).toHaveLength(expected.accepted.length);
    for (const row of rows) expect(row).toEqual(byId.get(String(row.id)));
  });

  it("transakcja z ID, które już jest w bazie, nie jest importowana drugi raz", () => {
    const preview = parseCsvImport(csv, {
      ...references(),
      existingTransactionIds: new Set(expected.accepted.map((row) => row.id)),
    });
    if (preview.kind !== "transaction") throw new Error("expected a transaction preview");

    expect(preview.validRows).toEqual([]);
  });
});
