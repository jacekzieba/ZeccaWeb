import { parseXtbXlsx, parseTradeComment } from "./xtb-parser";
import { parsePkoBondsXls } from "./pko-parser";
import { parseTransactionTable, type ImportReferenceData, type TransactionImportPreview, type TransactionImportRow } from "./import-parser";
import type { EtfCatalog } from "./etf-catalog";
import type { WriteRecordPayload } from "@/sync/records/record-writer";
import { validateTransactionPayload } from "@/sync/records/transaction-validator";
import { parseSpreadsheetNumber } from "@/lib/parse-amount";

export type ReviewFormat = "xtb" | "pko" | "generic";
export type ReviewIssue = { code: string; field: string; message: string };
export type ReviewRow = {
  id: string; rowNumber: number; originalValues: Record<string, string>; values: Record<string, string>;
  excluded: boolean; duplicate: boolean; parent?: number; issues: ReviewIssue[]; transactionIDs: string[];
};
export type ImportReviewDraft = {
  format: ReviewFormat; digest: string; sheet: string; headers: string[]; headerRow: number; rows: ReviewRow[];
  originalIDs: Record<string, string>; transactionIDs: Record<string, string>; assetIDs: Record<string, string>;
  instrumentOverrides: Record<string, Record<string, string>>; initialized: boolean;
  reportedTotal?: number;
};
export type ReviewedImport = TransactionImportPreview & {
  review: ImportReviewDraft; newInstrumentPayloads: WriteRecordPayload[]; sourceParents: Record<number, number>;
  warnings?: string[]; fxObservations?: { symbol: string; fxObserved: number; date: string }[]; referencedBondCodes?: string[];
};
type Parsed = TransactionImportPreview & Partial<Omit<ReviewedImport, keyof TransactionImportPreview | "review">>;
type Context = { portfolioID: string; references: ImportReferenceData; catalog?: EtfCatalog };
const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const text = (value: unknown, format: ReviewFormat) => value instanceof Date
  ? (format === "xtb" ? value.toISOString() : value.toISOString().slice(0, 10)) : String(value ?? "").trim();
const isTrade = (type: string) => /stock (purchase|sell|sale)/i.test(type);
const provider = (format: ReviewFormat) => format === "pko" ? "pko-bonds" : format === "generic" ? "transactions-csv" : "xtb";
export const reviewProblemCount = (draft: ImportReviewDraft) => draft.rows.filter(row => !row.excluded && !row.duplicate && row.issues.length > 0).length + (reviewIntegrityMessage(draft) ? 1 : 0);
export function reviewCashTotal(draft: ImportReviewDraft, original = false): number | null {
  if (draft.format !== "xtb") return null;
  const rows = original ? draft.rows : draft.rows.filter(row => !row.excluded && !row.duplicate);
  const amounts = rows.map(row => parseSpreadsheetNumber((original ? row.originalValues : row.values).amount));
  return amounts.every((value): value is number => value !== null) ? amounts.reduce((sum, value) => sum + value, 0) : null;
}
export function reviewIntegrityMessage(draft: ImportReviewDraft): string | null {
  const original = reviewCashTotal(draft, true);
  return draft.reportedTotal !== undefined && original !== null && Math.abs(original - draft.reportedTotal) > 0.01 ? "Oryginalna suma pozycji nie zgadza się z Total w pliku. Sprawdź kompletność i wybierz poprawny plik przed zapisem." : null;
}
export function reviewDateLabel(row: ReviewRow): string {
  const raw = row.values.time ?? row.values.date ?? row.values.datadyspozycji ?? "";
  return reviewDate(raw)?.toISOString().replace("T", " ").replace(".000Z", " UTC") ?? raw;
}
export const reviewAmount = (row: ReviewRow, original = false) => {
  const values = original ? row.originalValues : row.values;
  return values.amount ?? values.kwotaoperacji ?? values.grossamount ?? "—";
};
export const reviewTitle = (row: ReviewRow) => [row.values.type ?? row.values.transactiontype ?? row.values.rodzajdyspozycji ?? "Pozycja", row.values.ticker ?? row.values.kodobligacji ?? row.values.instrumentsymbol ?? row.values.instrument ?? ""].filter(Boolean).join(" · ");

export async function importFileDigest(file: File): Promise<string> {
  const bytes = typeof file.arrayBuffer === "function" ? await file.arrayBuffer() : await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export function createImportReview(format: ReviewFormat, table: unknown[][], digest: string): ImportReviewDraft {
  const index = table.findIndex(cells => {
    const keys = cells.map(cell => key(String(cell ?? "")));
    return format === "xtb" ? keys.includes("type") && keys.includes("time") : format === "pko" ? keys.includes("rodzajdyspozycji") : cells.some(cell => String(cell ?? "").trim());
  });
  if (index < 0) throw new Error("Brak nagłówka wymaganego przez format importu.");
  const headers = table[index].map(cell => key(String(cell ?? "")));
  const typeColumn = headers.indexOf("type"), amountColumn = headers.indexOf("amount");
  const total = format === "xtb" ? table.slice(index + 1).find(row => String(row[typeColumn] ?? "").toLowerCase() === "total") : undefined;
  const reportedTotal = total ? parseSpreadsheetNumber(total[amountColumn]) ?? undefined : undefined;
  const rows: ReviewRow[] = [];
  for (let i = index + 1; i < table.length; i++) {
    if (!table[i].some(cell => String(cell ?? "").trim())) continue;
    const values: Record<string, string> = {};
    headers.forEach((header, column) => { if (header) values[header] = text(table[i][column], format); });
    if (format === "xtb" && values.type?.toLowerCase() === "total") continue;
    if (format === "xtb") {
      const trade = parseTradeComment(values.comment ?? "");
      if (trade) { values.quantity = String(trade.quantity); values.price = String(trade.price); }
    }
    rows.push({ id: String(i + 1), rowNumber: i + 1, originalValues: { ...values }, values, excluded: false, duplicate: false, issues: [], transactionIDs: [] });
  }
  return { format, digest, sheet: format === "xtb" ? "Cash Operations" : format === "pko" ? "Historia dyspozycji" : "CSV", headers, headerRow: index + 1, rows, originalIDs: {}, transactionIDs: {}, assetIDs: {}, instrumentOverrides: {}, initialized: false, reportedTotal };
}

export function reviewFields(draft: ImportReviewDraft, row: ReviewRow): { key: string; label: string }[] {
  let fields: [string, string][];
  if (draft.format === "xtb") {
    fields = [["time", "Data i czas (ISO lub numer daty Excel)"], ["amount", "Kwota na rachunku (PLN)"], ["ticker", "Ticker instrumentu"], ["comment", "Opis operacji"]];
    if (isTrade(row.values.type ?? "")) fields.push(["quantity", "Ilość"], ["price", "Cena w walucie instrumentu"]);
  } else if (draft.format === "pko") {
    fields = [["datadyspozycji", "Data (RRRR-MM-DD)"], ["kwotaoperacji", "Kwota (PLN)"], ["liczbaobligacji", "Liczba obligacji"], ["kodobligacji", "Kod obligacji"]];
  } else {
    const labels: Record<string, string> = { date: "Data", bookingdate: "Data księgowania", type: "Typ", transactiontype: "Typ", instrument: "Instrument", instrumentsymbol: "Instrument", quantity: "Ilość", price: "Cena", grossamount: "Kwota", currency: "Waluta", fees: "Prowizja", taxes: "Podatek", fxratetobase: "Kurs do PLN", targetgrossamount: "Kwota docelowa", targetcurrency: "Waluta docelowa", notes: "Opis", transferlots: "Partie transferu (JSON)" };
    fields = Object.keys(labels).sort().filter(field => field in row.values || ["fees", "taxes", "quantity", "price", "fxratetobase"].includes(field)).map(field => [field, labels[field]]);
  }
  return fields.map(([key, label]) => ({ key, label }));
}

export function relatedReviewRows(draft: ImportReviewDraft, rowID: string): Set<string> {
  const related = new Set([rowID]);
  let changed = true;
  while (changed) {
    const before = related.size;
    draft.rows.forEach(row => { if (row.parent !== undefined && related.has(String(row.parent))) related.add(row.id); });
    changed = before !== related.size;
  }
  return related;
}

export function changeImportReview(draft: ImportReviewDraft, rowID: string, values?: Record<string, string>, excluded?: boolean): ImportReviewDraft {
  const related = relatedReviewRows(draft, rowID);
  return { ...draft, rows: draft.rows.map(row => {
    const next = { ...row, issues: [...row.issues], values: { ...row.values } };
    if (values && row.id === rowID) {
      const editable = new Set(reviewFields(draft, row).map(field => field.key));
      for (const [field, value] of Object.entries(values)) if (editable.has(field)) next.values[field] = value;
      if (draft.format === "xtb" && values.comment !== undefined && values.comment !== row.values.comment) {
        const trade = parseTradeComment(values.comment);
        if (trade) {
          if (values.quantity === undefined || values.quantity === row.values.quantity) next.values.quantity = String(trade.quantity);
          if (values.price === undefined || values.price === row.values.price) next.values.price = String(trade.price);
        }
      }
    }
    if (excluded !== undefined && related.has(row.id)) next.excluded = excluded;
    return next;
  }) };
}

function reviewDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const serial = Number(raw);
  if (Number.isFinite(serial) && serial >= 0 && serial < 3_000_000) return new Date((serial - 25569) * 86400000);
  const dotted = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(raw);
  if (dotted) return reviewDate(`${dotted[3]}-${dotted[2]}-${dotted[1]}`);
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw) && date.toISOString().slice(0, 10) !== raw) return null;
  return date;
}

function supporting(draft: ImportReviewDraft, row: ReviewRow): boolean {
  const v = row.values;
  if (draft.format === "pko") {
    if (v.status?.toLowerCase().includes("anulowan")) return true;
    const type = v.rodzajdyspozycji?.toLowerCase();
    if (type === "dyspozycja przedterminowego wykupu") return true;
    if (type === "dyspozycja zakupu" && draft.rows.some(other => !other.excluded && other.values.nrzapisu === v.nrzapisu && other.values.rodzajdyspozycji?.toLowerCase() === "zakup papierów")) return true;
    return ["podatek", "opłata za przedterminowy wykup"].includes(type ?? "") && parseSpreadsheetNumber(v.kwotaoperacji) === 0;
  }
  return draft.format === "xtb" && ["commission", "free funds interest tax", "free-funds interest tax", "close trade"].includes(v.type?.toLowerCase() ?? "") && parseSpreadsheetNumber(v.amount) === 0;
}

function rawIssues(draft: ImportReviewDraft, row: ReviewRow): ReviewIssue[] {
  if (supporting(draft, row)) return [];
  const v = row.values;
  const issues: ReviewIssue[] = [];
  const require = (condition: boolean, field: string, message: string) => { if (!condition) issues.push({ code: "invalid_value", field, message }); };
  if (draft.format === "xtb") {
    const type = (v.type ?? "").toLowerCase();
    const supported = ["stock purchase", "stock sell", "stock sale", "dividend", "commission", "free funds interest", "free-funds interest", "free funds interest tax", "free-funds interest tax", "deposit", "ike deposit", "withdrawal", "ike withdrawal", "transfer", "ike transfer", "close trade"];
    if (!supported.includes(type)) return [{ code: "unsupported_type", field: "type", message: `Nieobsługiwany typ operacji: ${v.type || "brak"}. Usuń pozycję z importu.` }];
    const amount = parseSpreadsheetNumber(v.amount);
    require(reviewDate(v.time) !== null, "time", "Brak poprawnej daty operacji.");
    require(amount !== null, "amount", "Kwota musi być poprawną, skończoną liczbą.");
    if (isTrade(type)) {
      const sell = /stock (sell|sale)/.test(type);
      if (amount !== null) require(sell ? amount > 0 : amount < 0, "amount", sell ? "Sprzedaż XTB wymaga dodatniego wpływu. Sprawdź, czy to korekta." : "Zakup XTB wymaga ujemnego wypływu. Sprawdź, czy to korekta.");
      require((parseSpreadsheetNumber(v.quantity) ?? 0) > 0, "quantity", "Brakuje dodatniej ilości z komentarza transakcji.");
      require((parseSpreadsheetNumber(v.price) ?? 0) > 0, "price", "Brakuje dodatniej ceny z komentarza transakcji.");
      require(Boolean(v.ticker), "ticker", "Brakuje tickera instrumentu.");
    } else if (type.includes("dividend")) {
      if (amount !== null) require(amount !== 0, "amount", "Kwota dywidendy musi być niezerowa.");
      require(Boolean(v.ticker), "ticker", "Brakuje tickera instrumentu.");
    } else if (/commission|interest tax/.test(type)) {
      if (amount !== null) require(amount <= 0, "amount", "Dodatnia kwota kosztu XTB może oznaczać zwrot. Popraw dane lub usuń nieobsługiwaną pozycję.");
    } else if (/free[ -]funds interest/.test(type)) {
      if (amount !== null) require(amount > 0, "amount", "Odsetki muszą być dodatnie. Ujemna lub zerowa kwota wymaga sprawdzenia.");
    } else if (type.includes("withdrawal")) {
      if (amount !== null) require(amount < 0, "amount", "Wypłata XTB wymaga ujemnej kwoty źródłowej.");
    } else if (type.includes("deposit")) {
      if (amount !== null) require(amount > 0, "amount", "Wpłata XTB wymaga dodatniej kwoty źródłowej.");
    } else if (type.includes("transfer")) {
      if (amount !== null) require(amount !== 0, "amount", "Transfer wymaga niezerowej kwoty.");
    } else issues.push({ code: "unsupported_type", field: "type", message: `Nieobsługiwany typ operacji: ${v.type || "brak"}. Usuń pozycję z importu.` });
  } else if (draft.format === "pko") {
    const type = (v.rodzajdyspozycji ?? "").toLowerCase();
    const amount = parseSpreadsheetNumber(v.kwotaoperacji);
    require(amount !== null, "kwotaoperacji", "Kwota musi być poprawną, skończoną liczbą.");
    if (!["odsetki", "opłata za przedterminowy wykup"].includes(type) && !type.startsWith("naliczenie odsetek")) require(reviewDate(v.datadyspozycji) !== null, "datadyspozycji", "Brakuje poprawnej daty (RRRR-MM-DD).");
    if (["zakup papierów", "dyspozycja zakupu"].includes(type)) {
      require((parseSpreadsheetNumber(v.liczbaobligacji) ?? 0) > 0, "liczbaobligacji", "Zakup wymaga dodatniej liczby obligacji.");
      if (amount !== null) require(amount > 0, "kwotaoperacji", "Zakup wymaga dodatniej kwoty.");
    } else if (type.startsWith("naliczenie odsetek") || ["odsetki", "przedterminowy wykup"].includes(type)) {
      if (amount !== null) require(amount > 0, "kwotaoperacji", "Odsetki lub wykup wymagają dodatniej kwoty. Sprawdź korektę.");
      if (type === "przedterminowy wykup" && v.liczbaobligacji) require(parseSpreadsheetNumber(v.liczbaobligacji) !== null && Number(v.liczbaobligacji) >= 0, "liczbaobligacji", "Liczba wykupywanych obligacji nie może być ujemna ani niepoprawna.");
    } else if (["podatek", "opłata za przedterminowy wykup"].includes(type)) {
      // PKO exports use both signed debits and positive cost magnitudes.
    } else if (type === "wypłata przelewem") {
      if (amount !== null) require(amount !== 0, "kwotaoperacji", "Wypłata wymaga niezerowej kwoty.");
    } else issues.push({ code: "unsupported_type", field: "rodzajdyspozycji", message: "Nieobsługiwany rodzaj dyspozycji. Usuń pozycję z importu." });
    if (type !== "wypłata przelewem") require(Boolean(v.kodobligacji), "kodobligacji", "Brakuje kodu obligacji.");
  }
  return issues;
}

function compile(draft: ImportReviewDraft, rows: ReviewRow[], context: Context): Parsed {
  const extra = [...new Set(rows.flatMap(row => Object.keys(row.values)))].filter(field => !draft.headers.includes(field)).sort();
  const headers = [...draft.headers, ...extra];
  if (draft.format === "generic" && !headers.includes("portfolio") && !headers.includes("portfolioid")) headers.push("portfolio");
  const table: unknown[][] = Array.from({ length: draft.rows.reduce((last, row) => Math.max(last, row.rowNumber), draft.headerRow) }, () => []);
  const pkoLabels: Record<string, string> = { datadyspozycji: "DATA DYSPOZYCJI", rodzajdyspozycji: "RODZAJ DYSPOZYCJI", kodobligacji: "KOD OBLIGACJI", nrzapisu: "NR ZAPISU", seria: "SERIA", liczbaobligacji: "LICZBA OBLIGACJI", kwotaoperacji: "KWOTA OPERACJI", status: "STATUS" };
  const xtbLabels: Record<string, string> = { type: "Type", instrument: "Instrument", ticker: "Ticker", time: "Time", amount: "Amount", id: "ID", comment: "Comment" };
  table[draft.headerRow - 1] = headers.map(field => draft.format === "pko" ? pkoLabels[field] ?? field : draft.format === "xtb" ? xtbLabels[field] ?? field : field);
  for (const row of rows) {
    const values = { ...row.values };
    if (draft.format === "xtb" && isTrade(values.type ?? "") && parseSpreadsheetNumber(values.quantity) !== null && parseSpreadsheetNumber(values.price) !== null) {
      values.comment = `${/stock purchase/i.test(values.type) ? "OPEN BUY" : "CLOSE SELL"} ${values.quantity} @ ${values.price}`;
    }
    table[row.rowNumber - 1] = headers.map(field => {
      const value = values[field] ?? "";
      if (draft.format === "pko" && field === "datadyspozycji" && reviewDate(value)) return reviewDate(value)!.toISOString().slice(0, 10);
      if (draft.format === "generic" && field === "portfolio" && !draft.headers.includes("portfolio")) return context.portfolioID;
      if (draft.format === "xtb" && field === "time" && reviewDate(value)) return reviewDate(value)!;
      return value;
    });
  }
  const references = { ...context.references, existingTransactionIds: new Set<string>(), existingExternalImportIds: new Set<string>() };
  if (draft.format === "xtb") return parseXtbXlsx(table, context.portfolioID, references, { catalog: context.catalog });
  if (draft.format === "pko") return parsePkoBondsXls(table, context.portfolioID, references);
  return parseTransactionTable(table, references);
}

export function evaluateImportReview(input: ImportReviewDraft, context: Context): ReviewedImport {
  const draft: ImportReviewDraft = { ...input, originalIDs: { ...input.originalIDs }, transactionIDs: { ...input.transactionIDs }, assetIDs: { ...input.assetIDs }, rows: input.rows.map(row => ({ ...row, values: { ...row.values }, transactionIDs: [], issues: [] })) };
  if (!draft.initialized) {
    const baseline = compile(draft, draft.rows, context);
    const roles: Record<string, number> = {};
    for (const row of baseline.rows) {
      if (!row.payload) continue;
      const base = `${row.rowNumber}:${row.payload.transactionType}`;
      const role = `${base}:${roles[base] ?? 0}`;
      roles[base] = (roles[base] ?? 0) + 1;
      if (typeof row.payload.externalImportID === "string") draft.originalIDs[role] = row.payload.externalImportID;
      draft.transactionIDs[role] = row.payload.id;
    }
    draft.rows.forEach(row => { row.parent = baseline.sourceParents?.[row.rowNumber]; });
    draft.initialized = true;
  }
  const externalIDs = context.references.existingExternalImportIds ?? new Set<string>();
  const fallbackPrefix = `import-review:${provider(draft.format)}:${draft.digest}:${draft.sheet}:`;
  const fallbackRows = new Map<number, number>();
  for (const id of externalIDs) if (id.startsWith(fallbackPrefix)) {
    const number = Number(id.slice(fallbackPrefix.length).split(":")[0]);
    fallbackRows.set(number, (fallbackRows.get(number) ?? 0) + 1);
  }
  for (const row of draft.rows) {
    const original = row.originalValues;
    const ids = Object.entries(draft.originalIDs).filter(([role]) => role.startsWith(`${row.rowNumber}:`)).map(([, id]) => id);
    const rawID = draft.format === "xtb" && original.id ? `xtb:${original.id}` : original.externalimportid;
    const uuid = original.transactionid ?? original.id;
    const expectedFallbacks = draft.format === "pko" && ["zakup papierów", "dyspozycja zakupu"].includes(original.rodzajdyspozycji?.toLowerCase()) ? 2 : 1;
    row.duplicate = (ids.length > 0 && ids.every(id => externalIDs.has(id))) || Boolean(rawID && externalIDs.has(rawID)) || Boolean(uuid && context.references.existingTransactionIds.has(uuid)) || (fallbackRows.get(row.rowNumber) ?? 0) >= expectedFallbacks;
  }
  for (const row of draft.rows) if (row.parent !== undefined && draft.rows.some(parent => parent.rowNumber === row.parent && parent.duplicate)) row.duplicate = true;
  for (const row of draft.rows) if (!row.excluded && !row.duplicate) {
    row.issues = rawIssues(draft, row);
    if (row.parent !== undefined && draft.rows.some(parent => parent.rowNumber === row.parent && parent.excluded)) row.issues.push({ code: "missing_parent", field: "row", message: "Pozycja wymaga przywrócenia powiązanej operacji lub usunięcia z importu." });
  }
  const parsed = compile(draft, draft.rows.filter(row => !row.excluded && !row.duplicate && row.issues.length === 0), context);
  const assets = parsed.newInstrumentPayloads ?? [];
  const rewrites = new Map<string, string>();
  for (const asset of assets) {
    const symbol = String(asset.symbol ?? "").toUpperCase();
    const id = draft.assetIDs[symbol] ?? asset.id;
    draft.assetIDs[symbol] = id;
    rewrites.set(asset.id, id);
    asset.id = id;
    Object.assign(asset, draft.instrumentOverrides[id] ?? {});
  }
  const seenIDs = new Set(context.references.existingTransactionIds);
  const seenExternalIDs = new Set(externalIDs);
  const roles: Record<string, number> = {};
  const rows: TransactionImportRow[] = [];
  for (const row of parsed.rows) {
    const source = draft.rows.find(source => source.rowNumber === row.rowNumber);
    if (!source) continue;
    if (!row.payload) {
      source.issues.push(...row.errors.map(message => ({ code: "invalid_record", field: "row", message })));
      continue;
    }
    const payload = { ...row.payload };
    const type = String(payload.transactionType);
    const base = `${row.rowNumber}:${type}`;
    const role = `${base}:${roles[base] ?? 0}`;
    roles[base] = (roles[base] ?? 0) + 1;
    let rawID = draft.format === "xtb" && source.originalValues.id ? `xtb:${source.originalValues.id}` : draft.format === "generic" ? source.originalValues.externalimportid : undefined;
    if (draft.format === "pko" && Number(source.originalValues.nrzapisu) > 0 && ["buy", "cashDeposit"].includes(type)) {
      const buyID = `pko-bonds:buy:${Math.trunc(Number(source.originalValues.nrzapisu))}`;
      rawID = type === "buy" ? buyID : `pko-bonds:fund:${buyID}`;
    }
    const csvID = source.originalValues.transactionid ?? source.originalValues.id;
    const hasCSVIdentity = draft.format === "generic" && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(csvID ?? "");
    const externalID = draft.originalIDs[role] ?? rawID ?? (hasCSVIdentity ? undefined : `${fallbackPrefix}${role}`);
    if (externalID) { draft.originalIDs[role] = externalID; payload.externalImportID = externalID; }
    else delete payload.externalImportID;
    payload.id = draft.transactionIDs[role] ?? payload.id;
    draft.transactionIDs[role] = payload.id;
    if (seenIDs.has(payload.id) || (externalID && seenExternalIDs.has(externalID))) continue;
    seenIDs.add(payload.id); if (externalID) seenExternalIDs.add(externalID);
    if (typeof payload.instrumentID === "string") {
      payload.instrumentID = rewrites.get(payload.instrumentID) ?? payload.instrumentID;
      const currency = draft.instrumentOverrides[String(payload.instrumentID)]?.currency;
      if (currency && ["buy", "sell"].includes(type)) { payload.currency = currency; if (currency === "PLN") payload.fxRateToBase = 1; }
    }
    if (draft.format === "xtb") payload.notes = source.values.comment ?? "";
    source.transactionIDs.push(payload.id);
    const issues = validateTransactionPayload(payload).filter(issue => !(draft.format !== "generic" && issue.field === "currency" && payload.currency === "?"));
    source.issues.push(...issues.map(issue => ({ code: "invalid_record", ...issue })));
    rows.push({ ...row, payload });
  }
  for (const row of draft.rows) if (!row.excluded && !row.duplicate) {
    const parent = parsed.sourceParents?.[row.rowNumber];
    if (row.parent !== undefined && row.parent !== parent && row.issues.length === 0) row.issues.push({ code: "changed_parent", field: "row", message: "Powiązanie pozycji z transakcją zmieniło się lub zniknęło. Popraw datę i dane albo usuń pozycję z importu." });
    else if (row.parent === undefined && parent !== undefined) row.parent = parent;
    if (row.issues.length === 0 && row.transactionIDs.length === 0 && row.parent === undefined && !supporting(draft, row)) row.issues.push({ code: "unmapped_row", field: "row", message: "Nie można powiązać pozycji z transakcją. Popraw dane lub usuń pozycję z importu." });
  }
  const referenced = new Set(rows.map(row => row.payload?.instrumentID));
  const referencedBondCodes = draft.format === "pko" ? [...new Set(draft.rows.filter(row => !row.excluded && ["dyspozycja zakupu", "zakup papierów"].includes(row.values.rodzajdyspozycji?.toLowerCase()) && (parseSpreadsheetNumber(row.values.liczbaobligacji) ?? 0) > 0 && (parseSpreadsheetNumber(row.values.kwotaoperacji) ?? 0) > 0).map(row => row.values.kodobligacji.toUpperCase()))] : parsed.referencedBondCodes;
  return { ...parsed, review: draft, rows, validRows: rows.filter(row => row.errors.length === 0), errorRows: rows.filter(row => row.errors.length > 0), newInstrumentPayloads: assets.filter(asset => referenced.has(asset.id)), sourceParents: parsed.sourceParents ?? {}, referencedBondCodes };
}
