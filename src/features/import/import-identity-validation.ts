import type { WriteRecordPayload } from "@/sync/records/record-writer";

export type ImportIdentityError = {
  instrumentId: string;
  symbol: string;
  fields: string[];
  message: string;
};

type ImportPayload = Pick<WriteRecordPayload, "id" | "recordType"> & Record<string, unknown>;

function text(payload: ImportPayload, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

function validDate(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value);
  return typeof value === "string" && value.trim() !== "" && !Number.isNaN(Date.parse(value));
}

function bondParamsAreComplete(payload: ImportPayload) {
  const params = payload.bondParams;
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return ["bondParams"];
  }
  const fields = params as Record<string, unknown>;
  const missing: string[] = [];
  if (!validDate(fields.issueDate)) missing.push("bondParams.issueDate");
  if (!validDate(fields.maturityDate)) missing.push("bondParams.maturityDate");
  for (const key of ["nominalValue", "firstPeriodRate", "marginOverBase"]) {
    if (typeof fields[key] !== "number" || !Number.isFinite(fields[key])) {
      missing.push(`bondParams.${key}`);
    }
  }
  for (const key of ["subsequentBase", "capitalization", "interestPayment"]) {
    if (typeof fields[key] !== "string" || fields[key].trim() === "") {
      missing.push(`bondParams.${key}`);
    }
  }
  return missing;
}

export function isImportedMarketInstrument(payload: ImportPayload) {
  return payload.recordType === "asset" && (payload.kind === "etf" || payload.kind === "stock");
}

export function isImportedTreasuryBond(payload: ImportPayload) {
  return payload.recordType === "asset" && payload.kind === "treasuryBond";
}

/**
 * Imported ETFs and shares need a durable, unambiguous market identity. The
 * broker symbol and the quote symbol are deliberately separate: a broker can
 * settle a dual-listed ETF on a line other than its own suffix suggests.
 */
export function validateImportIdentities(payloads: readonly ImportPayload[]): ImportIdentityError[] {
  return payloads.flatMap((payload) => {
    if (!isImportedMarketInstrument(payload)) return [];

    const symbol = text(payload, "symbol").toUpperCase();
    const name = text(payload, "name");
    const currency = text(payload, "currency").toUpperCase();
    const exchange = text(payload, "exchange");
    const isin = text(payload, "isin").toUpperCase();
    const marketDataID = text(payload, "marketDataID").toUpperCase();
    const fields: string[] = [];

    if (!/^[A-Z0-9][A-Z0-9._=-]*$/.test(symbol)) fields.push("symbol");
    if (name.length < 3 || name.toUpperCase() === symbol) fields.push("name");
    if (!/^[A-Z]{3}$/.test(currency)) fields.push("currency");
    if (exchange.length < 2) fields.push("exchange");
    if (payload.kind === "etf" && !/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin)) fields.push("isin");
    if (!/^[A-Z0-9][A-Z0-9._=-]*$/.test(marketDataID)) fields.push("marketDataID");

    return fields.length === 0
      ? []
      : [{
          instrumentId: payload.id,
          symbol: symbol || "nowy instrument",
          fields,
          message: `Uzupełnij i potwierdź: ${fields.join(", ")}.`,
        }];
  });
}

/** Treasury-bond import is valid only when it can calculate accrued value. */
export function validateTreasuryBondImports(
  payloads: readonly ImportPayload[],
  transactionPayloads: readonly Record<string, unknown>[],
): ImportIdentityError[] {
  return payloads.flatMap((payload) => {
    if (!isImportedTreasuryBond(payload)) return [];

    const fields = bondParamsAreComplete(payload);
    const hasDatedBuy = transactionPayloads.some(
      (transaction) =>
        transaction.instrumentID === payload.id &&
        transaction.transactionType === "buy" &&
        validDate(transaction.date),
    );
    if (!hasDatedBuy) fields.push("purchaseDate");

    return fields.length === 0
      ? []
      : [{
          instrumentId: payload.id,
          symbol: text(payload, "symbol").toUpperCase() || "nowa obligacja",
          fields,
          message: `Nie można wycenić obligacji: ${fields.join(", ")}.`,
        }];
  });
}

export function validateImportBeforeCommit(
  payloads: readonly ImportPayload[],
  transactionPayloads: readonly Record<string, unknown>[],
) {
  return [
    ...validateImportIdentities(payloads),
    ...validateTreasuryBondImports(payloads, transactionPayloads),
  ];
}
