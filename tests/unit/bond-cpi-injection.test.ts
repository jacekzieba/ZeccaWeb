import { describe, expect, it } from "vitest";
import {
  valueInstrumentPosition,
  type BondParamsInput,
  type PositionValuationDataset,
} from "@/domain/valuation/position-valuator";
import { buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";
import type { RecordType } from "@/domain/models/investor-data";

// Syntetyczne CPI scenariusza: miesiąc referencyjny okresu = start okresu − 2 mies.
// Okres 2 (start 2025-04-15) → 2025-02 = 4.0; okres 3 (start 2026-04-15) → 2026-02 = 3.0.
const scenarioCpi = { "2025-02": 4.0, "2026-02": 3.0 };

const DATASET_WITH_CPI: PositionValuationDataset = {
  manualValuations: [],
  marketQuotes: [],
  transactions: [],
  fxRates: [],
  cpi: scenarioCpi,
};

const DATASET_NO_CPI: PositionValuationDataset = {
  manualValuations: [],
  marketQuotes: [],
  transactions: [],
  fxRates: [],
};

// EDO0432 z certyfikacyjnego scenariusza (jak w natywnym teście Zecca):
// emisja 2024-04-15, kupno 2024-04-15, first 7.0%, indeksacja inflacją, marża 1.5%,
// kapitalizacja roczna, odsetki przy wykupie. asOf 2026-07-01.
const edoParams: BondParamsInput = {
  maturityDate: new Date("2032-04-15T00:00:00.000Z"),
  nominalValue: 100,
  firstPeriodRate: 7.0,
  subsequentBase: "inflacja",
  marginOverBase: 1.5,
  capitalization: "roczna",
  interestPayment: "przy wykupie",
};
const purchase = new Date("2024-04-15T00:00:00.000Z");
const asOf = new Date("2026-07-01T00:00:00.000Z");

function unitPrice(dataset: PositionValuationDataset): number {
  return valueInstrumentPosition({
    instrumentID: "00000000-0000-4000-8000-000000000000",
    quantity: 1,
    asset: { kind: "treasuryBond", currency: "PLN", bondParams: edoParams },
    lots: [{ purchaseDate: purchase, quantity: 1 }],
    dataset,
    asOf,
  }).price;
}

describe("treasury bond valuation honours injected CPI series", () => {
  it("rounds the published EDO0432 dirty price to a grosz per bond", () => {
    // Raw: 100 ×1.07 →107; ×(4.0+1.5)% →112.885;
    // +112.885×4.5%×77/365 →113.9566343151. PKO publishes 113.96 per bond.
    expect(unitPrice(DATASET_WITH_CPI)).toBe(113.96);
  });

  it("falls back to the hardcoded GUS table when no CPI is injected", () => {
    // Zaszyta tabela: 2025-02 = 5.4 (nie 4.0); 2026-02 = 2.1 → 3.6% z marżą.
    // Raw: 100 ×1.07 →107; ×(5.4+1.5)% →114.383;
    // +114.383×3.6%×77/365 →115.2517. Inny wynik niż scenariusz dowodzi,
    // że wstrzyknięcie faktycznie działa.
    const fallback = unitPrice(DATASET_NO_CPI);
    expect(fallback).toBe(115.25);
    expect(fallback).not.toBe(113.96);
  });
});

const accountID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const edoID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function record(type: RecordType, id: string, payload: unknown): DecryptedRecord {
  return {
    id,
    deviceId: "test",
    updatedAt: "2026-06-30T10:00:00.000Z",
    deletedAt: null,
    envelope: { type, payloadVersion: 1, schemaVersion: 1, payload },
  };
}

function edoPortfolioRecords(): DecryptedRecord[] {
  return [
    record("account", accountID, {
      recordType: "account",
      id: accountID,
      name: "IKZE Obligacje",
      accountType: "ikze",
      baseCurrency: "PLN",
    }),
    record("asset", edoID, {
      recordType: "asset",
      id: edoID,
      kind: "treasuryBond",
      symbol: "EDO0432",
      name: "EDO 8-letnie",
      currency: "PLN",
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
    record("transaction", "cccccccc-cccc-4ccc-8ccc-cccccccccccc", {
      recordType: "transaction",
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      date: "2024-04-15T10:00:00.000Z",
      portfolioID: accountID,
      instrumentID: null,
      transactionType: "cashDeposit",
      grossAmount: 4000,
      currency: "PLN",
      fees: 0,
      taxes: 0,
    }),
    record("transaction", "dddddddd-dddd-4ddd-8ddd-dddddddddddd", {
      recordType: "transaction",
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      date: "2024-04-15T00:00:00.000Z",
      portfolioID: accountID,
      instrumentID: edoID,
      transactionType: "buy",
      quantity: 40,
      price: 100,
      grossAmount: 4000,
      currency: "PLN",
      fees: 0,
      taxes: 0,
    }),
  ];
}

describe("buildInvestorDataSnapshot threads injected CPI to bond valuation", () => {
  const asOf = new Date("2026-07-01T00:00:00.000Z");

  it("values an EDO0432 position with the injected scenario CPI", () => {
    const snapshot = buildInvestorDataSnapshot(edoPortfolioRecords(), {
      asOf,
      cpi: scenarioCpi,
    });
    // Cash 0 (4000 deposit − 4000 buy) → portfolio value = 40 × dirty price.
    // PKO rounds the unit price first: 40 × 113.96 = 4558.40.
    expect(snapshot.portfolios[0].value).toBe(4558.4);
  });
});
