import type { RecordType } from "@/domain/models/investor-data";
import type { CpiSeries } from "@/domain/valuation/bond-rates";
import type { FxRateInput } from "@/domain/valuation/price-resolver";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";

// Certification scenario — web parity with the native suite
// (Zecca/docs/superpowers/plans/2026-07-09-portfolio-certification-scenario.md).
// Same inputs, same frozen anchor amounts. A divergence in the computed
// snapshot is a parity bug to report — never a number to "fix" here.
//
// Shared by the Task 2 unit test and the fake-sync e2e dataset
// (NEXT_PUBLIC_FAKE_SYNC_DATASET=certification). Both paths inject this frozen
// asOf/CPI/FX set, so exact IKE, IKZE and combined totals stay deterministic.

export const IKE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const IKZE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const TAXABLE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const VWCE_ID = "d0000000-0000-4000-8000-000000000001";
const CSPX_ID = "d0000000-0000-4000-8000-000000000002";
const IEML_ID = "d0000000-0000-4000-8000-000000000003";
const EDO_ID = "d0000000-0000-4000-8000-000000000004";
const TOS_ID = "d0000000-0000-4000-8000-000000000005";
const CDR_ID = "d0000000-0000-4000-8000-000000000006";
const PKN_ID = "d0000000-0000-4000-8000-000000000007";
const ALE_ID = "d0000000-0000-4000-8000-000000000008";
const LOKATA_A_ID = "d0000000-0000-4000-8000-000000000009";
const LOKATA_B_ID = "d0000000-0000-4000-8000-00000000000a";

export const ASOF = new Date("2026-07-01T00:00:00.000Z");

// Frozen FX (asOf): EUR 4.60, USD 4.20, GBP 5.30, PLN 1.
export const FX: FxRateInput[] = [
  { currency: "EUR", rate: 4.6, date: new Date("2026-07-01T00:00:00.000Z") },
  { currency: "USD", rate: 4.2, date: new Date("2026-07-01T00:00:00.000Z") },
  { currency: "GBP", rate: 5.3, date: new Date("2026-07-01T00:00:00.000Z") },
];

// Synthetic CPI of the scenario (reference month of a period = period start − 2m):
// EDO0432 period 2 (start 2025-04-15) → 2025-02 = 4.0; period 3 (start 2026-04-15)
// → 2026-02 = 3.0. Matches the native ValuationEngine cpiSeries input.
export const CPI: CpiSeries = { "2025-02": 4.0, "2026-02": 3.0 };

let generatedID = 0;
function nextID(): string {
  generatedID += 1;
  return `e0000000-0000-4000-8000-${String(generatedID).padStart(12, "0")}`;
}

function record(type: RecordType, id: string, payload: unknown): DecryptedRecord {
  return {
    id,
    deviceId: "certification",
    updatedAt: "2026-07-01T10:00:00.000Z",
    deletedAt: null,
    envelope: { type, payloadVersion: 1, schemaVersion: 1, payload },
  };
}

type TxInput = {
  date: string;
  portfolioID: string;
  transactionType: string;
  instrumentID?: string;
  quantity?: number;
  price?: number;
  grossAmount: number;
  currency?: string;
  fees?: number;
  taxes?: number;
  fxRateToBase?: number;
  /** Time-of-day for the timestamp. Only matters for treasury-bond accrual,
   * which the engine anchors to the lot's purchase timestamp — the EDO0432 buy
   * must sit at midnight so its period-start aligns to the frozen 77-day count
   * behind the 113.9566343151 dirty price. Defaults to 10:00. */
  time?: string;
};

function tx(input: TxInput): DecryptedRecord {
  const id = nextID();
  return record("transaction", id, {
    recordType: "transaction",
    id,
    date: `${input.date}T${input.time ?? "10:00:00.000"}Z`,
    portfolioID: input.portfolioID,
    instrumentID: input.instrumentID ?? null,
    transactionType: input.transactionType,
    quantity: input.quantity ?? null,
    price: input.price ?? null,
    grossAmount: input.grossAmount,
    currency: input.currency ?? "PLN",
    fees: input.fees ?? 0,
    taxes: input.taxes ?? 0,
    fxRateToBase: input.fxRateToBase ?? null,
  });
}

function manualValuation(
  instrumentID: string,
  value: number,
  currency: string,
): DecryptedRecord {
  const id = nextID();
  return record("manualValuation", id, {
    recordType: "manualValuation",
    id,
    instrumentID,
    date: "2026-06-30T00:00:00.000Z",
    value,
    currency,
  });
}

// [type, date, qty, price, gross, fees, taxes?] — dividends carry qty/price null.
type StockRow = [string, string, number | null, number | null, number, number, number?];

function stockRecords(portfolioID: string, instrumentID: string, rows: StockRow[]) {
  return rows.map(([type, date, qty, price, gross, fees, taxes]) =>
    tx({
      date,
      portfolioID,
      instrumentID,
      transactionType: type,
      quantity: qty ?? undefined,
      price: price ?? undefined,
      grossAmount: gross,
      fees,
      taxes: taxes ?? 0,
    }),
  );
}

export function buildCertificationRecords(): DecryptedRecord[] {
  generatedID = 0;

  const records: DecryptedRecord[] = [
    // --- Accounts ---
    record("account", IKE_ID, {
      recordType: "account",
      id: IKE_ID,
      name: "IKE ETF",
      accountType: "ike",
      baseCurrency: "PLN",
    }),
    record("account", IKZE_ID, {
      recordType: "account",
      id: IKZE_ID,
      name: "IKZE Obligacje",
      accountType: "ikze",
      baseCurrency: "PLN",
    }),
    record("account", TAXABLE_ID, {
      recordType: "account",
      id: TAXABLE_ID,
      name: "Portfel zwykły",
      accountType: "taxable",
      baseCurrency: "PLN",
    }),

    // --- Assets ---
    record("asset", VWCE_ID, {
      recordType: "asset",
      id: VWCE_ID,
      kind: "etf",
      symbol: "VWCE.DE",
      name: "Vanguard FTSE All-World UCITS ETF",
      currency: "EUR",
      category: "equity",
    }),
    record("asset", CSPX_ID, {
      recordType: "asset",
      id: CSPX_ID,
      kind: "etf",
      symbol: "CSPX.UK",
      name: "iShares Core S&P 500 UCITS ETF",
      currency: "USD",
      category: "equity",
    }),
    record("asset", IEML_ID, {
      recordType: "asset",
      id: IEML_ID,
      kind: "etf",
      symbol: "IEML.UK",
      name: "iShares EM Local Govt Bond UCITS ETF",
      currency: "GBP",
      category: "bonds",
    }),
    record("asset", EDO_ID, {
      recordType: "asset",
      id: EDO_ID,
      kind: "treasuryBond",
      symbol: "EDO0432",
      name: "Obligacje skarbowe EDO 8-letnie",
      currency: "PLN",
      category: "bonds",
      bondParams: {
        issueDate: "2024-04-15T00:00:00.000Z",
        maturityDate: "2032-04-15T00:00:00.000Z",
        nominalValue: 100,
        firstPeriodRate: 7.0,
        subsequentBase: "inflacja",
        marginOverBase: 1.5,
        capitalization: "roczna",
        interestPayment: "przy wykupie",
      },
    }),
    record("asset", TOS_ID, {
      recordType: "asset",
      id: TOS_ID,
      kind: "treasuryBond",
      symbol: "TOS0626",
      name: "Obligacje skarbowe TOS 3-letnie",
      currency: "PLN",
      category: "bonds",
      bondParams: {
        issueDate: "2023-06-15T00:00:00.000Z",
        maturityDate: "2026-06-15T00:00:00.000Z",
        nominalValue: 100,
        firstPeriodRate: 6.0,
        subsequentBase: "stała",
        marginOverBase: 6.0,
        capitalization: "roczna",
        interestPayment: "przy wykupie",
      },
    }),
    record("asset", CDR_ID, {
      recordType: "asset",
      id: CDR_ID,
      kind: "stock",
      symbol: "CDR",
      name: "CD Projekt",
      currency: "PLN",
      category: "equity",
    }),
    record("asset", PKN_ID, {
      recordType: "asset",
      id: PKN_ID,
      kind: "stock",
      symbol: "PKN",
      name: "Orlen",
      currency: "PLN",
      category: "equity",
    }),
    record("asset", ALE_ID, {
      recordType: "asset",
      id: ALE_ID,
      kind: "stock",
      symbol: "ALE",
      name: "Allegro",
      currency: "PLN",
      category: "equity",
    }),
    record("asset", LOKATA_A_ID, {
      recordType: "asset",
      id: LOKATA_A_ID,
      kind: "deposit",
      symbol: "LOKATA-A",
      name: "Lokata 3M (zakończona)",
      currency: "PLN",
      category: "deposit",
    }),
    record("asset", LOKATA_B_ID, {
      recordType: "asset",
      id: LOKATA_B_ID,
      kind: "deposit",
      symbol: "LOKATA-B",
      name: "Lokata 6M (aktywna)",
      currency: "PLN",
      category: "deposit",
    }),

    // --- IKE (XTB import: EUR/USD/GBP, historical fx per transaction) ---
    tx({ date: "2026-01-05", portfolioID: IKE_ID, transactionType: "cashDeposit", grossAmount: 100_000 }),
    tx({ date: "2026-01-10", portfolioID: IKE_ID, instrumentID: VWCE_ID, transactionType: "buy", quantity: 100, price: 100, grossAmount: 10_000, currency: "EUR", fees: 10, fxRateToBase: 4.5 }),
    tx({ date: "2026-02-03", portfolioID: IKE_ID, instrumentID: CSPX_ID, transactionType: "buy", quantity: 20, price: 500, grossAmount: 10_000, currency: "USD", fees: 0, fxRateToBase: 4.2 }),
    tx({ date: "2026-03-02", portfolioID: IKE_ID, instrumentID: IEML_ID, transactionType: "buy", quantity: 50, price: 20, grossAmount: 1_000, currency: "GBP", fees: 0, fxRateToBase: 5.2 }),
    tx({ date: "2026-04-15", portfolioID: IKE_ID, instrumentID: CSPX_ID, transactionType: "dividend", grossAmount: 210, taxes: 0 }),
    tx({ date: "2026-05-01", portfolioID: IKE_ID, transactionType: "interest", grossAmount: 10, taxes: 1.9 }),
    tx({ date: "2026-06-01", portfolioID: IKE_ID, instrumentID: VWCE_ID, transactionType: "sell", quantity: 40, price: 110, grossAmount: 4_400, currency: "EUR", fees: 10, fxRateToBase: 4.6 }),

    // --- IKZE (PKO import + native-side settlement, all PLN) ---
    tx({ date: "2023-06-15", portfolioID: IKZE_ID, transactionType: "cashDeposit", grossAmount: 3_000 }),
    tx({ date: "2023-06-15", portfolioID: IKZE_ID, instrumentID: TOS_ID, transactionType: "buy", quantity: 30, price: 100, grossAmount: 3_000 }),
    tx({ date: "2024-04-15", portfolioID: IKZE_ID, transactionType: "cashDeposit", grossAmount: 5_000 }),
    tx({ date: "2024-04-15", portfolioID: IKZE_ID, instrumentID: EDO_ID, transactionType: "buy", quantity: 50, price: 100, grossAmount: 5_000, time: "00:00:00.000" }),
    tx({ date: "2025-09-01", portfolioID: IKZE_ID, instrumentID: EDO_ID, transactionType: "sell", quantity: 10, price: 100, grossAmount: 1_000, fees: 20 }),
    tx({ date: "2025-09-01", portfolioID: IKZE_ID, instrumentID: EDO_ID, transactionType: "interest", grossAmount: 95 }),
    tx({ date: "2025-09-05", portfolioID: IKZE_ID, transactionType: "cashWithdrawal", grossAmount: 500 }),
    tx({ date: "2026-06-15", portfolioID: IKZE_ID, instrumentID: TOS_ID, transactionType: "bondRedemption", quantity: 30, price: 119.1016, grossAmount: 3_573.048, taxes: 0 }),

    // --- Portfel zwykły (manual trades + deposits, all PLN) ---
    tx({ date: "2026-01-02", portfolioID: TAXABLE_ID, transactionType: "cashDeposit", grossAmount: 60_000 }),
  ];

  // CDR (fee 5), PKN (fee 3), ALE (fee 4) — 1:1 with the native plan.
  records.push(
    ...stockRecords(TAXABLE_ID, CDR_ID, [
      ["buy", "2026-01-05", 10, 100, 1_000, 5],
      ["buy", "2026-01-12", 15, 110, 1_650, 5],
      ["buy", "2026-02-02", 5, 120, 600, 5],
      ["sell", "2026-02-16", 8, 125, 1_000, 5],
      ["buy", "2026-03-02", 10, 115, 1_150, 5],
      ["sell", "2026-03-16", 12, 130, 1_560, 5],
      ["dividend", "2026-04-01", null, null, 50, 0, 9.5],
      ["buy", "2026-04-13", 20, 105, 2_100, 5],
      ["sell", "2026-05-04", 10, 120, 1_200, 5],
      ["buy", "2026-05-18", 5, 100, 500, 5],
      ["sell", "2026-06-08", 5, 118, 590, 5],
      ["buy", "2026-06-22", 10, 108, 1_080, 5],
    ]),
    ...stockRecords(TAXABLE_ID, PKN_ID, [
      ["buy", "2026-01-07", 50, 60, 3_000, 3],
      ["buy", "2026-01-20", 30, 62, 1_860, 3],
      ["sell", "2026-02-04", 20, 65, 1_300, 3],
      ["buy", "2026-02-18", 40, 58, 2_320, 3],
      ["sell", "2026-03-04", 30, 66, 1_980, 3],
      ["buy", "2026-03-18", 20, 61, 1_220, 3],
      ["dividend", "2026-04-08", null, null, 120, 0, 22.8],
      ["sell", "2026-04-20", 25, 63, 1_575, 3],
      ["buy", "2026-05-06", 35, 59, 2_065, 3],
      ["sell", "2026-05-20", 15, 64, 960, 3],
      ["buy", "2026-06-03", 25, 62, 1_550, 3],
      ["sell", "2026-06-17", 10, 65, 650, 3],
      ["buy", "2026-06-29", 10, 63, 630, 3],
    ]),
    ...stockRecords(TAXABLE_ID, ALE_ID, [
      ["buy", "2026-01-09", 100, 30, 3_000, 4],
      ["buy", "2026-01-23", 50, 32, 1_600, 4],
      ["sell", "2026-02-06", 40, 35, 1_400, 4],
      ["buy", "2026-02-20", 60, 29, 1_740, 4],
      ["sell", "2026-03-06", 50, 33, 1_650, 4],
      ["buy", "2026-03-20", 40, 31, 1_240, 4],
      ["sell", "2026-04-10", 30, 34, 1_020, 4],
      ["buy", "2026-04-24", 30, 30, 900, 4],
      ["sell", "2026-05-08", 20, 36, 720, 4],
      ["buy", "2026-05-22", 50, 28, 1_400, 4],
      ["sell", "2026-06-05", 25, 35, 875, 4],
      ["buy", "2026-06-19", 20, 33, 660, 4],
    ]),
  );

  records.push(
    // Lokata A: opened, then closed on maturity (native-side settlement).
    // gross 20360 = 20000 principal + 360 interest; Belka tax 68.40 → cash in 20291.60.
    tx({ date: "2026-04-01", portfolioID: TAXABLE_ID, instrumentID: LOKATA_A_ID, transactionType: "depositOpen", grossAmount: 20_000 }),
    tx({ date: "2026-06-30", portfolioID: TAXABLE_ID, instrumentID: LOKATA_A_ID, transactionType: "depositClose", quantity: 1, price: 20_360, grossAmount: 20_360, taxes: 68.4 }),
    // Lokata B: still open, valued at principal on asOf (pinned below).
    tx({ date: "2026-03-01", portfolioID: TAXABLE_ID, instrumentID: LOKATA_B_ID, transactionType: "depositOpen", grossAmount: 15_000 }),
  );

  // --- Pinned latest prices (asset currency). EDO0432/TOS0626 are NOT pinned:
  // EDO is valued by the CPI accrual formula; TOS is fully redeemed (qty 0). ---
  records.push(
    manualValuation(VWCE_ID, 110, "EUR"),
    manualValuation(CSPX_ID, 520, "USD"),
    manualValuation(IEML_ID, 22, "GBP"),
    manualValuation(CDR_ID, 112, "PLN"),
    manualValuation(PKN_ID, 64, "PLN"),
    manualValuation(ALE_ID, 32, "PLN"),
    manualValuation(LOKATA_B_ID, 15_000, "PLN"),
  );

  return records;
}
