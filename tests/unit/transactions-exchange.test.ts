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
    sourcePortfolioID: payload.sourcePortfolioID ?? null,
    transferKind: payload.transferKind ?? null,
    transferSourceKind: payload.transferSourceKind ?? null,
    contributionTreatment: payload.contributionTreatment ?? null,
    transferCostBasisMode: payload.transferCostBasisMode ?? null,
    transferLots: Array.isArray(payload.transferLots)
      ? (payload.transferLots as Payload[]).map((lot) => ({
          acquisitionDate: day(lot.acquisitionDate),
          quantity: lot.quantity,
          unitCost: lot.unitCost,
          currency: lot.currency,
          fxRateToBase: lot.fxRateToBase ?? null,
        }))
      : null,
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

  it("plik bez kolumn przeniesienia odrzuca przeniesienia, których znaczenia nie da się ustalić", () => {
    const legacy = [
      "date,portfolio,instrument,transactionType,quantity,price,grossAmount,currency,fees,taxes",
      "2026-05-19,Główny,,accountTransferIn,,,400,PLN,0,0",
      "2026-05-20,Główny,VWCE.DE,transferOut,1,100,100,EUR,0,0",
      "2026-05-21,Główny,,cashDeposit,,,1000,PLN,0,0",
    ].join("\n");

    const preview = parseCsvImport(legacy, references());
    if (preview.kind !== "transaction") throw new Error("expected a transaction preview");

    expect(preview.validRows.map((row) => (row.payload as Payload).transactionType)).toEqual(["cashDeposit"]);
    expect(preview.errorRows.map((row) => row.rowNumber)).toEqual([2, 3]);
  });

  it("instrumentu wymaga tylko przeniesienie aktywów, jak w natywnym TransactionValidator", () => {
    const file = [
      "date,portfolio,instrument,transactionType,quantity,price,grossAmount,currency,fees,taxes,transferKind",
      "2026-05-19,Główny,,transferIn,,,400,PLN,0,0,",
      "2026-05-20,Główny,,transferOut,,,150,PLN,0,0,cash",
      "2026-05-21,Główny,,accountTransferIn,,,300,PLN,0,0,cash",
      "2026-05-22,Główny,,accountTransferIn,2,90,180,PLN,0,0,asset",
      "2026-05-23,Główny,,transferOut,1,100,100,PLN,0,0,asset",
    ].join("\n");

    const preview = parseCsvImport(file, references());
    if (preview.kind !== "transaction") throw new Error("expected a transaction preview");

    expect(preview.validRows.map((row) => row.rowNumber)).toEqual([2, 3, 4]);
    expect(preview.errorRows.map((row) => [row.rowNumber, row.errors])).toEqual([
      [5, ["Ten typ transakcji wymaga instrumentu."]],
      [6, ["Ten typ transakcji wymaga instrumentu."]],
    ]);
  });
});
