/**
 * XTB XLSX importer — parses the "Cash Operations" sheet from an XTB account
 * history export (Konto → Historia rachunku → Eksport).
 *
 * Returns a `TransactionImportPreview` in the same format as the generic CSV
 * parser, so it can be fed directly into the existing import UI and save flow.
 * Unknown instruments are provisionally created with generated UUIDs; the
 * payloads for those are collected in `preview.newInstrumentPayloads`.
 */

import type { ImportReferenceData, TransactionImportPreview, TransactionImportRow } from "./import-parser";
import type { WriteRecordPayload } from "@/sync/records/record-writer";

const APPLE_REFERENCE_DATE_UNIX_MS = Date.UTC(2001, 0, 1);

function toSwiftSeconds(date: Date): number {
  return (date.getTime() - APPLE_REFERENCE_DATE_UNIX_MS) / 1000;
}

// Excel serial date (days since 1899-12-30) → JS Date
function excelSerialToDate(serial: number): Date {
  const epoch = Date.UTC(1899, 11, 30);
  return new Date(epoch + serial * 86_400_000);
}

function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

type CashRow = {
  rowIndex: number;
  type: string;       // lowercased
  typeRaw: string;
  ticker: string;
  instrumentName: string;
  date: Date;
  amount: number;
  externalId: string | null;  // already prefixed "xtb:"
  comment: string;
};

type ParsedTrade = {
  quantity: number;
  price: number;
};

function parseTradeComment(comment: string): ParsedTrade | null {
  const m = /(?:open|close)\s+(?:buy|sell)\s+([\d.]+)(?:\/[\d.]+)?\s*@\s*([\d.]+)/i.exec(comment);
  if (!m) return null;
  const quantity = parseFloat(m[1]);
  const price = parseFloat(m[2]);
  if (!quantity || !price) return null;
  return { quantity, price };
}

function guessKind(ticker: string): string {
  const upper = ticker.toUpperCase();
  if (upper.includes(".") && /\.(UK|US|NL|DE|FR|IT|ES|PL|IE)$/.test(upper)) return "etf";
  if (/^[A-Z]{2}\d{4}$/.test(upper) || /^RO[SD]\d{4}$/.test(upper)) return "treasuryBond";
  return "etf";
}

export type XtbImportPreview = TransactionImportPreview & {
  newInstrumentPayloads: WriteRecordPayload[];
  warnings: string[];
};

export function parseXtbXlsx(
  rows: unknown[][],
  portfolioId: string,
  references: ImportReferenceData,
): XtbImportPreview {
  if (rows.length < 2) {
    return { kind: "transaction", rows: [], validRows: [], errorRows: [], newInstrumentPayloads: [], warnings: [] };
  }

  // Find the header row (contains "Type")
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cells = rows[i].map((c) => String(c ?? "").trim());
    if (cells.some((c) => c === "Type")) {
      headerRowIdx = i;
      break;
    }
  }

  const headerCells = rows[headerRowIdx].map((c) => String(c ?? "").trim());
  const col = (name: string) => headerCells.findIndex((h) => normalizeHeader(h) === normalizeHeader(name));

  const typeCol = col("Type");
  const timeCol = col("Time");
  const amountCol = col("Amount");
  const idCol = col("ID");
  const commentCol = col("Comment");
  const tickerCol = col("Ticker");
  const instrumentCol = col("Instrument");

  if (typeCol < 0 || timeCol < 0 || amountCol < 0) {
    return {
      kind: "transaction",
      rows: [{ rowNumber: 1, values: {}, payload: null, errors: ["Brak wymaganych kolumn: Type, Time, Amount"], warnings: [] }],
      validRows: [],
      errorRows: [{ rowNumber: 1, values: {}, payload: null, errors: ["Brak wymaganych kolumn: Type, Time, Amount"], warnings: [] }],
      newInstrumentPayloads: [],
      warnings: [],
    };
  }

  const warnings: string[] = [];

  // Parse raw rows
  const cashRows: CashRow[] = [];
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const cells = rows[i];
    const typeRaw = String(cells[typeCol] ?? "").trim();
    if (!typeRaw || typeRaw.toLowerCase() === "total") continue;

    const timeRaw = cells[timeCol];
    let date: Date;
    if (typeof timeRaw === "number") {
      date = excelSerialToDate(timeRaw);
    } else {
      date = new Date(String(timeRaw ?? ""));
    }
    if (isNaN(date.getTime())) {
      warnings.push(`Wiersz ${i + 1}: brak poprawnej daty — pominięto`);
      continue;
    }

    const amountRaw = cells[amountCol];
    const amount = typeof amountRaw === "number" ? amountRaw : parseFloat(String(amountRaw ?? "").replace(",", "."));
    if (!isFinite(amount)) continue;

    const rawId = idCol >= 0 ? String(cells[idCol] ?? "").trim() : "";
    const externalId = rawId ? `xtb:${rawId}` : null;
    const comment = commentCol >= 0 ? String(cells[commentCol] ?? "").trim() : "";
    const ticker = tickerCol >= 0 ? String(cells[tickerCol] ?? "").trim() : "";
    const instrumentName = instrumentCol >= 0 ? String(cells[instrumentCol] ?? "").trim() : "";

    cashRows.push({
      rowIndex: i + 1,
      type: typeRaw.toLowerCase(),
      typeRaw,
      ticker,
      instrumentName,
      date,
      amount,
      externalId,
      comment,
    });
  }

  // Pre-index commission rows by ticker for pairing with trades
  const commissionsByTicker = new Map<string, { idx: number; date: Date; amount: number }[]>();
  for (let i = 0; i < cashRows.length; i++) {
    const r = cashRows[i];
    if (r.type.includes("commission")) {
      const key = r.ticker.toUpperCase();
      const arr = commissionsByTicker.get(key) ?? [];
      arr.push({ idx: i, date: r.date, amount: r.amount });
      commissionsByTicker.set(key, arr);
    }
  }
  const consumedCommission = new Set<number>();

  // Pre-index interest tax rows by day for pairing with interest income
  const taxesByDay = new Map<string, { idx: number; amount: number }[]>();
  for (let i = 0; i < cashRows.length; i++) {
    const r = cashRows[i];
    if (r.type.includes("free funds interest tax") || r.type.includes("free-funds interest tax")) {
      const dayKey = r.date.toISOString().slice(0, 10);
      const arr = taxesByDay.get(dayKey) ?? [];
      arr.push({ idx: i, amount: r.amount });
      taxesByDay.set(dayKey, arr);
    }
  }
  const consumedTax = new Set<number>();

  // Instrument resolver — tries known instruments first, falls back to creating new ones
  const instrumentCache = new Map<string, string>(); // ticker → instrumentID
  const newInstrumentPayloads: WriteRecordPayload[] = [];

  function resolveOrCreateInstrument(ticker: string, name: string): string {
    const upper = ticker.toUpperCase();
    if (instrumentCache.has(upper)) return instrumentCache.get(upper)!;

    // Try known instruments (exact match, then base ticker without exchange suffix)
    const base = upper.split(".")[0];
    const known =
      references.instruments.find((i) => i.symbol.toUpperCase() === upper) ??
      references.instruments.find((i) => i.symbol.toUpperCase() === base);
    if (known) {
      instrumentCache.set(upper, known.id);
      return known.id;
    }

    // Create a new provisional instrument
    const newId = crypto.randomUUID();
    const kind = guessKind(upper);
    const exchange = upper.includes(".") ? upper.split(".").pop() : undefined;
    newInstrumentPayloads.push({
      id: newId,
      recordType: "asset",
      kind,
      symbol: upper,
      name: name || upper,
      currency: "?",
      exchange: exchange ?? null,
      country: null,
      isin: null,
      category: null,
    });
    instrumentCache.set(upper, newId);
    return newId;
  }

  const txRows: TransactionImportRow[] = [];

  for (let i = 0; i < cashRows.length; i++) {
    const r = cashRows[i];
    if (consumedCommission.has(i) || consumedTax.has(i)) continue;

    const t = r.type;

    if (t.includes("stock purchase") || t.includes("stock sell") || t.includes("stock sale")) {
      const isSell = t.includes("stock sell") || t.includes("stock sale");
      if (!r.ticker) {
        warnings.push(`Wiersz ${r.rowIndex}: ${r.typeRaw} bez tickera — pominięto`);
        continue;
      }
      const parsed = parseTradeComment(r.comment);
      if (!parsed) {
        warnings.push(`Wiersz ${r.rowIndex}: nie rozpoznano komentarza "${r.comment}" — pominięto`);
        continue;
      }

      const instrumentId = resolveOrCreateInstrument(r.ticker, r.instrumentName);
      const tickerKey = r.ticker.toUpperCase();

      // Attach nearest commission within 5 minutes
      let feesInPLN = 0;
      const commCandidates = commissionsByTicker.get(tickerKey) ?? [];
      const window5m = 5 * 60 * 1000;
      let bestCommIdx: number | null = null;
      let bestCommDelta = Infinity;
      for (const c of commCandidates) {
        if (consumedCommission.has(c.idx)) continue;
        const delta = Math.abs(c.date.getTime() - r.date.getTime());
        if (delta <= window5m && delta < bestCommDelta) {
          bestCommDelta = delta;
          bestCommIdx = c.idx;
          feesInPLN = Math.abs(c.amount);
        }
      }
      if (bestCommIdx !== null) consumedCommission.add(bestCommIdx);

      const grossAmount = parsed.quantity * parsed.price;
      const id = crypto.randomUUID();
      const payload = {
        id,
        recordType: "transaction",
        date: toSwiftSeconds(r.date),
        portfolioID: portfolioId,
        instrumentID: instrumentId,
        transactionType: isSell ? "sell" : "buy",
        quantity: parsed.quantity,
        price: parsed.price,
        grossAmount,
        currency: "PLN",
        fees: feesInPLN,
        taxes: 0,
        ...(r.externalId ? { externalImportID: r.externalId } : {}),
        note: r.comment,
      };
      txRows.push({ rowNumber: r.rowIndex, values: rowValues(r), payload, errors: [], warnings: [] });

    } else if (t.includes("dividend")) {
      if (!r.ticker) continue;
      const instrumentId = resolveOrCreateInstrument(r.ticker, r.instrumentName);
      const id = crypto.randomUUID();
      const payload = {
        id,
        recordType: "transaction",
        date: toSwiftSeconds(r.date),
        portfolioID: portfolioId,
        instrumentID: instrumentId,
        transactionType: "dividend",
        grossAmount: r.amount,
        currency: "PLN",
        fees: 0,
        taxes: 0,
        ...(r.externalId ? { externalImportID: r.externalId } : {}),
      };
      txRows.push({ rowNumber: r.rowIndex, values: rowValues(r), payload, errors: [], warnings: [] });

    } else if ((t.includes("free funds interest") || t.includes("free-funds interest")) && !t.includes("tax")) {
      // Pair with same-day tax
      const dayKey = r.date.toISOString().slice(0, 10);
      let taxAmount = 0;
      const taxCandidates = taxesByDay.get(dayKey) ?? [];
      const firstUnconsumed = taxCandidates.find((c) => !consumedTax.has(c.idx));
      if (firstUnconsumed) {
        taxAmount = Math.abs(firstUnconsumed.amount);
        consumedTax.add(firstUnconsumed.idx);
      }
      const id = crypto.randomUUID();
      const payload = {
        id,
        recordType: "transaction",
        date: toSwiftSeconds(r.date),
        portfolioID: portfolioId,
        transactionType: "interest",
        grossAmount: r.amount,
        currency: "PLN",
        fees: 0,
        taxes: taxAmount,
        ...(r.externalId ? { externalImportID: r.externalId } : {}),
      };
      txRows.push({ rowNumber: r.rowIndex, values: rowValues(r), payload, errors: [], warnings: [] });

    } else if (t.includes("deposit") || t.includes("withdrawal") || t.includes("transfer")) {
      const isOutgoing = r.amount < 0 || t.includes("withdrawal");
      const id = crypto.randomUUID();
      const payload = {
        id,
        recordType: "transaction",
        date: toSwiftSeconds(r.date),
        portfolioID: portfolioId,
        transactionType: isOutgoing ? "cashWithdrawal" : "cashDeposit",
        grossAmount: Math.abs(r.amount),
        currency: "PLN",
        fees: 0,
        taxes: 0,
        ...(r.externalId ? { externalImportID: r.externalId } : {}),
      };
      txRows.push({ rowNumber: r.rowIndex, values: rowValues(r), payload, errors: [], warnings: [] });

    } else if (t.includes("commission")) {
      warnings.push(`Wiersz ${r.rowIndex}: Commission ${r.ticker} bez dopasowanej transakcji — pominięto`);

    } else if (t.includes("close trade") || t.includes("free funds interest tax") || t.includes("free-funds interest tax")) {
      // consumed via pairing or irrelevant

    } else {
      warnings.push(`Wiersz ${r.rowIndex}: nieznany typ "${r.typeRaw}" — pominięto`);
    }
  }

  return {
    kind: "transaction",
    rows: txRows,
    validRows: txRows.filter((row) => row.errors.length === 0 && row.payload),
    errorRows: txRows.filter((row) => row.errors.length > 0),
    newInstrumentPayloads,
    warnings,
  };
}

function rowValues(r: CashRow): Record<string, string> {
  return {
    date: r.date.toISOString().slice(0, 10),
    transactiontype: r.type,
    instrument: r.ticker,
    grossamount: String(Math.abs(r.amount)),
    currency: "PLN",
  };
}
