import type {
  EarningBurdenCategory,
  EarningBurdenRow,
  EarningRow,
  EmploymentType,
} from "@/domain/models/earnings";

export const EARNINGS_IMPORT_COLUMNS = [
  "period",
  "kind",
  "type",
  "amount",
  "currency",
  "fx_rate_to_pln",
  "amount_pln",
  "source",
] as const;

export const EARNINGS_IMPORT_TEMPLATE = [
  EARNINGS_IMPORT_COLUMNS.join(","),
  "2026-06,earning,employment,12500.00,PLN,1,12500.00,Wynagrodzenie",
  "2026-06,earning,business,2500.00,EUR,4.25,10625.00,Klient UE",
  "2026-06,burden,zus,1773.96,PLN,1,1773.96,ZUS",
].join("\n");

export const EARNINGS_IMPORT_AI_INSTRUCTIONS = `Przekształć wyciąg bankowy do CSV dla Zecca. Zwróć wyłącznie tabelę z kolumnami:
${EARNINGS_IMPORT_COLUMNS.join(",")}

Zasady:
- jeden wiersz oznacza jeden zarobek albo jedno obciążenie;
- period ma format YYYY-MM;
- kind: earning albo burden;
- dla earning type: employment albo business;
- dla burden type: income_tax, vat, zus albo accounting;
- amount, fx_rate_to_pln i amount_pln zapisuj bez separatorów tysięcy, z kropką dziesiętną;
- przy PLN wpisz currency=PLN i fx_rate_to_pln=1;
- przy walucie obcej podaj dodatni kurs do PLN oraz wynikową amount_pln;
- source ma krótko i stabilnie identyfikować źródło; użyj innej wartości, jeśli w tym samym miesiącu są dwa wpisy tego samego typu;
- nie zgaduj kwot, walut ani kategorii. Niejednoznaczne operacje pomiń i opisz osobno.`;

export type IncomeImportPayload = {
  recordType: "income";
  id: string;
  entryKind: "earning" | "burden";
  year: number;
  month: number;
  employmentType: EmploymentType | null;
  enteredAmount: number | null;
  currency: string | null;
  fxRateToPLN: number | null;
  plnAmount: number | null;
  source: string | null;
  burdenCategory: EarningBurdenCategory | null;
  amountPLN: number | null;
  note: string | null;
};

export type EarningsImportItem = {
  rowNumber: number;
  action: "insert" | "update";
  payload: IncomeImportPayload;
  baseUpdatedAt: string | null;
};

export type EarningsImportIssue = {
  rowNumber: number | null;
  severity: "warning" | "error";
  message: string;
};

export type EarningsImportPreview = {
  format: "standard" | "legacyMonthlyWorkbook";
  sourceRowCount: number;
  inserts: EarningsImportItem[];
  updates: EarningsImportItem[];
  unchangedCount: number;
  issues: EarningsImportIssue[];
  insertCount: number;
  updateCount: number;
  importCount: number;
  errorCount: number;
  warningCount: number;
  canImport: boolean;
  itemsToImport: EarningsImportItem[];
};

type ExistingIncome = {
  earnings: EarningRow[];
  burdens: EarningBurdenRow[];
};

type ParseOptions = {
  idFactory?: () => string;
};

type TableRow = {
  rowNumber: number;
  values: Record<string, unknown>;
};

type ParsedItem = {
  rowNumber: number;
  payload: IncomeImportPayload;
};

type ParsedRows = {
  format: EarningsImportPreview["format"];
  sourceRowCount: number;
  items: ParsedItem[];
  issues: EarningsImportIssue[];
};

const STANDARD_HEADERS = new Set<string>(EARNINGS_IMPORT_COLUMNS);
const LEGACY_HEADERS = new Set([
  "data",
  "przychod_pln",
  "przychod_euro",
  "pit",
  "vat",
  "zus",
  "inne",
  "dochod_pln",
  "dochod",
]);

export function parseEarningsImportCsv(
  text: string,
  existing: ExistingIncome,
  options: ParseOptions = {},
): EarningsImportPreview {
  return parseEarningsImportTable(parseCsv(text), existing, options);
}

export function parseEarningsImportTable(
  matrix: unknown[][],
  existing: ExistingIncome,
  options: ParseOptions = {},
): EarningsImportPreview {
  const table = makeTable(matrix);
  const idFactory = options.idFactory ?? (() => crypto.randomUUID());
  const parsed = hasHeaders(table.headers, STANDARD_HEADERS)
    ? parseStandardRows(table.rows, idFactory)
    : hasHeaders(table.headers, LEGACY_HEADERS)
      ? parseLegacyRows(table.rows, idFactory)
      : null;

  if (!parsed) {
    throw new Error(`Nieobsługiwany układ kolumn. Oczekiwano: ${EARNINGS_IMPORT_COLUMNS.join(", ")}.`);
  }

  return reconcile(parsed, existing);
}

function parseStandardRows(rows: TableRow[], idFactory: () => string): ParsedRows {
  const sourceRows = rows.filter((row) => !isEmptyRow(row));
  const parsed: ParsedRows = {
    format: "standard",
    sourceRowCount: sourceRows.length,
    items: [],
    issues: [],
  };

  for (const row of sourceRows) {
    const period = parsePeriod(row.values.period);
    if (!period) {
      addError(parsed, row, "period musi mieć format YYYY-MM lub YYYY-MM-DD");
      continue;
    }
    const kind = parseKind(row.values.kind);
    if (!kind) {
      addError(parsed, row, "kind musi mieć wartość earning albo burden");
      continue;
    }
    const amount = parsePositiveNumber(row.values.amount);
    if (amount === null) {
      addError(parsed, row, "amount musi być dodatnią liczbą");
      continue;
    }
    const source = stringValue(row.values.source).trim();
    if (!source) {
      addError(parsed, row, "source nie może być puste");
      continue;
    }

    if (kind === "earning") {
      const employmentType = parseEmploymentType(row.values.type);
      if (!employmentType) {
        addError(parsed, row, "dla earning type musi mieć wartość employment albo business");
        continue;
      }
      const currency = stringValue(row.values.currency).trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(currency)) {
        addError(parsed, row, "currency musi być trzyliterowym kodem waluty, np. PLN lub EUR");
        continue;
      }

      const suppliedFx = parseNumber(row.values.fx_rate_to_pln);
      const suppliedPln = parseNumber(row.values.amount_pln);
      let fxRateToPLN: number;
      let plnAmount: number;
      if (currency === "PLN") {
        fxRateToPLN = 1;
        plnAmount = suppliedPln ?? amount;
        if (Math.abs(plnAmount - amount) > 0.01) {
          addError(parsed, row, "dla PLN amount_pln musi być równe amount");
          continue;
        }
      } else if (suppliedFx !== null && suppliedFx > 0) {
        fxRateToPLN = suppliedFx;
        plnAmount = suppliedPln ?? amount * suppliedFx;
        if (Math.abs(plnAmount - amount * suppliedFx) > 0.02) {
          addError(parsed, row, "amount_pln nie zgadza się z amount × fx_rate_to_pln");
          continue;
        }
      } else if (suppliedPln !== null && suppliedPln > 0) {
        plnAmount = suppliedPln;
        fxRateToPLN = suppliedPln / amount;
      } else {
        addError(parsed, row, "dla waluty obcej podaj fx_rate_to_pln lub amount_pln");
        continue;
      }

      if (fxRateToPLN <= 0 || plnAmount <= 0) {
        addError(parsed, row, "kurs i kwota w PLN muszą być dodatnie");
        continue;
      }
      parsed.items.push({
        rowNumber: row.rowNumber,
        payload: earningPayload(idFactory(), period, employmentType, amount, currency, fxRateToPLN, plnAmount, source),
      });
      continue;
    }

    const category = parseBurdenCategory(row.values.type);
    if (!category) {
      addError(parsed, row, "dla burden type musi mieć wartość income_tax, vat, zus albo accounting");
      continue;
    }
    const currency = stringValue(row.values.currency || "PLN").trim().toUpperCase();
    if (currency && currency !== "PLN") {
      addError(parsed, row, "obciążenia muszą być podane w PLN");
      continue;
    }
    const amountPLN = parseNumber(row.values.amount_pln);
    if (amountPLN !== null && Math.abs(amountPLN - amount) > 0.01) {
      addError(parsed, row, "dla obciążenia amount_pln musi być równe amount");
      continue;
    }
    parsed.items.push({
      rowNumber: row.rowNumber,
      payload: burdenPayload(idFactory(), period, category, amount, source),
    });
  }

  return parsed;
}

function parseLegacyRows(rows: TableRow[], idFactory: () => string): ParsedRows {
  const numericFields = ["przychod_pln", "przychod_euro", "pit", "vat", "zus", "inne", "dochod_pln", "dochod"];
  const sourceRows = rows.filter((row) => numericFields.some((field) => stringValue(row.values[field]).trim() !== ""));
  const parsed: ParsedRows = {
    format: "legacyMonthlyWorkbook",
    sourceRowCount: sourceRows.length,
    items: [],
    issues: [],
  };

  for (const row of sourceRows) {
    const period = parsePeriod(row.values.data);
    if (!period) {
      addError(parsed, row, "Data nie zawiera poprawnej daty");
      continue;
    }
    const values: Record<string, number> = {};
    let invalidField: string | null = null;
    for (const field of numericFields) {
      const raw = row.values[field];
      if (stringValue(raw).trim() === "") {
        values[field] = 0;
        continue;
      }
      const value = parseNumber(raw);
      if (value === null || (!new Set(["dochod_pln", "dochod"]).has(field) && value < 0)) {
        invalidField = field;
        break;
      }
      values[field] = value;
    }
    if (invalidField) {
      addError(parsed, row, `kolumna ${invalidField} nie zawiera poprawnej liczby`);
      continue;
    }
    if (!numericFields.some((field) => Math.abs(values[field] ?? 0) > 0.000001)) continue;

    const revenuePLN = values.przychod_pln ?? 0;
    const revenueEUR = values.przychod_euro ?? 0;
    if (revenuePLN > 0) {
      parsed.items.push({
        rowNumber: row.rowNumber,
        payload: earningPayload(idFactory(), period, "business", revenuePLN, "PLN", 1, revenuePLN, "Działalność (PLN)"),
      });
    }
    if (revenueEUR > 0) {
      const burdenTotal = (values.pit ?? 0) + (values.vat ?? 0) + (values.zus ?? 0) + (values.inne ?? 0);
      const convertedEUR = round((values.dochod ?? 0) - revenuePLN + burdenTotal, 8);
      if (convertedEUR <= 0) {
        addError(parsed, row, "nie można wyliczyć kursu EUR z przychodu, obciążeń i wyniku miesięcznego");
        continue;
      }
      parsed.items.push({
        rowNumber: row.rowNumber,
        payload: earningPayload(idFactory(), period, "business", revenueEUR, "EUR", round(convertedEUR / revenueEUR, 8), convertedEUR, "Działalność (EUR)"),
      });
    }

    const burdens: [string, EarningBurdenCategory][] = [
      ["pit", "incomeTax"],
      ["vat", "vat"],
      ["zus", "zus"],
      ["inne", "accounting"],
    ];
    for (const [field, category] of burdens) {
      const amount = values[field] ?? 0;
      if (amount <= 0) continue;
      parsed.items.push({
        rowNumber: row.rowNumber,
        payload: burdenPayload(idFactory(), period, category, amount, "Arkusz historyczny"),
      });
    }
  }

  return parsed;
}

function reconcile(parsed: ParsedRows, existing: ExistingIncome): EarningsImportPreview {
  const issues = [...parsed.issues];
  const inserts: EarningsImportItem[] = [];
  const updates: EarningsImportItem[] = [];
  let unchangedCount = 0;
  const seen = new Map<string, number>();
  const existingByKey = new Map<string, EarningRow | EarningBurdenRow>();
  for (const row of [...existing.earnings, ...existing.burdens]) {
    const key = existingKey(row);
    if (!existingByKey.has(key)) existingByKey.set(key, row);
  }

  for (const item of parsed.items) {
    const key = payloadKey(item.payload);
    const firstRow = seen.get(key);
    if (firstRow !== undefined) {
      issues.push({
        rowNumber: item.rowNumber,
        severity: "error",
        message: `powtórzony wpis (pierwszy wiersz: ${firstRow}); zmień source, jeśli to osobny wpis`,
      });
      continue;
    }
    seen.set(key, item.rowNumber);

    const current = existingByKey.get(key);
    if (!current) {
      inserts.push({ ...item, action: "insert", baseUpdatedAt: null });
      continue;
    }

    const payload = { ...item.payload, id: current.id };
    if (contentEqual(payload, current)) {
      unchangedCount += 1;
    } else {
      updates.push({
        rowNumber: item.rowNumber,
        action: "update",
        payload,
        baseUpdatedAt: current.sourceUpdatedAt,
      });
    }
  }

  if (parsed.sourceRowCount > 0 && parsed.items.length === 0 && issues.length === 0) {
    issues.push({ rowNumber: null, severity: "error", message: "nie znaleziono żadnych wpisów do importu" });
  }
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const itemsToImport = [...inserts, ...updates];
  return {
    format: parsed.format,
    sourceRowCount: parsed.sourceRowCount,
    inserts,
    updates,
    unchangedCount,
    issues,
    insertCount: inserts.length,
    updateCount: updates.length,
    importCount: itemsToImport.length,
    errorCount,
    warningCount,
    canImport: itemsToImport.length > 0 && errorCount === 0,
    itemsToImport,
  };
}

function earningPayload(
  id: string,
  period: { year: number; month: number },
  employmentType: EmploymentType,
  enteredAmount: number,
  currency: string,
  fxRateToPLN: number,
  plnAmount: number,
  source: string,
): IncomeImportPayload {
  return {
    recordType: "income",
    id,
    entryKind: "earning",
    year: period.year,
    month: period.month,
    employmentType,
    enteredAmount,
    currency,
    fxRateToPLN,
    plnAmount,
    source,
    burdenCategory: null,
    amountPLN: null,
    note: null,
  };
}

function burdenPayload(
  id: string,
  period: { year: number; month: number },
  burdenCategory: EarningBurdenCategory,
  amountPLN: number,
  source: string,
): IncomeImportPayload {
  return {
    recordType: "income",
    id,
    entryKind: "burden",
    year: period.year,
    month: period.month,
    employmentType: null,
    enteredAmount: null,
    currency: null,
    fxRateToPLN: null,
    plnAmount: null,
    source: null,
    burdenCategory,
    amountPLN,
    note: source,
  };
}

function existingKey(row: EarningRow | EarningBurdenRow) {
  return row.kind === "earning"
    ? `earning|${row.year}|${row.month}|${row.employmentType}|${normalizeKey(row.source)}`
    : `burden|${row.year}|${row.month}|${row.category}|${normalizeKey(row.note ?? "")}`;
}

function payloadKey(payload: IncomeImportPayload) {
  return payload.entryKind === "earning"
    ? `earning|${payload.year}|${payload.month}|${payload.employmentType}|${normalizeKey(payload.source ?? "")}`
    : `burden|${payload.year}|${payload.month}|${payload.burdenCategory}|${normalizeKey(payload.note ?? "")}`;
}

function contentEqual(payload: IncomeImportPayload, row: EarningRow | EarningBurdenRow) {
  if (payload.entryKind === "earning" && row.kind === "earning") {
    return payload.year === row.year
      && payload.month === row.month
      && payload.employmentType === row.employmentType
      && close(payload.enteredAmount, row.enteredAmount, 0.005)
      && payload.currency === row.currency
      && close(payload.fxRateToPLN, row.fxRateToPLN, 0.000001)
      && close(payload.plnAmount, row.plnAmount, 0.005)
      && payload.source === row.source
      && payload.note === row.note;
  }
  if (payload.entryKind === "burden" && row.kind === "burden") {
    return payload.year === row.year
      && payload.month === row.month
      && payload.burdenCategory === row.category
      && close(payload.amountPLN, row.amountPLN, 0.005)
      && payload.note === row.note;
  }
  return false;
}

function close(left: number | null, right: number, tolerance: number) {
  return left !== null && Math.abs(left - right) < tolerance;
}

function parseKind(value: unknown) {
  const normalized = normalizeKey(stringValue(value));
  if (["earning", "zarobek", "przychod"].includes(normalized)) return "earning" as const;
  if (["burden", "obciazenie", "koszt"].includes(normalized)) return "burden" as const;
  return null;
}

function parseEmploymentType(value: unknown): EmploymentType | null {
  const normalized = normalizeKey(stringValue(value));
  if (["employment", "zatrudnienie", "umowa_o_prace"].includes(normalized)) return "employment";
  if (["business", "dzialalnosc", "b2b"].includes(normalized)) return "business";
  return null;
}

function parseBurdenCategory(value: unknown): EarningBurdenCategory | null {
  const normalized = normalizeKey(stringValue(value));
  if (["income_tax", "pit", "podatek_dochodowy"].includes(normalized)) return "incomeTax";
  if (normalized === "vat") return "vat";
  if (normalized === "zus") return "zus";
  if (["accounting", "ksiegowosc", "inne"].includes(normalized)) return "accounting";
  return null;
}

function parsePeriod(value: unknown): { year: number; month: number } | null {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return { year: value.getFullYear(), month: value.getMonth() + 1 };
  }
  const number = typeof value === "number" ? value : Number(stringValue(value));
  if (Number.isFinite(number) && number > 1000) {
    const date = new Date(Date.UTC(1899, 11, 30) + number * 86400000);
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
  }
  const text = stringValue(value).trim();
  let match = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(text);
  let year = match ? Number(match[1]) : 0;
  let month = match ? Number(match[2]) : 0;
  if (!match) {
    match = /^(\d{2})[./-](\d{4})$/.exec(text);
    month = match ? Number(match[1]) : 0;
    year = match ? Number(match[2]) : 0;
  }
  return year >= 2000 && year <= 2100 && month >= 1 && month <= 12 ? { year, month } : null;
}

function parsePositiveNumber(value: unknown) {
  const parsed = parseNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = stringValue(value)
    .replace(/\u00a0/g, "")
    .replace(/\s/g, "")
    .replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function makeTable(matrix: unknown[][]) {
  const headerIndex = matrix.findIndex((row) => row.some((cell) => stringValue(cell).trim() !== ""));
  if (headerIndex < 0) throw new Error("Plik nie zawiera danych.");
  const headers = matrix[headerIndex].map((cell) => normalizeHeader(stringValue(cell)));
  const rows = matrix.slice(headerIndex + 1).map((cells, index) => ({
    rowNumber: headerIndex + index + 2,
    values: Object.fromEntries(headers.flatMap((header, column) => header ? [[header, cells[column] ?? ""]] : [])),
  }));
  return { headers: new Set(headers.filter(Boolean)), rows };
}

function hasHeaders(actual: Set<string>, required: Set<string>) {
  return [...required].every((header) => actual.has(header));
}

function isEmptyRow(row: TableRow) {
  return Object.values(row.values).every((value) => stringValue(value).trim() === "");
}

function addError(parsed: ParsedRows, row: TableRow, message: string) {
  parsed.issues.push({ rowNumber: row.rowNumber, severity: "error", message });
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeKey(value: string) {
  return normalizeHeader(value);
}

function stringValue(value: unknown) {
  return value == null ? "" : String(value);
}

function round(value: number, places: number) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function parseCsv(text: string): string[][] {
  if (!text.trim()) throw new Error("Plik nie zawiera danych.");
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function detectDelimiter(text: string) {
  const line = text.split(/\r?\n/, 1)[0] ?? "";
  const candidates = [",", ";", "\t"];
  return candidates.reduce((best, candidate) => delimiterCount(line, candidate) > delimiterCount(line, best) ? candidate : best, ",");
}

function delimiterCount(line: string, delimiter: string) {
  let count = 0;
  let quoted = false;
  for (const character of line) {
    if (character === '"') quoted = !quoted;
    if (character === delimiter && !quoted) count += 1;
  }
  return count;
}
