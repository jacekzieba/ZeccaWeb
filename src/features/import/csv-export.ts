import type { TransactionRow } from "@/domain/models/investor-data";
import { warsawCalendarDayTime } from "@/lib/calendar-date";

// Komórka i wiersze eksportu CSV — te same reguły co natywny `CSVCell.escape`
// (wspólna fixtura `csv_cell_cases.json` z repo Zecca).

const DECIMAL_NOTATION = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/**
 * Tekst zaczynający się od `=`, `+`, `-`, `@`, tabulatora albo CR arkusz
 * wykonuje jako formułę (CWE-1236), więc dostaje apostrof. Liczby (zapis
 * dziesiętny, także ujemne) zostają. Pole z przecinkiem, cudzysłowem albo
 * końcem linii trafia w cudzysłów.
 */
export function csvCell(value: string | number | null | undefined) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text) && !DECIMAL_NOTATION.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Dzień transakcji w Polsce, jak w aplikacji: obie platformy kodują dzień inaczej (BOND-001). */
export function exportDay(isoDate: string) {
  return new Date(warsawCalendarDayTime(new Date(isoDate))).toISOString().slice(0, 10);
}

const INCOME_TYPES = new Set(["dividend", "interest", "bondCoupon"]);

/**
 * Wspólny format wymiany transakcji z aplikacją natywną: ten sam nagłówek co
 * `CSVExportBuilder.transactionColumns` w Zecca. Plik czytają oba importy
 * (`parseCsvImport` tutaj, `TransactionCSVImporter` w aplikacji); sędzią jest
 * fixtura `transactions_exchange.csv`. Nowe kolumny dopisuj na końcu, po obu stronach.
 */
export const TRANSACTION_EXCHANGE_COLUMNS = [
  "transaction_id", "date", "booking_date", "portfolio_id", "portfolio_name",
  "instrument_id", "instrument_symbol", "instrument_name", "type",
  "quantity", "price", "gross_amount", "currency",
  "fees", "taxes", "fx_rate_to_base", "notes",
  "external_import_id", "created_at", "updated_at",
  "target_currency", "target_gross_amount",
];

export function transactionsCsvLines(transactions: TransactionRow[]) {
  return [
    TRANSACTION_EXCHANGE_COLUMNS.join(","),
    ...transactions.map((t) =>
      [
        t.id,
        exportDay(t.date),
        t.bookingDate ? exportDay(t.bookingDate) : "",
        t.portfolioId,
        t.portfolioName,
        t.instrumentId ?? "",
        t.instrumentSymbol ?? "",
        t.instrumentName ?? "",
        t.transactionType,
        t.quantity ?? "",
        t.price ?? "",
        t.grossAmount,
        t.currency,
        t.fees,
        t.taxes,
        t.fxRateToBase ?? "",
        t.notes ?? "",
        t.externalImportID ?? "",
        t.createdAt ?? "",
        t.updatedAt ?? "",
        t.targetCurrency ?? "",
        t.targetGrossAmount ?? "",
      ].map(csvCell).join(","),
    ),
  ];
}

export function incomeCsvLines(transactions: TransactionRow[]) {
  return [
    "date,portfolio,instrument,transactionType,grossAmount,currency,fees,taxes",
    ...transactions
      .filter((t) => INCOME_TYPES.has(t.transactionType))
      .map((t) =>
        [
          exportDay(t.date),
          t.portfolioName,
          t.instrumentSymbol ?? t.instrumentName ?? "",
          t.transactionType,
          t.grossAmount,
          t.currency,
          t.fees,
          t.taxes,
        ].map(csvCell).join(","),
      ),
  ];
}
