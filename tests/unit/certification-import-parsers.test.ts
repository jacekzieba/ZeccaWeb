import { describe, expect, it } from "vitest";
import { parseXtbXlsx } from "@/features/import/xtb-parser";
import { parsePkoBondsXls } from "@/features/import/pko-parser";
import type { ImportReferenceData } from "@/features/import/import-parser";
import type { TransactionImportRow } from "@/features/import/import-parser";

// Parser parity for the certification scenario: the exact rows from the native
// fixtures fed inline (bypassing the file reader), asserting the web parsers
// produce the same transactions the native importers do. Expected values are
// frozen anchors from the native plan — a mismatch is a parity bug to report.

const PORTFOLIO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
// The instruments are known (with their currencies) — like the native importer,
// which resolves currency + FX from the registered instrument. Without this the
// XTB parser cannot know EUR/USD/GBP and falls back to the "?" placeholder.
const references: ImportReferenceData = {
  portfolios: [{ id: PORTFOLIO, name: "IKE" }],
  instruments: [
    { id: "11111111-1111-4111-8111-111111111111", symbol: "VWCE.DE", name: "Vanguard FTSE All-World", currency: "EUR" },
    { id: "22222222-2222-4222-8222-222222222222", symbol: "CSPX.UK", name: "iShares Core S&P 500", currency: "USD" },
    { id: "33333333-3333-4333-8333-333333333333", symbol: "IEML.UK", name: "iShares EM Local Govt", currency: "GBP" },
  ],
  existingTransactionIds: new Set(),
  existingManualValuationIds: new Set(),
};

type Payload = Record<string, number | string | null>;
const payloadOf = (row: TransactionImportRow) => row.payload as unknown as Payload;

function groupByType(rows: TransactionImportRow[]) {
  const byType = new Map<string, Payload[]>();
  for (const row of rows) {
    const t = String(payloadOf(row).transactionType);
    byType.set(t, [...(byType.get(t) ?? []), payloadOf(row)]);
  }
  return byType;
}

// Rows identical to Tests/Fixtures/Certification/xtb_cert_scenario.xlsx.
const XTB_ROWS: unknown[][] = [
  ["ID", "Type", "Time", "Ticker", "Instrument", "Comment", "Amount"],
  [100001, "IKE Deposit", new Date("2026-01-05T10:00:00Z"), "", "", "Deposit", 100000],
  [100002, "Stock purchase", new Date("2026-01-10T10:00:00Z"), "VWCE.DE", "Vanguard FTSE All-World", "OPEN BUY 100 @ 100.00", -45000],
  [100003, "Commission", new Date("2026-01-10T10:01:00Z"), "VWCE.DE", "Vanguard FTSE All-World", "Commission", -45],
  [100004, "Stock purchase", new Date("2026-02-03T10:00:00Z"), "CSPX.UK", "iShares Core S&P 500", "OPEN BUY 20 @ 500.00", -42000],
  [100005, "Stock purchase", new Date("2026-03-02T10:00:00Z"), "IEML.UK", "iShares EM Local Govt", "OPEN BUY 50 @ 20.00", -5200],
  [100006, "Dividend", new Date("2026-04-15T10:00:00Z"), "CSPX.UK", "iShares Core S&P 500", "CSPX.UK USD 10.5/SHR", 210],
  [100007, "Free funds interest", new Date("2026-05-01T10:00:00Z"), "", "", "Interest", 10],
  [100008, "Free funds interest tax", new Date("2026-05-01T10:00:00Z"), "", "", "Interest tax", -1.9],
  [100009, "Stock sale", new Date("2026-06-01T10:00:00Z"), "VWCE.DE", "Vanguard FTSE All-World", "CLOSE SELL 40 @ 110.00", 20240],
  [100010, "Commission", new Date("2026-06-01T10:01:00Z"), "VWCE.DE", "Vanguard FTSE All-World", "Commission", -46],
];

// Rows identical to pko_cert_scenario.xls (includes a cancelled row to ignore).
const PKO_ROWS: unknown[][] = [
  ["DATA DYSPOZYCJI", "RODZAJ DYSPOZYCJI", "KOD OBLIGACJI", "NR ZAPISU", "SERIA", "LICZBA OBLIGACJI", "KWOTA OPERACJI", "STATUS"],
  ["2023-06-15", "dyspozycja zakupu", "TOS0626", 1001, 626, 30, 3000, "zrealizowana"],
  ["2023-06-15", "zakup papierów", "TOS0626", 1001, 626, 30, 3000, "zrealizowana"],
  ["2024-04-15", "dyspozycja zakupu", "EDO0432", 1002, 432, 50, 5000, "zrealizowana"],
  ["2024-04-15", "zakup papierów", "EDO0432", 1002, 432, 50, 5000, "zrealizowana"],
  ["2024-05-10", "dyspozycja zakupu", "EDO0432", 1003, 432, 20, 2000, "anulowana"],
  ["2025-08-28", "dyspozycja przedterminowego wykupu", "EDO0432", 0, 432, 10, 1000, "zrealizowana"],
  ["2025-09-01", "przedterminowy wykup", "EDO0432", 0, 432, 10, 1000, "zrealizowana"],
  ["2025-09-01", "odsetki", "EDO0432", 0, 432, 0, 95, "zrealizowana"],
  ["2025-09-01", "opłata za przedterminowy wykup", "EDO0432", 0, 432, 0, 20, "zrealizowana"],
  ["2025-09-05", "wypłata przelewem", "", 0, 0, 0, 500, "zrealizowana"],
];

describe("certification import parity", () => {
  it("XTB: 7 transactions, commissions in instrument currency, fx from observations", () => {
    const preview = parseXtbXlsx(XTB_ROWS, PORTFOLIO, references);
    expect(preview.errorRows).toHaveLength(0);
    expect(preview.validRows).toHaveLength(7);

    const byType = groupByType(preview.validRows);
    expect(byType.get("buy")).toHaveLength(3);
    expect(byType.get("sell")).toHaveLength(1);
    expect(byType.get("dividend")).toHaveLength(1);
    expect(byType.get("interest")).toHaveLength(1);
    expect(byType.get("cashDeposit")).toHaveLength(1);

    const vwceBuy = byType.get("buy")!.find((p) => p.currency === "EUR")!;
    expect(vwceBuy.quantity).toBe(100);
    expect(vwceBuy.price).toBe(100);
    expect(vwceBuy.grossAmount).toBe(10_000);
    expect(vwceBuy.fxRateToBase).toBeCloseTo(4.5, 4);
    expect(vwceBuy.fees).toBeCloseTo(10, 4);

    // CSPX buy in USD (fx 4.2, no commission); IEML buy in GBP (fx 5.2).
    const cspxBuy = byType.get("buy")!.find((p) => p.currency === "USD")!;
    expect(cspxBuy.fxRateToBase).toBeCloseTo(4.2, 4);
    expect(cspxBuy.fees).toBeCloseTo(0, 4);
    const iemlBuy = byType.get("buy")!.find((p) => p.currency === "GBP")!;
    expect(iemlBuy.fxRateToBase).toBeCloseTo(5.2, 4);

    const sell = byType.get("sell")![0];
    expect(sell.currency).toBe("EUR");
    expect(sell.grossAmount).toBeCloseTo(4_400, 2);
    expect(sell.fxRateToBase).toBeCloseTo(4.6, 4);
    expect(sell.fees).toBeCloseTo(10, 4);

    expect(byType.get("cashDeposit")![0].grossAmount).toBeCloseTo(100_000, 2);
  });

  it("PKO: buys + synthetic funding + early redemption with fee + interest + withdrawal", () => {
    const preview = parsePkoBondsXls(PKO_ROWS, PORTFOLIO, references);
    expect(preview.errorRows).toHaveLength(0);

    const byType = groupByType(preview.validRows);
    expect(byType.get("buy")).toHaveLength(2);
    expect(byType.get("sell")).toHaveLength(1);
    expect(byType.get("interest")).toHaveLength(1);
    expect(byType.get("cashWithdrawal")).toHaveLength(1);
    // PKO doesn't export the funding transfer; the parser synthesises deposits.
    expect((byType.get("cashDeposit")?.length ?? 0)).toBeGreaterThanOrEqual(1);

    const sell = byType.get("sell")![0];
    expect(sell.quantity).toBe(10);
    expect(sell.grossAmount).toBe(1_000);
    expect(sell.fees).toBe(20);
    expect(byType.get("interest")![0].grossAmount).toBe(95);
    expect(byType.get("cashWithdrawal")![0].grossAmount).toBe(500);
  });
});
