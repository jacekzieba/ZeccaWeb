import { findOversells, oversellMessage, type OversellInput, type OversellIssue } from "@/domain/ledger/oversell";
import type { DecryptedRecord } from "./encrypted-records";

// Most między rekordami synchronizacji a czystą funkcją `findOversells`. Trzy miejsca
// pytają o sprzedaż ponad stan i każde ma transakcje w innym kształcie (rekordy z sync,
// wiersze podglądu importu, formularz), więc tłumaczenie do `OversellInput` jest tutaj,
// w jednym miejscu.

const APPLE_REFERENCE_DATE_UNIX_MS = Date.UTC(2001, 0, 1);

/** Data z rekordu: liczba = sekundy od 2001-01-01 (natywny zapis), tekst = ISO. */
export function payloadDateMs(value: unknown): number | null {
  const ms =
    typeof value === "number"
      ? APPLE_REFERENCE_DATE_UNIX_MS + value * 1000
      : typeof value === "string"
        ? Date.parse(value)
        : Number.NaN;
  return Number.isNaN(ms) ? null : ms;
}

/** Kształt transakcji, który wystarcza do wykrycia sprzedaży ponad stan. */
export type TransactionLike = {
  id?: string;
  date: unknown;
  portfolioID?: string | null;
  instrumentID?: string | null;
  transactionType?: string | null;
  quantity?: number | null;
  price?: number | null;
  transferKind?: string | null;
  transferLots?: { quantity: number }[] | null;
};

export function toOversellInput(t: TransactionLike, fallbackId: string): OversellInput | null {
  const dateMs = payloadDateMs(t.date);
  if (dateMs == null || !t.portfolioID || !t.transactionType) return null;
  const lotQuantity = (t.transferLots ?? []).reduce((sum, lot) => sum + lot.quantity, 0);
  return {
    id: t.id ?? fallbackId,
    portfolioID: t.portfolioID,
    instrumentID: t.instrumentID ?? null,
    transactionType: t.transactionType,
    quantity: t.quantity ?? null,
    price: t.price ?? null,
    transferKind: t.transferKind ?? null,
    transferLotQuantity: lotQuantity,
    dateMs,
  };
}

/** Wejścia z rekordów synchronizacji (usunięte i nie-transakcje pomijane). */
export function oversellInputsFromRecords(
  records: readonly DecryptedRecord[],
  excludeIds: ReadonlySet<string> = new Set(),
): OversellInput[] {
  const inputs: OversellInput[] = [];
  for (const record of records) {
    if (record.deletedAt || record.envelope.type !== "transaction") continue;
    if (excludeIds.has(record.id)) continue;
    const input = toOversellInput(record.envelope.payload as TransactionLike, record.id);
    if (input) inputs.push(input);
  }
  return inputs;
}

/** Komunikat dla kandydata (jednej nowej lub edytowanej transakcji) względem istniejących.
 * `null`, gdy stan wystarcza. */
export function oversellWarningForCandidate(
  existing: readonly OversellInput[],
  candidate: OversellInput,
): string | null {
  const issue = findOversells([...existing, candidate]).find((i) => i.id === candidate.id);
  return issue ? oversellMessage(issue) : null;
}

export type { OversellIssue };
