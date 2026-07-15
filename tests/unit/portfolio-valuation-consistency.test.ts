import { describe, expect, it } from "vitest";
import type { RecordType } from "@/domain/models/investor-data";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";
import {
  buildInstrumentList,
  buildInvestorDataSnapshot,
  buildPortfolioDetail,
} from "@/sync/records/investor-snapshot";

const portfolioID = "11111111-1111-4111-8111-111111111111";
const vwrlID = "22222222-2222-4222-8222-222222222222";
const icomID = "33333333-3333-4333-8333-333333333333";
const asOf = new Date("2026-07-15T18:05:00.000Z");

function record(type: RecordType, id: string, payload: unknown): DecryptedRecord {
  return {
    id,
    deviceId: "test",
    updatedAt: asOf.toISOString(),
    deletedAt: null,
    envelope: { type, payloadVersion: 1, schemaVersion: 1, payload },
  };
}

const vwrlQuantity = 38.4508;
const icomQuantity = 146.4252;
const vwrlValue = 26_527.6;
const icomValue = 5_278.8;

describe("IKE market valuation consistency", () => {
  it("uses XTB-compatible quotes and FX in the snapshot, detail and instrument list", () => {
    const records = [
      record("account", portfolioID, {
        recordType: "account",
        id: portfolioID,
        name: "IKE",
        baseCurrency: "PLN",
      }),
      record("asset", vwrlID, {
        recordType: "asset",
        id: vwrlID,
        kind: "etf",
        symbol: "VWRL.NL",
        name: "FTSE All-World",
        currency: "USD",
        isin: "IE00B3RBWM25",
        marketDataID: null,
      }),
      record("asset", icomID, {
        recordType: "asset",
        id: icomID,
        kind: "etf",
        symbol: "ICOM.UK",
        name: "Diversified Commodity Swap",
        currency: "USD",
        isin: "IE00BDFL4P12",
        marketDataID: null,
      }),
      record("transaction", "44444444-4444-4444-8444-444444444444", {
        recordType: "transaction",
        id: "44444444-4444-4444-8444-444444444444",
        date: asOf.toISOString(),
        portfolioID,
        instrumentID: null,
        transactionType: "cashDeposit",
        quantity: null,
        price: null,
        grossAmount: vwrlQuantity * 160.28 + icomQuantity * 9.52,
        currency: "USD",
        fees: 0,
        taxes: 0,
      }),
      record("transaction", "55555555-5555-4555-8555-555555555555", {
        recordType: "transaction",
        id: "55555555-5555-4555-8555-555555555555",
        date: asOf.toISOString(),
        portfolioID,
        instrumentID: vwrlID,
        transactionType: "buy",
        quantity: vwrlQuantity,
        price: 160.28,
        grossAmount: vwrlQuantity * 160.28,
        currency: "USD",
        fees: 0,
        taxes: 0,
      }),
      record("transaction", "66666666-6666-4666-8666-666666666666", {
        recordType: "transaction",
        id: "66666666-6666-4666-8666-666666666666",
        date: asOf.toISOString(),
        portfolioID,
        instrumentID: icomID,
        transactionType: "buy",
        quantity: icomQuantity,
        price: 9.52,
        grossAmount: icomQuantity * 9.52,
        currency: "USD",
        fees: 0,
        taxes: 0,
      }),
      record("transaction", "77777777-7777-4777-8777-777777777777", {
        recordType: "transaction",
        id: "77777777-7777-4777-8777-777777777777",
        date: asOf.toISOString(),
        portfolioID,
        instrumentID: null,
        transactionType: "cashDeposit",
        quantity: null,
        price: null,
        grossAmount: 2.71,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
    ];
    const options = {
      asOf,
      useMarketQuotes: true,
      marketQuotes: [
        { instrumentID: vwrlID, price: 131.25, currency: "GBP", date: asOf },
        { instrumentID: icomID, price: 8.6595, currency: "USD", date: asOf },
      ],
      fxRates: [
        { currency: "GBP", rate: vwrlValue / (vwrlQuantity * 131.25), date: asOf },
        { currency: "USD", rate: icomValue / (icomQuantity * 8.6595), date: asOf },
      ],
    };

    const snapshot = buildInvestorDataSnapshot(records, options);
    const detail = buildPortfolioDetail(records, portfolioID, options)!;
    const instruments = buildInstrumentList(records, options);

    expect(snapshot.totalValue).toBeCloseTo(31_809.11, 2);
    expect(detail.totalValue).toBeCloseTo(31_809.11, 2);
    const holdingValues = detail.holdings.map((holding) => holding.marketValue).sort((a, b) => b - a);
    expect(holdingValues[0]).toBeCloseTo(vwrlValue, 2);
    expect(holdingValues[1]).toBeCloseTo(icomValue, 2);
    const instrumentValues = instruments.map((instrument) => instrument.marketValue).sort((a, b) => b - a);
    expect(instrumentValues[0]).toBeCloseTo(vwrlValue, 2);
    expect(instrumentValues[1]).toBeCloseTo(icomValue, 2);
  });
});
