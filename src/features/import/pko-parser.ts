/**
 * PKO Obligacje importer — parses the "Historia dyspozycji" XLS export from
 * zakup.obligacjeskarbowe.pl.
 *
 * read-excel-file returns rows as unknown[][], where the first row containing
 * "RODZAJ DYSPOZYCJI" is the header. Bond codes are resolved against known
 * instruments; unknown codes get provisional instruments created on the fly.
 */

import type { ImportReferenceData, TransactionImportPreview, TransactionImportRow } from "./import-parser";
import type { WriteRecordPayload } from "@/sync/records/record-writer";

const APPLE_REFERENCE_DATE_UNIX_MS = Date.UTC(2001, 0, 1);

function toSwiftSeconds(date: Date): number {
  return (date.getTime() - APPLE_REFERENCE_DATE_UNIX_MS) / 1000;
}

function parsePolishDate(s: string): Date | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  // "2024-03-15" or "15.03.2024"
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
  const dotted = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed);
  if (dotted) return new Date(Date.UTC(+dotted[3], +dotted[2] - 1, +dotted[1]));
  // Excel serial date
  const serial = parseFloat(trimmed);
  if (!isNaN(serial)) {
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + serial * 86_400_000);
  }
  return null;
}

function normalizeHeader(h: string) {
  return h.toUpperCase().trim().replace(/\s+/g, " ");
}

function parseNumber(v: unknown): number | null {
  if (typeof v === "number") return v;
  const s = String(v ?? "").replace(",", ".").trim();
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

function parseString(v: unknown): string {
  return String(v ?? "").trim();
}

type RowKind =
  | "buyDisposition"
  | "buyRealisation"
  | "redemptionDisposition"
  | "redemptionRealisation"
  | "interestRedemption"
  | "earlyRedemptionFee"
  | "tax"
  | "cashOut"
  | { interestAccrual: Date }
  | { unknown: string };

function classifyRow(raw: string): RowKind {
  const s = raw.toLowerCase().trim();
  if (s.startsWith("naliczenie odsetek")) {
    const m = /(\d{4}-\d{2}-\d{2})/.exec(s);
    if (m) {
      const d = parsePolishDate(m[1]);
      if (d) return { interestAccrual: d };
    }
    return { unknown: raw };
  }
  switch (s) {
    case "dyspozycja zakupu": return "buyDisposition";
    case "zakup papierów": return "buyRealisation";
    case "dyspozycja przedterminowego wykupu": return "redemptionDisposition";
    case "przedterminowy wykup": return "redemptionRealisation";
    case "odsetki": return "interestRedemption";
    case "opłata za przedterminowy wykup": return "earlyRedemptionFee";
    case "podatek": return "tax";
    case "wypłata przelewem": return "cashOut";
    default: return { unknown: raw };
  }
}

type ParsedRow = {
  sourceIndex: number;
  date: Date | null;
  kind: RowKind;
  code: string;
  nrZapisu: number;
  seria: number;
  liczba: number;
  kwota: number;
  cancelled: boolean;
};

export type PkoImportPreview = TransactionImportPreview & {
  newInstrumentPayloads: WriteRecordPayload[];
  warnings: string[];
};

export function parsePkoBondsXls(
  rows: unknown[][],
  portfolioId: string,
  references: ImportReferenceData,
): PkoImportPreview {
  if (rows.length < 2) {
    return { kind: "transaction", rows: [], validRows: [], errorRows: [], newInstrumentPayloads: [], warnings: [] };
  }

  // Find header row containing "RODZAJ DYSPOZYCJI"
  let headerRowIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].map((c) => normalizeHeader(parseString(c)));
    if (cells.includes("RODZAJ DYSPOZYCJI")) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx < 0) {
    const errRow: TransactionImportRow = {
      rowNumber: 1,
      values: {},
      payload: null,
      errors: ["Brak nagłówka — kolumna RODZAJ DYSPOZYCJI nie została znaleziona"],
      warnings: [],
    };
    return { kind: "transaction", rows: [errRow], validRows: [], errorRows: [errRow], newInstrumentPayloads: [], warnings: [] };
  }

  const headerCells = rows[headerRowIdx].map((c) => normalizeHeader(parseString(c)));
  const col = (name: string) => headerCells.indexOf(name);

  const cDate = col("DATA DYSPOZYCJI");
  const cType = col("RODZAJ DYSPOZYCJI");
  const cCode = col("KOD OBLIGACJI");
  const cNr = col("NR ZAPISU");
  const cSer = col("SERIA");
  const cQty = col("LICZBA OBLIGACJI");
  const cAmt = col("KWOTA OPERACJI");
  const cStat = col("STATUS");

  if ([cDate, cType, cCode, cNr, cSer, cQty, cAmt, cStat].some((c) => c < 0)) {
    const errRow: TransactionImportRow = {
      rowNumber: headerRowIdx + 1,
      values: {},
      payload: null,
      errors: ["Brak wymaganej kolumny (DATA DYSPOZYCJI, RODZAJ DYSPOZYCJI, KOD OBLIGACJI, NR ZAPISU, SERIA, LICZBA OBLIGACJI, KWOTA OPERACJI, STATUS)"],
      warnings: [],
    };
    return { kind: "transaction", rows: [errRow], validRows: [], errorRows: [errRow], newInstrumentPayloads: [], warnings: [] };
  }

  // Parse all rows into typed structs
  const parsedRows: ParsedRow[] = [];
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const cells = rows[i];
    const typeRaw = parseString(cells[cType]);
    if (!typeRaw) continue;

    parsedRows.push({
      sourceIndex: i + 1,
      date: parsePolishDate(parseString(cells[cDate])),
      kind: classifyRow(typeRaw),
      code: parseString(cells[cCode]),
      nrZapisu: parseNumber(cells[cNr]) ?? 0,
      seria: parseNumber(cells[cSer]) ?? 0,
      liczba: parseNumber(cells[cQty]) ?? 0,
      kwota: parseNumber(cells[cAmt]) ?? 0,
      cancelled: parseString(cells[cStat]).toLowerCase().includes("anulowan"),
    });
  }

  // Instrument resolver
  const instrumentCache = new Map<string, string>();
  const newInstrumentPayloads: WriteRecordPayload[] = [];

  function resolveOrCreateInstrument(code: string): string {
    const upper = code.toUpperCase();
    if (instrumentCache.has(upper)) return instrumentCache.get(upper)!;
    const known = references.instruments.find((i) => i.symbol.toUpperCase() === upper);
    if (known) {
      instrumentCache.set(upper, known.id);
      return known.id;
    }
    const newId = crypto.randomUUID();
    newInstrumentPayloads.push({
      id: newId,
      recordType: "asset",
      kind: "treasuryBond",
      symbol: upper,
      name: upper,
      currency: "PLN",
      exchange: null,
      country: "PL",
      isin: null,
      category: "govBondPL",
    });
    instrumentCache.set(upper, newId);
    return newId;
  }

  const warnings: string[] = [];
  const txRows: TransactionImportRow[] = [];

  // Which buy NR values have a realisation row (to skip disposition duplicates)
  const realisedBuyNr = new Set<number>();
  for (const r of parsedRows) {
    if (r.kind === "buyRealisation" && !r.cancelled && r.nrZapisu > 0) {
      realisedBuyNr.add(r.nrZapisu);
    }
  }

  type EmittedSell = { txIdx: number; date: Date; code: string };
  const pendingSells = new Map<string, EmittedSell[]>();

  type InterestSlot = { txIdx: number; code: string; date: Date };
  const interestSlots: InterestSlot[] = [];

  const consumedRow = new Set<number>();

  function makeBuy(r: ParsedRow): void {
    if (!r.date || r.liczba <= 0 || r.kwota <= 0) {
      warnings.push(`Wiersz ${r.sourceIndex}: zakup bez daty/ilości/kwoty — pominięto`);
      return;
    }
    const instrumentId = resolveOrCreateInstrument(r.code);
    const price = r.kwota / r.liczba;
    const depositId = crypto.randomUUID();
    const buyId = crypto.randomUUID();

    // Synthetic cash deposit (PKO doesn't list the funding transfer)
    txRows.push({
      rowNumber: r.sourceIndex,
      values: makeValues(r, "cashDeposit"),
      payload: {
        id: depositId,
        recordType: "transaction",
        date: toSwiftSeconds(r.date),
        portfolioID: portfolioId,
        transactionType: "cashDeposit",
        grossAmount: r.kwota,
        currency: "PLN",
        fees: 0,
        taxes: 0,
        note: `Wpłata na zakup obligacji ${r.code}`,
      },
      errors: [],
      warnings: [],
    });

    txRows.push({
      rowNumber: r.sourceIndex,
      values: makeValues(r, "buy"),
      payload: {
        id: buyId,
        recordType: "transaction",
        date: toSwiftSeconds(r.date),
        portfolioID: portfolioId,
        instrumentID: instrumentId,
        transactionType: "buy",
        quantity: r.liczba,
        price,
        grossAmount: r.kwota,
        currency: "PLN",
        fees: 0,
        taxes: 0,
        note: r.seria > 0 ? `Seria ${r.seria}` : "",
      },
      errors: [],
      warnings: [],
    });
  }

  for (let i = 0; i < parsedRows.length; i++) {
    if (consumedRow.has(i)) continue;
    const r = parsedRows[i];
    if (r.cancelled) continue;

    const kind = r.kind;

    if (kind === "buyDisposition") {
      if (r.nrZapisu > 0 && realisedBuyNr.has(r.nrZapisu)) continue;
      makeBuy(r);

    } else if (kind === "buyRealisation") {
      makeBuy(r);

    } else if (kind === "redemptionDisposition") {
      // skip — realisation row handles it

    } else if (kind === "redemptionRealisation") {
      if (!r.date || r.kwota <= 0) {
        warnings.push(`Wiersz ${r.sourceIndex}: wykup bez daty/kwoty — pominięto`);
        continue;
      }
      const qty = r.liczba > 0 ? r.liczba : r.kwota / 100;
      const instrumentId = resolveOrCreateInstrument(r.code);
      const txIdx = txRows.length;
      const id = crypto.randomUUID();
      txRows.push({
        rowNumber: r.sourceIndex,
        values: makeValues(r, "sell"),
        payload: {
          id,
          recordType: "transaction",
          date: toSwiftSeconds(r.date),
          portfolioID: portfolioId,
          instrumentID: instrumentId,
          transactionType: "sell",
          quantity: qty,
          price: 100.0,
          grossAmount: r.kwota,
          currency: "PLN",
          fees: 0,
          taxes: 0,
          note: `Przedterminowy wykup, seria ${r.seria}`,
        },
        errors: [],
        warnings: [],
      });
      const sells = pendingSells.get(r.code) ?? [];
      sells.push({ txIdx, date: r.date, code: r.code });
      pendingSells.set(r.code, sells);

    } else if (kind === "interestRedemption") {
      const sells = pendingSells.get(r.code);
      const parent = sells?.[0];
      if (!parent) {
        warnings.push(`Wiersz ${r.sourceIndex}: odsetki przy wykupie bez powiązanej sprzedaży — pominięto`);
        continue;
      }
      const instrumentId = resolveOrCreateInstrument(r.code);
      const txIdx = txRows.length;
      const id = crypto.randomUUID();
      txRows.push({
        rowNumber: r.sourceIndex,
        values: makeValues(r, "interest"),
        payload: {
          id,
          recordType: "transaction",
          date: toSwiftSeconds(parent.date),
          portfolioID: portfolioId,
          instrumentID: instrumentId,
          transactionType: "interest",
          grossAmount: r.kwota,
          currency: "PLN",
          fees: 0,
          taxes: 0,
          note: "Odsetki przy przedterminowym wykupie",
        },
        errors: [],
        warnings: [],
      });
      interestSlots.push({ txIdx, code: r.code, date: parent.date });

    } else if (kind === "earlyRedemptionFee") {
      const sells = pendingSells.get(r.code);
      const parent = sells?.[0];
      if (!parent) {
        warnings.push(`Wiersz ${r.sourceIndex}: opłata bez wykupu — pominięto`);
        continue;
      }
      // Attach fee to the sell tx
      const sellPayload = txRows[parent.txIdx].payload;
      if (sellPayload) {
        (sellPayload as Record<string, unknown>).fees = ((sellPayload as Record<string, unknown>).fees as number ?? 0) + Math.abs(r.kwota);
      }
      sells!.shift();
      if (sells!.length === 0) pendingSells.delete(r.code);
      else pendingSells.set(r.code, sells!);

    } else if (typeof kind === "object" && "interestAccrual" in kind) {
      if (r.kwota <= 0) continue;
      const instrumentId = resolveOrCreateInstrument(r.code);
      const txIdx = txRows.length;
      const id = crypto.randomUUID();
      txRows.push({
        rowNumber: r.sourceIndex,
        values: makeValues(r, "interest"),
        payload: {
          id,
          recordType: "transaction",
          date: toSwiftSeconds(kind.interestAccrual),
          portfolioID: portfolioId,
          instrumentID: instrumentId,
          transactionType: "interest",
          grossAmount: r.kwota,
          currency: "PLN",
          fees: 0,
          taxes: 0,
          note: `Odsetki, seria ${r.seria}`,
        },
        errors: [],
        warnings: [],
      });
      interestSlots.push({ txIdx, code: r.code, date: kind.interestAccrual });

    } else if (kind === "tax") {
      consumedRow.delete(i); // processed in second pass

    } else if (kind === "cashOut") {
      if (!r.date || r.kwota === 0) continue;
      const id = crypto.randomUUID();
      txRows.push({
        rowNumber: r.sourceIndex,
        values: makeValues(r, "cashWithdrawal"),
        payload: {
          id,
          recordType: "transaction",
          date: toSwiftSeconds(r.date),
          portfolioID: portfolioId,
          transactionType: "cashWithdrawal",
          grossAmount: Math.abs(r.kwota),
          currency: "PLN",
          fees: 0,
          taxes: 0,
          note: "Wypłata na rachunek bankowy",
        },
        errors: [],
        warnings: [],
      });

    } else if (typeof kind === "object" && "unknown" in kind) {
      warnings.push(`Wiersz ${r.sourceIndex}: nieznany typ "${kind.unknown}" — pominięto`);
    }
  }

  // Second pass: pair tax rows with preceding interest (within 14 days)
  const taxedSlot = new Set<number>();
  const oneDay = 86_400_000;
  for (let i = 0; i < parsedRows.length; i++) {
    const r = parsedRows[i];
    if (r.kind !== "tax" || r.cancelled || !r.date) continue;
    let bestSlotIdx: number | null = null;
    let bestDelta = Infinity;
    for (let s = 0; s < interestSlots.length; s++) {
      if (taxedSlot.has(s)) continue;
      const slot = interestSlots[s];
      if (slot.code !== r.code) continue;
      const delta = r.date.getTime() - slot.date.getTime();
      if (delta < -oneDay || delta > 14 * oneDay) continue;
      if (delta < bestDelta) {
        bestDelta = delta;
        bestSlotIdx = s;
      }
    }
    if (bestSlotIdx !== null) {
      const txPayload = txRows[interestSlots[bestSlotIdx].txIdx].payload;
      if (txPayload) {
        (txPayload as Record<string, unknown>).taxes = ((txPayload as Record<string, unknown>).taxes as number ?? 0) + Math.abs(r.kwota);
      }
      taxedSlot.add(bestSlotIdx);
    } else {
      warnings.push(`Wiersz ${r.sourceIndex}: podatek bez pary odsetek — pominięto`);
    }
  }

  return {
    kind: "transaction",
    rows: txRows,
    validRows: txRows.filter((row) => row.errors.length === 0 && row.payload !== null),
    errorRows: txRows.filter((row) => row.errors.length > 0),
    newInstrumentPayloads,
    warnings,
  };
}

function makeValues(r: ParsedRow, txType: string): Record<string, string> {
  return {
    date: r.date ? r.date.toISOString().slice(0, 10) : "",
    transactiontype: txType,
    instrument: r.code,
    grossamount: String(Math.abs(r.kwota)),
    currency: "PLN",
  };
}
