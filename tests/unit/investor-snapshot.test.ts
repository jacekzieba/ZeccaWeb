import { describe, expect, it } from "vitest";
import type { RecordType } from "@/domain/models/investor-data";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";
import {
  buildIncomeLists,
  buildInstrumentList,
  buildInvestorDataSnapshot,
  buildPortfolioDetail,
  buildTransactionList,
} from "@/sync/records/investor-snapshot";
import { findDuplicateEarning } from "@/domain/models/earnings";

const accountID = "11111111-1111-4111-8111-111111111111";
const instrumentID = "22222222-2222-4222-8222-222222222222";
const usdInstrumentID = "77777777-7777-4777-8777-777777777777";

function record(
  type: RecordType,
  id: string,
  payload: unknown,
  updatedAt = "2026-05-15T10:00:00.000Z",
): DecryptedRecord {
  return {
    id,
    deviceId: "test",
    updatedAt,
    deletedAt: null,
    envelope: {
      type,
      payloadVersion: 1,
      schemaVersion: 1,
      payload,
    },
  };
}

describe("InvestorDataSnapshot mapper", () => {
  it("builds dashboard values from decrypted sync records", () => {
    const snapshot = buildInvestorDataSnapshot([
      record("account", accountID, {
        recordType: "account",
        id: accountID,
        name: "Core ETF",
        accountType: "Własny",
        baseCurrency: "PLN",
        colorHex: "#7EA16B",
        targetAllocation: {},
      }),
      record("asset", instrumentID, {
        recordType: "asset",
        id: instrumentID,
        kind: "etf",
        symbol: "VWCE",
        name: "Vanguard FTSE All-World",
        currency: "PLN",
      }),
      record("transaction", "33333333-3333-4333-8333-333333333333", {
        recordType: "transaction",
        id: "33333333-3333-4333-8333-333333333333",
        date: "2026-04-01T10:00:00.000Z",
        portfolioID: accountID,
        instrumentID: null,
        transactionType: "cashDeposit",
        quantity: null,
        price: null,
        grossAmount: 10_000,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
      record("transaction", "44444444-4444-4444-8444-444444444444", {
        recordType: "transaction",
        id: "44444444-4444-4444-8444-444444444444",
        date: "2026-04-02T10:00:00.000Z",
        portfolioID: accountID,
        instrumentID,
        transactionType: "buy",
        quantity: 10,
        price: 100,
        grossAmount: 1_000,
        currency: "PLN",
        fees: 5,
        taxes: 0,
      }),
      record("manualValuation", "55555555-5555-4555-8555-555555555555", {
        recordType: "manualValuation",
        id: "55555555-5555-4555-8555-555555555555",
        instrumentID,
        date: "2026-05-01T10:00:00.000Z",
        value: 120,
        currency: "PLN",
      }),
    ]);

    expect(snapshot.totalValue).toBe(10_195);
    expect(snapshot.cash).toBe(8_995);
    expect(snapshot.portfolios).toEqual([
      {
        id: accountID,
        name: "Core ETF",
        baseCurrency: "PLN",
        value: 10_195,
        dailyChange: 0,
        positions: 1,
        sparkline: expect.any(Array),
      },
    ]);
    expect(snapshot.allocation.map((slice) => slice.label)).toEqual([
      "Gotówka",
      "Akcje / ETF",
    ]);
    expect(snapshot.allocation[0]?.percent).toBeCloseTo(88.2295, 4);
    expect(snapshot.allocation[1]?.percent).toBeCloseTo(11.7705, 4);
    expect(snapshot.valuationSeries.at(-1)).toEqual({
      label: "maj",
      date: "2026-05-15T10:00:00.000Z",
      value: 10_195,
    });
    expect(snapshot.valuationSeries).toContainEqual({
      label: "kwi",
      date: "2026-04-30T00:00:00.000Z",
      value: 9_995,
    });
  });

  it("accepts macOS refactor payload fields without changing portfolio values", () => {
    const snapshot = buildInvestorDataSnapshot([
      record("account", accountID, {
        recordType: "account",
        id: accountID,
        name: "Refactor Account",
        accountType: "custom",
        baseCurrency: "PLN",
        colorHex: "#7EA16B",
        targetAllocation: { equity: 80, cash: 20 },
      }),
      record("asset", instrumentID, {
        recordType: "asset",
        id: instrumentID,
        kind: "stock",
        symbol: "AAPL",
        name: "Apple",
        currency: "USD",
        exchange: "NASDAQ",
        country: "US",
        isin: null,
        category: "equity",
        marketDataID: "AAPL",
        bondParams: null,
        listedBondParams: null,
        depositParams: null,
      }),
      record("transaction", "33333333-3333-4333-8333-333333333333", {
        recordType: "transaction",
        id: "33333333-3333-4333-8333-333333333333",
        date: "2026-05-20T00:00:00.000Z",
        bookingDate: null,
        portfolioID: accountID,
        instrumentID,
        transactionType: "buy",
        quantity: 2,
        price: 100,
        grossAmount: 200,
        currency: "USD",
        fees: 0,
        taxes: 0,
        fxRateToBase: 4,
        targetCurrency: null,
        targetGrossAmount: null,
        notes: "macOS refactor payload",
        externalImportID: null,
        sourcePortfolioID: null,
        transferKind: null,
        transferSourceKind: null,
        contributionTreatment: null,
        transferCostBasisMode: null,
        transferLots: null,
        createdAt: "2026-05-20T00:00:00.000Z",
        updatedAt: "2026-05-20T00:00:00.000Z",
      }),
      record("manualValuation", "55555555-5555-4555-8555-555555555555", {
        recordType: "manualValuation",
        id: "55555555-5555-4555-8555-555555555555",
        instrumentID,
        date: "2026-05-21T00:00:00.000Z",
        value: 110,
        currency: "USD",
        note: "close",
        createdAt: "2026-05-21T00:00:00.000Z",
        updatedAt: "2026-05-21T00:00:00.000Z",
      }),
      record("settings", "88888888-8888-4888-8888-888888888888", {
        recordType: "settings",
        id: "B2AA7BD4-A95D-4D80-90F9-787B8A1EC401",
        syncMode: "cloud",
        accountProvider: "none",
        telemetryEnabled: true,
        hasAcknowledgedPrivacyDisclosure: true,
        baseCurrency: "PLN",
        showBelkaTax: true,
        useFIFO: true,
        showRealReturns: true,
        autoRefreshEnabled: true,
        selectedProvider: "Yahoo Finance",
        fxProvider: "NBP",
        inflationRegion: "PL",
        appLanguage: "pl",
        updatedAt: "2026-05-21T00:00:00.000Z",
      }),
    ]);

    expect(snapshot.totalValue).toBe(80);
    expect(snapshot.portfolios[0]).toMatchObject({
      id: accountID,
      name: "Refactor Account",
      baseCurrency: "PLN",
      value: 80,
      positions: 1,
    });
  });

  it("ignores synced market quotes by default for macOS parity", () => {
    const records = [
      record("account", accountID, {
        recordType: "account",
        id: accountID,
        name: "Market Account",
        accountType: "custom",
        baseCurrency: "PLN",
        colorHex: "#7EA16B",
        targetAllocation: {},
      }),
      record("asset", instrumentID, {
        recordType: "asset",
        id: instrumentID,
        kind: "etf",
        symbol: "VWRL.NL",
        name: "Vanguard FTSE All-World",
        currency: "EUR",
      }),
      record("transaction", "77777777-7777-4777-8777-777777777771", {
        recordType: "transaction",
        id: "77777777-7777-4777-8777-777777777771",
        date: "2026-04-30T00:00:00.000Z",
        portfolioID: accountID,
        instrumentID: null,
        transactionType: "cashDeposit",
        quantity: null,
        price: null,
        grossAmount: 200,
        currency: "EUR",
        fees: 0,
        taxes: 0,
        fxRateToBase: 4,
      }),
      record("transaction", "33333333-3333-4333-8333-333333333333", {
        recordType: "transaction",
        id: "33333333-3333-4333-8333-333333333333",
        date: "2026-05-01T00:00:00.000Z",
        portfolioID: accountID,
        instrumentID,
        transactionType: "buy",
        quantity: 2,
        price: 100,
        grossAmount: 200,
        currency: "EUR",
        fees: 0,
        taxes: 0,
        fxRateToBase: 4,
      }),
      record("marketQuote", "66666666-6666-4666-8666-666666666666", {
        recordType: "marketQuote",
        id: "66666666-6666-4666-8666-666666666666",
        instrumentID,
        date: "2026-05-15T00:00:00.000Z",
        price: 130,
        currency: "EUR",
        source: "native-cache",
      }),
    ];

    const snapshot = buildInvestorDataSnapshot(records);
    const instruments = buildInstrumentList(records);

    expect(snapshot.totalValue).toBe(800);
    expect(instruments[0]).toMatchObject({
      lastPrice: 100,
      valuationSource: "transaction",
      valuationSourceLabel: "Cena transakcyjna",
      marketValue: 800,
    });
  });

  it("states value and return in the chosen display currency (USD vs PLN)", () => {
    // Bought 10 USD shares at $5 when USD/PLN was 4 (cost 200 PLN). Now the
    // share is $5.50 and USD/PLN is 5: value is $55 / 275 PLN. The PLN view
    // earns +37.5% (price + FX), the USD view earns +10% (price only).
    const records = [
      record("account", accountID, {
        recordType: "account",
        id: accountID,
        name: "FX Account",
        accountType: "custom",
        baseCurrency: "PLN",
        targetAllocation: {},
      }),
      record("asset", usdInstrumentID, {
        recordType: "asset",
        id: usdInstrumentID,
        kind: "etf",
        symbol: "VOO",
        name: "Vanguard S&P 500",
        currency: "USD",
      }),
      record("transaction", "aaaaaaaa-0000-4000-8000-000000000001", {
        recordType: "transaction",
        id: "aaaaaaaa-0000-4000-8000-000000000001",
        date: "2026-01-01T00:00:00.000Z",
        portfolioID: accountID,
        instrumentID: null,
        transactionType: "cashDeposit",
        quantity: null,
        price: null,
        // A buy settles in PLN (200 = 50 USD × 4), so fund it with 200 PLN to
        // leave zero residual cash.
        grossAmount: 200,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
      record("transaction", "aaaaaaaa-0000-4000-8000-000000000002", {
        recordType: "transaction",
        id: "aaaaaaaa-0000-4000-8000-000000000002",
        date: "2026-01-01T00:00:00.000Z",
        portfolioID: accountID,
        instrumentID: usdInstrumentID,
        transactionType: "buy",
        quantity: 10,
        price: 5,
        grossAmount: 50,
        currency: "USD",
        fees: 0,
        taxes: 0,
        fxRateToBase: 4,
      }),
      record("marketQuote", "aaaaaaaa-0000-4000-8000-000000000003", {
        recordType: "marketQuote",
        id: "aaaaaaaa-0000-4000-8000-000000000003",
        instrumentID: usdInstrumentID,
        date: "2026-06-01T00:00:00.000Z",
        price: 5.5,
        currency: "USD",
        source: "native-cache",
      }),
    ];

    const fxRates = [
      { currency: "USD", rate: 4, date: new Date("2026-01-01T00:00:00.000Z") },
      { currency: "USD", rate: 5, date: new Date("2026-06-01T00:00:00.000Z") },
    ];
    const options = {
      asOf: new Date("2026-06-01T00:00:00.000Z"),
      historyGranularity: "daily" as const,
      useMarketQuotes: true,
      fxRates,
    };

    const pln = buildInvestorDataSnapshot(records, options);
    const usd = buildInvestorDataSnapshot(records, {
      ...options,
      displayCurrency: "USD",
    });

    expect(pln.totalValue).toBeCloseTo(275, 5);
    expect(usd.totalValue).toBeCloseTo(55, 5);
    // The display currency only rescales by the as-of rate for point values.
    expect(pln.totalValue / usd.totalValue).toBeCloseTo(5, 5);

    // Returns diverge: PLN captures the FX gain, USD does not.
    expect(pln.metrics.totalReturnPct).toBeCloseTo(37.5, 1);
    expect(usd.metrics.totalReturnPct).toBeCloseTo(10, 1);
  });

  it("can opt into synced market quotes for current instrument valuation", () => {
    const records = [
      record("account", accountID, {
        recordType: "account",
        id: accountID,
        name: "Market Account",
        accountType: "custom",
        baseCurrency: "PLN",
        colorHex: "#7EA16B",
        targetAllocation: {},
      }),
      record("asset", instrumentID, {
        recordType: "asset",
        id: instrumentID,
        kind: "etf",
        symbol: "VWRL.NL",
        name: "Vanguard FTSE All-World",
        currency: "EUR",
      }),
      record("transaction", "77777777-7777-4777-8777-777777777771", {
        recordType: "transaction",
        id: "77777777-7777-4777-8777-777777777771",
        date: "2026-04-30T00:00:00.000Z",
        portfolioID: accountID,
        instrumentID: null,
        transactionType: "cashDeposit",
        quantity: null,
        price: null,
        grossAmount: 200,
        currency: "EUR",
        fees: 0,
        taxes: 0,
        fxRateToBase: 4,
      }),
      record("transaction", "33333333-3333-4333-8333-333333333333", {
        recordType: "transaction",
        id: "33333333-3333-4333-8333-333333333333",
        date: "2026-05-01T00:00:00.000Z",
        portfolioID: accountID,
        instrumentID,
        transactionType: "buy",
        quantity: 2,
        price: 100,
        grossAmount: 200,
        currency: "EUR",
        fees: 0,
        taxes: 0,
        fxRateToBase: 4,
      }),
      record("marketQuote", "66666666-6666-4666-8666-666666666666", {
        recordType: "marketQuote",
        id: "66666666-6666-4666-8666-666666666666",
        instrumentID,
        date: "2026-05-15T00:00:00.000Z",
        price: 130,
        currency: "EUR",
      }),
    ];

    const snapshot = buildInvestorDataSnapshot(records, { useMarketQuotes: true });
    const instruments = buildInstrumentList(records, { useMarketQuotes: true });

    expect(snapshot.totalValue).toBe(1_040);

    expect(instruments[0]).toMatchObject({
      lastPrice: 130,
      valuationSource: "market",
      valuationSourceLabel: "Cena rynkowa",
      marketValue: 1_040,
    });
  });

  it("uses synced market quotes for live portfolio values when enabled", () => {
    const secondAccountID = "99999999-9999-4999-8999-999999999990";
    const records = [
      record("account", accountID, {
        recordType: "account",
        id: accountID,
        name: "IKE",
        baseCurrency: "PLN",
      }),
      record("account", secondAccountID, {
        recordType: "account",
        id: secondAccountID,
        name: "Obligacje",
        baseCurrency: "PLN",
      }),
      record("asset", instrumentID, {
        recordType: "asset",
        id: instrumentID,
        kind: "etf",
        symbol: "ETF",
        name: "ETF",
        currency: "PLN",
      }),
      record("transaction", "22222222-2222-4222-8222-222222222222", {
        recordType: "transaction",
        id: "22222222-2222-4222-8222-222222222222",
        date: "2026-04-30T00:00:00.000Z",
        portfolioID: accountID,
        instrumentID: null,
        transactionType: "cashDeposit",
        grossAmount: 1_000,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
      record("transaction", "33333333-3333-4333-8333-333333333333", {
        recordType: "transaction",
        id: "33333333-3333-4333-8333-333333333333",
        date: "2026-05-01T00:00:00.000Z",
        portfolioID: accountID,
        instrumentID,
        transactionType: "buy",
        quantity: 10,
        price: 100,
        grossAmount: 1_000,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
      record("transaction", "44444444-4444-4444-8444-444444444444", {
        recordType: "transaction",
        id: "44444444-4444-4444-8444-444444444444",
        date: "2026-05-01T00:00:00.000Z",
        portfolioID: secondAccountID,
        instrumentID: null,
        transactionType: "cashDeposit",
        grossAmount: 500,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
      record("marketQuote", "66666666-6666-4666-8666-666666666666", {
        recordType: "marketQuote",
        id: "66666666-6666-4666-8666-666666666666",
        instrumentID,
        date: "2026-05-15T00:00:00.000Z",
        price: 125,
        currency: "PLN",
      }),
    ];

    const snapshot = buildInvestorDataSnapshot(records, { useMarketQuotes: true });

    expect(snapshot.totalValue).toBe(1_750);
    expect(snapshot.portfolios).toEqual([
      expect.objectContaining({ name: "IKE", value: 1_250 }),
      expect.objectContaining({ name: "Obligacje", value: 500 }),
    ]);
  });

  it("reconciles XTB IKE ETF holdings from synced live quotes and cash", () => {
    const commodityID = "99999999-9999-4999-8999-999999999981";
    const allWorldID = "99999999-9999-4999-8999-999999999982";
    const records = [
      record("account", accountID, {
        recordType: "account",
        id: accountID,
        name: "Moje IKE",
        baseCurrency: "PLN",
      }),
      record("asset", commodityID, {
        recordType: "asset",
        id: commodityID,
        kind: "etf",
        symbol: "ICOM.UK",
        name: "iShares Diversified Commodity Swap",
        currency: "USD",
      }),
      record("asset", allWorldID, {
        recordType: "asset",
        id: allWorldID,
        kind: "etf",
        symbol: "VWRL.NL",
        name: "Vanguard FTSE All-World",
        currency: "EUR",
      }),
      record("transaction", "99999999-9999-4999-8999-999999999983", {
        recordType: "transaction",
        id: "99999999-9999-4999-8999-999999999983",
        date: "2026-06-05T09:59:00.000Z",
        portfolioID: accountID,
        instrumentID: null,
        transactionType: "cashDeposit",
        grossAmount: 2.17,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
      record("transaction", "99999999-9999-4999-8999-999999999984", {
        recordType: "transaction",
        id: "99999999-9999-4999-8999-999999999984",
        date: "2026-06-05T09:59:00.000Z",
        portfolioID: accountID,
        instrumentID: commodityID,
        transactionType: "accountTransferIn",
        quantity: 146.4252,
        price: 8.6595,
        grossAmount: 0,
        currency: "USD",
        fees: 0,
        taxes: 0,
        transferKind: "asset",
      }),
      record("transaction", "99999999-9999-4999-8999-999999999985", {
        recordType: "transaction",
        id: "99999999-9999-4999-8999-999999999985",
        date: "2026-06-05T09:59:00.000Z",
        portfolioID: accountID,
        instrumentID: allWorldID,
        transactionType: "accountTransferIn",
        quantity: 38.2636,
        price: 131.11,
        grossAmount: 0,
        currency: "EUR",
        fees: 0,
        taxes: 0,
        transferKind: "asset",
      }),
      record("marketQuote", "99999999-9999-4999-8999-999999999986", {
        recordType: "marketQuote",
        id: "99999999-9999-4999-8999-999999999986",
        instrumentID: commodityID,
        date: "2026-06-05T09:59:00.000Z",
        price: 8.6595,
        currency: "USD",
      }),
      record("marketQuote", "99999999-9999-4999-8999-999999999987", {
        recordType: "marketQuote",
        id: "99999999-9999-4999-8999-999999999987",
        instrumentID: allWorldID,
        date: "2026-06-05T09:59:00.000Z",
        price: 131.11,
        currency: "EUR",
      }),
    ];

    const options = {
      useMarketQuotes: true,
      asOf: new Date("2026-06-05T09:59:00.000Z"),
      fxRates: [
        {
          currency: "USD",
          rate: 5286.91 / (146.4252 * 8.6595),
          date: new Date("2026-06-05T00:00:00.000Z"),
        },
        {
          currency: "EUR",
          rate: 25578.72 / (38.2636 * 131.11),
          date: new Date("2026-06-05T00:00:00.000Z"),
        },
      ],
    };

    const snapshot = buildInvestorDataSnapshot(records, options);
    const detail = buildPortfolioDetail(records, accountID, options);

    expect(snapshot.totalValue).toBeCloseTo(30_867.8, 2);
    expect(snapshot.cash).toBeCloseTo(2.17, 2);
    expect(snapshot.portfolios[0]?.value).toBeCloseTo(30_867.8, 2);
    expect(detail?.holdings).toEqual([
      expect.objectContaining({
        symbol: "VWRL.NL",
        quantity: 38.2636,
        lastPrice: 131.11,
        marketValue: expect.closeTo(25_578.72, 2),
        valuationSource: "market",
      }),
      expect.objectContaining({
        symbol: "ICOM.UK",
        quantity: 146.4252,
        lastPrice: 8.6595,
        marketValue: expect.closeTo(5_286.91, 2),
        valuationSource: "market",
      }),
    ]);
  });

  it("keeps same-day cash deposits out of per-portfolio daily change", () => {
    const records = [
      record("account", accountID, {
        recordType: "account",
        id: accountID,
        name: "Core",
        baseCurrency: "PLN",
      }),
      record("transaction", "33333333-3333-4333-8333-333333333333", {
        recordType: "transaction",
        id: "33333333-3333-4333-8333-333333333333",
        date: "2026-05-14T10:00:00.000Z",
        portfolioID: accountID,
        transactionType: "cashDeposit",
        grossAmount: 1_000,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
      record("transaction", "44444444-4444-4444-8444-444444444444", {
        recordType: "transaction",
        id: "44444444-4444-4444-8444-444444444444",
        date: "2026-05-15T10:00:00.000Z",
        portfolioID: accountID,
        transactionType: "cashDeposit",
        grossAmount: 500,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
    ];

    const snapshot = buildInvestorDataSnapshot(records);

    expect(snapshot.portfolios[0]?.value).toBe(1_500);
    expect(snapshot.portfolios[0]?.dailyChange).toBe(0);
  });

  it("computes total return and max drawdown from performance, not raw deposits", () => {
    const records = [
      record("account", accountID, {
        recordType: "account",
        id: accountID,
        name: "Core",
        baseCurrency: "PLN",
      }),
      record("asset", instrumentID, {
        recordType: "asset",
        id: instrumentID,
        kind: "etf",
        symbol: "ETF",
        name: "ETF",
        currency: "PLN",
      }),
      record("transaction", "33333333-3333-4333-8333-333333333333", {
        recordType: "transaction",
        id: "33333333-3333-4333-8333-333333333333",
        date: "2026-05-01T10:00:00.000Z",
        portfolioID: accountID,
        transactionType: "cashDeposit",
        grossAmount: 1_000,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
      record("transaction", "44444444-4444-4444-8444-444444444444", {
        recordType: "transaction",
        id: "44444444-4444-4444-8444-444444444444",
        date: "2026-05-01T10:00:00.000Z",
        portfolioID: accountID,
        instrumentID,
        transactionType: "buy",
        quantity: 10,
        price: 100,
        grossAmount: 1_000,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
      record("manualValuation", "55555555-5555-4555-8555-555555555555", {
        recordType: "manualValuation",
        id: "55555555-5555-4555-8555-555555555555",
        instrumentID,
        date: "2026-05-02T10:00:00.000Z",
        value: 90,
        currency: "PLN",
      }),
      record("transaction", "66666666-6666-4666-8666-666666666666", {
        recordType: "transaction",
        id: "66666666-6666-4666-8666-666666666666",
        date: "2026-05-03T10:00:00.000Z",
        portfolioID: accountID,
        transactionType: "cashDeposit",
        grossAmount: 9_000,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
    ];

    const snapshot = buildInvestorDataSnapshot(records, {
      asOf: new Date("2026-05-04T10:00:00.000Z"),
      historyGranularity: "daily",
    });

    expect(snapshot.totalValue).toBe(9_900);
    expect(snapshot.metrics.totalReturnPct).toBeCloseTo(-10, 5);
    expect(snapshot.metrics.maxDrawdownPct).toBeCloseTo(-10, 5);
  });

  it("treats an inter-account cash transfer as a flow, not performance", () => {
    const records = [
      record("account", accountID, {
        recordType: "account",
        id: accountID,
        name: "Core",
        baseCurrency: "PLN",
      }),
      record("transaction", "33333333-3333-4333-8333-333333333333", {
        recordType: "transaction",
        id: "33333333-3333-4333-8333-333333333333",
        date: "2026-05-01T10:00:00.000Z",
        portfolioID: accountID,
        transactionType: "cashDeposit",
        grossAmount: 1_000,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
      record("transaction", "44444444-4444-4444-8444-444444444444", {
        recordType: "transaction",
        id: "44444444-4444-4444-8444-444444444444",
        date: "2026-05-02T10:00:00.000Z",
        portfolioID: accountID,
        transactionType: "accountTransferIn",
        grossAmount: 1_000,
        currency: "PLN",
        fees: 0,
        taxes: 0,
        transferKind: "cash",
        // Flagged by the user as genuine new capital, so it counts as invested.
        contributionTreatment: "countAsContribution",
      }),
    ];

    const snapshot = buildInvestorDataSnapshot(records, {
      asOf: new Date("2026-05-02T10:00:00.000Z"),
      historyGranularity: "daily",
    });

    // Value doubled (1000 -> 2000) purely because capital moved in from another
    // account. That is a contribution, not a +100% return, so the time-weighted
    // metrics must stay flat and the flagged transfer must count as invested.
    expect(snapshot.totalValue).toBe(2_000);
    expect(snapshot.metrics.totalReturnPct).toBeCloseTo(0, 5);
    expect(snapshot.metrics.maxDrawdownPct).toBeCloseTo(0, 5);
    expect(snapshot.metrics.netInvested).toBeCloseTo(2_000, 5);
  });

  it("excludes an unflagged inter-account transfer from net contributions", () => {
    const records = [
      record("account", accountID, {
        recordType: "account",
        id: accountID,
        name: "Core",
        baseCurrency: "PLN",
      }),
      record("transaction", "33333333-3333-4333-8333-333333333333", {
        recordType: "transaction",
        id: "33333333-3333-4333-8333-333333333333",
        date: "2026-05-01T10:00:00.000Z",
        portfolioID: accountID,
        transactionType: "cashDeposit",
        grossAmount: 1_000,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
      record("transaction", "44444444-4444-4444-8444-444444444444", {
        recordType: "transaction",
        id: "44444444-4444-4444-8444-444444444444",
        date: "2026-05-02T10:00:00.000Z",
        portfolioID: accountID,
        transactionType: "accountTransferIn",
        grossAmount: 1_000,
        currency: "PLN",
        fees: 0,
        taxes: 0,
        transferKind: "cash",
        // No contributionTreatment → default "ignore" (native parity).
      }),
    ];

    const snapshot = buildInvestorDataSnapshot(records, {
      asOf: new Date("2026-05-02T10:00:00.000Z"),
      historyGranularity: "daily",
    });

    // The transfer is still neutralised for performance (TWR flat), but an
    // unflagged internal move is not fresh capital, so net-invested stays at the
    // 1000 genuinely deposited — matching native's default `ignoreForContributions`.
    expect(snapshot.totalValue).toBe(2_000);
    expect(snapshot.metrics.totalReturnPct).toBeCloseTo(0, 5);
    expect(snapshot.metrics.netInvested).toBeCloseTo(1_000, 5);
  });

  it("does not explode the time-weighted return on a buy into a near-empty account", () => {
    const bigInstrument = "99999999-9999-4999-8999-999999999999";
    const records = [
      record("account", accountID, {
        recordType: "account",
        id: accountID,
        name: "Core",
        baseCurrency: "PLN",
      }),
      record("asset", bigInstrument, {
        recordType: "asset",
        id: bigInstrument,
        kind: "etf",
        symbol: "BIG",
        name: "Big ETF",
        currency: "PLN",
      }),
      // Day 1: a token deposit leaves the account with 0.01 PLN of cash dust.
      record("transaction", "33333333-3333-4333-8333-333333333333", {
        recordType: "transaction",
        id: "33333333-3333-4333-8333-333333333333",
        date: "2026-05-01T10:00:00.000Z",
        portfolioID: accountID,
        transactionType: "cashDeposit",
        grossAmount: 0.01,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
      // Day 2: a large deposit funds a 1000 PLN buy on the same day.
      record("transaction", "44444444-4444-4444-8444-444444444444", {
        recordType: "transaction",
        id: "44444444-4444-4444-8444-444444444444",
        date: "2026-05-02T09:00:00.000Z",
        portfolioID: accountID,
        transactionType: "cashDeposit",
        grossAmount: 1_000,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
      record("transaction", "55555555-5555-4555-8555-555555555558", {
        recordType: "transaction",
        id: "55555555-5555-4555-8555-555555555558",
        date: "2026-05-02T10:00:00.000Z",
        portfolioID: accountID,
        instrumentID: bigInstrument,
        transactionType: "buy",
        quantity: 10,
        price: 100,
        grossAmount: 1_000,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
      // Same-day mark-to-market: the holding is worth 1010, a genuine +1% on the
      // 1000 deployed — NOT a multi-thousand-percent move relative to the 0.01
      // cash dust that opened the day.
      record("manualValuation", "66666666-6666-4666-8666-666666666666", {
        recordType: "manualValuation",
        id: "66666666-6666-4666-8666-666666666666",
        instrumentID: bigInstrument,
        date: "2026-05-02T11:00:00.000Z",
        value: 101,
        currency: "PLN",
      }),
    ];

    const snapshot = buildInvestorDataSnapshot(records, {
      asOf: new Date("2026-05-02T12:00:00.000Z"),
      historyGranularity: "daily",
    });

    expect(snapshot.totalValue).toBeCloseTo(1_010.01, 2);
    // Dividing the 10 PLN gain by (0.01 dust + 1000 inflow) yields ~1%, not the
    // ~100000% the previous `gain / previousValue` formula produced.
    expect(snapshot.metrics.totalReturnPct).toBeCloseTo(1, 0);
    expect(snapshot.metrics.totalReturnPct).toBeLessThan(5);
  });

  it("reads the inflation rate from the latest settings by updatedAt", () => {
    const records = [
      record("account", accountID, {
        recordType: "account",
        id: accountID,
        name: "Core",
        baseCurrency: "PLN",
      }),
      // Newer record listed FIRST in the array; the older one listed last. A
      // naive `.at(-1)` would wrongly pick the stale 3% rate.
      record("settings", "88888888-8888-4888-8888-888888888881", {
        recordType: "settings",
        id: "88888888-8888-4888-8888-888888888881",
        baseCurrency: "PLN",
        inflationRate: 5,
        updatedAt: "2026-05-10T00:00:00.000Z",
      }),
      record("settings", "88888888-8888-4888-8888-888888888882", {
        recordType: "settings",
        id: "88888888-8888-4888-8888-888888888882",
        baseCurrency: "PLN",
        inflationRate: 3,
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
    ];

    const snapshot = buildInvestorDataSnapshot(records, {
      asOf: new Date("2026-05-10T00:00:00.000Z"),
    });

    expect(snapshot.metrics.inflationPct).toBe(5);
  });

  it("states real return on an annualised basis (real CAGR), not cumulative", () => {
    const records = [
      record("account", accountID, {
        recordType: "account",
        id: accountID,
        name: "Core",
        baseCurrency: "PLN",
      }),
      record("asset", instrumentID, {
        recordType: "asset",
        id: instrumentID,
        kind: "etf",
        symbol: "ETF",
        name: "ETF",
        currency: "PLN",
      }),
      record("transaction", "33333333-3333-4333-8333-333333333333", {
        recordType: "transaction",
        id: "33333333-3333-4333-8333-333333333333",
        date: "2024-01-01T10:00:00.000Z",
        portfolioID: accountID,
        transactionType: "cashDeposit",
        grossAmount: 1_000,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
      record("transaction", "44444444-4444-4444-8444-444444444444", {
        recordType: "transaction",
        id: "44444444-4444-4444-8444-444444444444",
        date: "2024-01-01T10:00:00.000Z",
        portfolioID: accountID,
        instrumentID,
        transactionType: "buy",
        quantity: 10,
        price: 100,
        grossAmount: 1_000,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
      record("manualValuation", "55555555-5555-4555-8555-555555555555", {
        recordType: "manualValuation",
        id: "55555555-5555-4555-8555-555555555555",
        instrumentID,
        date: "2026-01-01T10:00:00.000Z",
        value: 120,
        currency: "PLN",
      }),
      record("settings", "88888888-8888-4888-8888-888888888888", {
        recordType: "settings",
        id: "B2AA7BD4-A95D-4D80-90F9-787B8A1EC401",
        baseCurrency: "PLN",
        inflationRate: 5,
        updatedAt: "2026-01-01T10:00:00.000Z",
      }),
    ];

    const snapshot = buildInvestorDataSnapshot(records, {
      asOf: new Date("2026-01-01T10:00:00.000Z"),
      historyGranularity: "daily",
    });

    // The portfolio grew +20% over ~2 years, so the cumulative and annualised
    // figures differ markedly. Real return must deflate the ANNUAL nominal
    // (CAGR) by the ANNUAL inflation rate — same horizon on both sides.
    expect(snapshot.metrics.totalReturnPct).toBeCloseTo(20, 1);
    const expectedReal =
      ((1 + snapshot.metrics.cagrPct / 100) / (1 + 5 / 100) - 1) * 100;
    expect(snapshot.metrics.realReturnPct).toBeCloseTo(expectedReal, 4);
    // Guard against the old behaviour (cumulative nominal ÷ annual inflation).
    const cumulativeMistake = ((1 + 20 / 100) / (1 + 5 / 100) - 1) * 100;
    expect(snapshot.metrics.realReturnPct).not.toBeCloseTo(cumulativeMistake, 1);
  });

  it("summarizes macOS income records without mixing them into portfolio cash", () => {
    const snapshot = buildInvestorDataSnapshot([
      record("account", accountID, {
        recordType: "account",
        id: accountID,
        name: "Core",
        baseCurrency: "PLN",
      }),
      record("transaction", "33333333-3333-4333-8333-333333333333", {
        recordType: "transaction",
        id: "33333333-3333-4333-8333-333333333333",
        date: "2026-05-01T00:00:00.000Z",
        portfolioID: accountID,
        transactionType: "cashDeposit",
        grossAmount: 1000,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
      record("income", "66666666-6666-4666-8666-666666666666", {
        recordType: "income",
        id: "66666666-6666-4666-8666-666666666666",
        entryKind: "earning",
        year: 2026,
        month: 5,
        employmentType: "employment",
        enteredAmount: 5000,
        currency: "PLN",
        fxRateToPLN: 1,
        plnAmount: 5000,
        source: "Salary",
        burdenCategory: null,
        amountPLN: null,
        note: "macOS earning",
      }),
      record("income", "77777777-7777-4777-8777-777777777777", {
        recordType: "income",
        id: "77777777-7777-4777-8777-777777777777",
        entryKind: "burden",
        year: 2026,
        month: 5,
        employmentType: null,
        enteredAmount: null,
        currency: null,
        fxRateToPLN: null,
        plnAmount: null,
        source: null,
        burdenCategory: "incomeTax",
        amountPLN: 1200,
        note: "macOS burden",
      }),
      record("income", "88888888-8888-4888-8888-888888888888", {
        recordType: "income",
        id: "88888888-8888-4888-8888-888888888888",
        entryKind: "earning",
        year: 2026,
        month: 5,
        plnAmount: 999,
      }, "2026-05-01T00:00:00.000Z"),
    ].map((item) =>
      item.id === "88888888-8888-4888-8888-888888888888"
        ? { ...item, deletedAt: "2026-05-02T00:00:00.000Z" }
        : item,
    ));

    expect(snapshot.cash).toBe(1000);
    expect(snapshot.income).toEqual({
      earningCount: 1,
      burdenCount: 1,
      earningsPLN: 5000,
      burdensPLN: 1200,
      netPLN: 3800,
    });
  });

  it("builds macOS-compatible income lists, monthly summaries and duplicate keys", () => {
    const activeRecords = [
      record("income", "66666666-6666-4666-8666-666666666666", {
        recordType: "income",
        id: "66666666-6666-4666-8666-666666666666",
        entryKind: "earning",
        year: 2026,
        month: 5,
        employmentType: "business",
        enteredAmount: 10_000,
        currency: "EUR",
        fxRateToPLN: 4.4,
        plnAmount: 44_000,
        source: "Invoice",
        burdenCategory: null,
        amountPLN: null,
        note: "B2B",
      }),
      record("income", "77777777-7777-4777-8777-777777777777", {
        recordType: "income",
        id: "77777777-7777-4777-8777-777777777777",
        entryKind: "earning",
        year: 2026,
        month: 5,
        employmentType: "employment",
        enteredAmount: 5_000,
        currency: "PLN",
        fxRateToPLN: 1,
        plnAmount: 5_000,
        source: "Salary",
        burdenCategory: null,
        amountPLN: null,
        note: null,
      }),
      record("income", "88888888-8888-4888-8888-888888888888", {
        recordType: "income",
        id: "88888888-8888-4888-8888-888888888888",
        entryKind: "burden",
        year: 2026,
        month: 5,
        employmentType: null,
        enteredAmount: null,
        currency: null,
        fxRateToPLN: null,
        plnAmount: null,
        source: null,
        burdenCategory: "zus",
        amountPLN: 1_700,
        note: "monthly",
      }),
      record("income", "99999999-9999-4999-8999-999999999999", {
        recordType: "income",
        id: "99999999-9999-4999-8999-999999999999",
        entryKind: "earning",
        year: 2025,
        month: 12,
        employmentType: "employment",
        enteredAmount: 6_000,
        currency: "PLN",
        fxRateToPLN: 1,
        plnAmount: 6_000,
        source: "Salary",
      }),
    ];
    const deleted = {
      ...record("income", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
        recordType: "income",
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        entryKind: "burden",
        year: 2026,
        month: 5,
        burdenCategory: "vat",
        amountPLN: 999,
      }),
      deletedAt: "2026-05-02T00:00:00.000Z",
    };

    const lists = buildIncomeLists([...activeRecords, deleted]);

    expect(lists.earnings).toHaveLength(3);
    expect(lists.burdens).toHaveLength(1);
    expect(lists.rows.map((row) => `${row.kind}:${row.id}`)).toEqual([
      "earning:66666666-6666-4666-8666-666666666666",
      "earning:77777777-7777-4777-8777-777777777777",
      "burden:88888888-8888-4888-8888-888888888888",
      "earning:99999999-9999-4999-8999-999999999999",
    ]);
    expect(lists.summaries[0]).toMatchObject({
      year: 2026,
      month: 5,
      employmentPLN: 5_000,
      businessRevenuePLN: 44_000,
      burdenPLN: 1_700,
      sourcePLN: 49_000,
      totalPLN: 47_300,
      earningsCount: 2,
    });
    expect(lists.yearlyAverages[0]).toMatchObject({
      year: 2026,
      avgResult: 47_300,
      avgSource: 49_000,
      totalResult: 47_300,
      months: 1,
    });
    expect(lists.totals.totalPLN).toBe(53_300);
    expect(lists.years).toEqual([2026, 2025]);
    expect(lists.currencies).toEqual(["EUR", "PLN"]);
    expect(
      findDuplicateEarning(lists.earnings, {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        year: 2026,
        month: 5,
        source: "Invoice",
        employmentType: "business",
      })?.id,
    ).toBe("66666666-6666-4666-8666-666666666666");
  });

  it("supports Swift JSONEncoder numeric dates", () => {
    const snapshot = buildInvestorDataSnapshot([
      record("account", accountID, {
        recordType: "account",
        id: accountID,
        name: "Core ETF",
        accountType: "Własny",
        baseCurrency: "PLN",
        colorHex: "#7EA16B",
        targetAllocation: {},
      }),
      record("transaction", "66666666-6666-4666-8666-666666666666", {
        recordType: "transaction",
        id: "66666666-6666-4666-8666-666666666666",
        date: 736387200,
        portfolioID: accountID,
        instrumentID: null,
        transactionType: "cashDeposit",
        quantity: null,
        price: null,
        grossAmount: 500,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
    ]);

    expect(snapshot.asOf).toBe("2026-05-15T10:00:00.000Z");
    expect(snapshot.cash).toBe(500);
    expect(snapshot.totalValue).toBe(500);
  });

  it("values treasury bonds with accrued dirty price from synced bond params", () => {
    const bondID = "12121212-1212-4212-8212-121212121212";
    const records = [
      record("account", accountID, {
        recordType: "account",
        id: accountID,
        name: "Obligacje",
        baseCurrency: "PLN",
      }),
      record("asset", bondID, {
        recordType: "asset",
        id: bondID,
        kind: "treasuryBond",
        symbol: "ROD0338",
        name: "ROD0338",
        currency: "PLN",
        bondParams: {
          series: "ROD",
          fullCode: "ROD0338",
          issueDate: "2026-03-01T00:00:00.000Z",
          maturityDate: "2038-03-01T00:00:00.000Z",
          nominalValue: 100,
          firstPeriodRate: 6,
          subsequentBase: "inflacja",
          marginOverBase: 1.5,
          capitalization: "roczna",
          interestPayment: "przy wykupie",
        },
      }),
      record("transaction", "34343434-3434-4434-8434-343434343434", {
        recordType: "transaction",
        id: "34343434-3434-4434-8434-343434343434",
        date: "2026-04-01T10:00:00.000Z",
        portfolioID: accountID,
        instrumentID: null,
        transactionType: "cashDeposit",
        quantity: null,
        price: null,
        grossAmount: 6_000,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
      record("transaction", "45454545-4545-4454-8454-454545454545", {
        recordType: "transaction",
        id: "45454545-4545-4454-8454-454545454545",
        date: "2026-04-01T10:00:00.000Z",
        portfolioID: accountID,
        instrumentID: bondID,
        transactionType: "buy",
        quantity: 50,
        price: 100,
        grossAmount: 5_000,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
    ];

    const instruments = buildInstrumentList(records);

    expect(instruments[0]).toMatchObject({
      id: bondID,
      totalQuantity: 50,
    });
    // ROD0338 is a catalogued issue, so the verified first-period rate (5.85%)
    // from the known-issues table overrides the 6% carried on the synced
    // bondParams above — matching the native TreasuryBondIssueCatalog. Accrued
    // over 44 days (2026-04-01 → 2026-05-15) at 5.85%: 100 + 100·0.0585·44/365.
    expect(instruments[0]?.lastPrice).toBeCloseTo(100.7052, 4);
    expect(instruments[0]?.marketValue).toBeCloseTo(5_035.26, 2);
    expect(instruments[0]).toMatchObject({
      valuationSource: "treasuryBond",
      valuationSourceLabel: "Obligacja skarbowa",
    });
  });

  it("uses broker/manual treasury bond values before synthetic dirty price", () => {
    const bondID = "12121212-1212-4212-8212-121212121212";
    const records = [
      record("account", accountID, {
        recordType: "account",
        id: accountID,
        name: "Obligacje",
        baseCurrency: "PLN",
      }),
      record("asset", bondID, {
        recordType: "asset",
        id: bondID,
        kind: "treasuryBond",
        symbol: "ROD0338",
        name: "ROD0338",
        currency: "PLN",
        bondParams: {
          series: "ROD",
          fullCode: "ROD0338",
          issueDate: "2026-03-01T00:00:00.000Z",
          maturityDate: "2038-03-01T00:00:00.000Z",
          nominalValue: 100,
          firstPeriodRate: 6,
          subsequentBase: "inflacja",
          marginOverBase: 1.5,
          capitalization: "roczna",
          interestPayment: "przy wykupie",
        },
      }),
      record("transaction", "34343434-3434-4434-8434-343434343434", {
        recordType: "transaction",
        id: "34343434-3434-4434-8434-343434343434",
        date: "2026-04-01T10:00:00.000Z",
        portfolioID: accountID,
        instrumentID: null,
        transactionType: "cashDeposit",
        quantity: null,
        price: null,
        grossAmount: 6_000,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
      record("transaction", "45454545-4545-4454-8454-454545454545", {
        recordType: "transaction",
        id: "45454545-4545-4454-8454-454545454545",
        date: "2026-04-01T10:00:00.000Z",
        portfolioID: accountID,
        instrumentID: bondID,
        transactionType: "buy",
        quantity: 50,
        price: 100,
        grossAmount: 5_000,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
      record("manualValuation", "56565656-5656-4656-8656-565656565656", {
        recordType: "manualValuation",
        id: "56565656-5656-4656-8656-565656565656",
        instrumentID: bondID,
        date: "2026-06-05T00:00:00.000Z",
        value: 101.12,
        currency: "PLN",
      }),
    ];

    const instruments = buildInstrumentList(records);
    const detail = buildPortfolioDetail(records, accountID);

    expect(instruments[0]).toMatchObject({
      id: bondID,
      totalQuantity: 50,
      lastPrice: 101.12,
      marketValue: 5_056,
      valuationSource: "manual",
      valuationSourceLabel: "Wycena ręczna",
    });
    expect(detail?.holdings[0]).toMatchObject({
      instrumentId: bondID,
      quantity: 50,
      lastPrice: 101.12,
      marketValue: 5_056,
      valuationSource: "manual",
    });
  });

  it("values foreign currency cash and manual valuations in base currency", () => {
    const records = [
      record("settings", "88888888-8888-4888-8888-888888888888", {
        recordType: "settings",
        id: "88888888-8888-4888-8888-888888888888",
        baseCurrency: "PLN",
        updatedAt: "2026-04-01T00:00:00.000Z",
      }),
      record("account", accountID, {
        recordType: "account",
        id: accountID,
        name: "Global",
        baseCurrency: "PLN",
      }),
      record("asset", usdInstrumentID, {
        recordType: "asset",
        id: usdInstrumentID,
        kind: "stock",
        symbol: "AAPL",
        name: "Apple",
        currency: "USD",
      }),
      record("transaction", "99999999-9999-4999-8999-999999999991", {
        recordType: "transaction",
        id: "99999999-9999-4999-8999-999999999991",
        date: "2026-04-01T10:00:00.000Z",
        portfolioID: accountID,
        instrumentID: null,
        transactionType: "cashDeposit",
        quantity: null,
        price: null,
        grossAmount: 10_000,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
      record("transaction", "99999999-9999-4999-8999-999999999992", {
        recordType: "transaction",
        id: "99999999-9999-4999-8999-999999999992",
        date: "2026-04-02T10:00:00.000Z",
        portfolioID: accountID,
        instrumentID: null,
        transactionType: "fxConversion",
        quantity: null,
        price: null,
        grossAmount: 4_000,
        currency: "PLN",
        fees: 0,
        taxes: 0,
        targetCurrency: "USD",
        targetGrossAmount: 1_000,
      }),
      record("transaction", "99999999-9999-4999-8999-999999999993", {
        recordType: "transaction",
        id: "99999999-9999-4999-8999-999999999993",
        date: "2026-04-03T10:00:00.000Z",
        portfolioID: accountID,
        instrumentID: usdInstrumentID,
        transactionType: "buy",
        quantity: 5,
        price: 100,
        grossAmount: 500,
        currency: "USD",
        fees: 2,
        taxes: 0,
        fxRateToBase: 4,
      }),
      record("transaction", "99999999-9999-4999-8999-999999999994", {
        recordType: "transaction",
        id: "99999999-9999-4999-8999-999999999994",
        date: "2026-05-02T10:00:00.000Z",
        portfolioID: accountID,
        instrumentID: usdInstrumentID,
        transactionType: "dividend",
        quantity: null,
        price: null,
        grossAmount: 10,
        currency: "USD",
        fees: 0,
        taxes: 1,
      }),
      record("manualValuation", "99999999-9999-4999-8999-999999999995", {
        recordType: "manualValuation",
        id: "99999999-9999-4999-8999-999999999995",
        instrumentID: usdInstrumentID,
        date: "2026-05-01T10:00:00.000Z",
        value: 120,
        currency: "USD",
      }),
    ];

    const snapshot = buildInvestorDataSnapshot(records);
    const detail = buildPortfolioDetail(records, accountID);
    const instruments = buildInstrumentList(records);
    const transactions = buildTransactionList(records);

    expect(snapshot.totalValue).toBe(10_428);
    expect(snapshot.cash).toBe(8_028);
    expect(snapshot.portfolios[0]).toMatchObject({
      id: accountID,
      value: 10_428,
      positions: 1,
    });
    expect(snapshot.allocation).toEqual([
      { label: "Gotówka", percent: expect.closeTo(76.98504, 5) },
      { label: "Akcje / ETF", percent: expect.closeTo(23.01496, 5) },
    ]);

    expect(detail?.totalValue).toBe(10_428);
    expect(detail?.cashValue).toBe(8_028);
    expect(detail?.cashBalances).toEqual([
      { currency: "PLN", amount: 3_992 },
      { currency: "USD", amount: 1_009 },
    ]);
    expect(detail?.holdings).toEqual([
      {
        instrumentId: usdInstrumentID,
        symbol: "AAPL",
        name: "Apple",
        kind: "stock",
        quantity: 5,
        lastPrice: 120,
        currency: "USD",
        valuationSource: "manual",
        valuationSourceLabel: "Wycena ręczna",
        marketValue: 2_400,
        portfolioPercent: expect.closeTo(23.01496, 5),
      },
    ]);

    expect(instruments[0]).toMatchObject({
      id: usdInstrumentID,
      symbol: "AAPL",
      currency: "USD",
      lastPrice: 120,
      lastPriceDate: "2026-05-01T10:00:00.000Z",
      valuationSource: "manual",
      valuationSourceLabel: "Wycena ręczna",
      totalQuantity: 5,
      marketValue: 2_400,
      portfolios: ["Global"],
    });
    expect(transactions[0]).toMatchObject({
      id: "99999999-9999-4999-8999-999999999994",
      portfolioName: "Global",
      instrumentSymbol: "AAPL",
      transactionType: "dividend",
    });
  });

  it("can revalue foreign currency positions with historical FX context", () => {
    const records = [
      record("account", accountID, {
        recordType: "account",
        id: accountID,
        name: "Global",
        baseCurrency: "PLN",
      }),
      record("asset", usdInstrumentID, {
        recordType: "asset",
        id: usdInstrumentID,
        kind: "stock",
        symbol: "AAPL",
        name: "Apple",
        currency: "USD",
      }),
      record("transaction", "99999999-9999-4999-8999-999999999991", {
        recordType: "transaction",
        id: "99999999-9999-4999-8999-999999999991",
        date: "2026-04-01T10:00:00.000Z",
        portfolioID: accountID,
        instrumentID: null,
        transactionType: "cashDeposit",
        quantity: null,
        price: null,
        grossAmount: 10_000,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
      record("transaction", "99999999-9999-4999-8999-999999999992", {
        recordType: "transaction",
        id: "99999999-9999-4999-8999-999999999992",
        date: "2026-04-02T10:00:00.000Z",
        portfolioID: accountID,
        instrumentID: null,
        transactionType: "fxConversion",
        quantity: null,
        price: null,
        grossAmount: 4_000,
        currency: "PLN",
        fees: 0,
        taxes: 0,
        targetCurrency: "USD",
        targetGrossAmount: 1_000,
      }),
      record("transaction", "99999999-9999-4999-8999-999999999993", {
        recordType: "transaction",
        id: "99999999-9999-4999-8999-999999999993",
        date: "2026-04-03T10:00:00.000Z",
        portfolioID: accountID,
        instrumentID: usdInstrumentID,
        transactionType: "buy",
        quantity: 5,
        price: 100,
        grossAmount: 500,
        currency: "USD",
        fees: 2,
        taxes: 0,
        fxRateToBase: 4,
      }),
      record("manualValuation", "99999999-9999-4999-8999-999999999995", {
        recordType: "manualValuation",
        id: "99999999-9999-4999-8999-999999999995",
        instrumentID: usdInstrumentID,
        date: "2026-05-01T10:00:00.000Z",
        value: 120,
        currency: "USD",
      }),
    ];

    const options = {
      fxRates: [
        {
          currency: "USD",
          rate: 4.2,
          date: new Date("2026-05-15T00:00:00.000Z"),
        },
      ],
    };

    const snapshot = buildInvestorDataSnapshot(records, options);
    const detail = buildPortfolioDetail(records, accountID, options);
    const instruments = buildInstrumentList(records, options);

    expect(snapshot.totalValue).toBeCloseTo(10_712, 5);
    expect(snapshot.cash).toBeCloseTo(8_192, 5);
    expect(snapshot.valuationSeries).toContainEqual({
      label: "kwi",
      date: "2026-04-30T00:00:00.000Z",
      value: 9_992,
    });
    expect(snapshot.valuationSeries.at(-1)).toEqual({
      label: "maj",
      date: "2026-05-15T10:00:00.000Z",
      value: 10_712,
    });
    expect(detail?.holdings[0]?.marketValue).toBeCloseTo(2_520, 5);
    expect(instruments[0]?.marketValue).toBeCloseTo(2_520, 5);
  });

  it("reports transaction and missing valuation sources for instrument diagnostics", () => {
    const missingInstrumentID = "88888888-8888-4888-8888-888888888881";
    const records = [
      record("account", accountID, {
        recordType: "account",
        id: accountID,
        name: "Diagnostyka",
        baseCurrency: "PLN",
      }),
      record("asset", instrumentID, {
        recordType: "asset",
        id: instrumentID,
        kind: "stock",
        symbol: "PKN",
        name: "PKN",
        currency: "PLN",
      }),
      record("asset", missingInstrumentID, {
        recordType: "asset",
        id: missingInstrumentID,
        kind: "stock",
        symbol: "BRAK",
        name: "Bez ceny",
        currency: "PLN",
      }),
      record("transaction", "99999999-9999-4999-8999-999999999996", {
        recordType: "transaction",
        id: "99999999-9999-4999-8999-999999999996",
        date: "2026-04-01T10:00:00.000Z",
        portfolioID: accountID,
        instrumentID,
        transactionType: "buy",
        quantity: 2,
        price: 50,
        grossAmount: 100,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
      record("transaction", "99999999-9999-4999-8999-999999999997", {
        recordType: "transaction",
        id: "99999999-9999-4999-8999-999999999997",
        date: "2026-04-02T10:00:00.000Z",
        portfolioID: accountID,
        instrumentID: missingInstrumentID,
        transactionType: "buy",
        quantity: 1,
        price: null,
        grossAmount: 0,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
    ];

    const instruments = buildInstrumentList(records);
    const priced = instruments.find((instrument) => instrument.id === instrumentID);
    const missing = instruments.find((instrument) => instrument.id === missingInstrumentID);

    expect(priced).toMatchObject({
      lastPrice: 50,
      valuationSource: "transaction",
      valuationSourceLabel: "Cena transakcyjna",
      marketValue: 100,
    });
    expect(missing).toMatchObject({
      lastPrice: 0,
      lastPriceDate: null,
      valuationSource: "missing",
      valuationSourceLabel: "Brak ceny",
      marketValue: 0,
    });
  });

  it("fills the daily valuation series from injected live market quotes", () => {
    const records = [
      record("account", accountID, {
        recordType: "account",
        id: accountID,
        name: "Core",
        baseCurrency: "PLN",
      }),
      record("asset", instrumentID, {
        recordType: "asset",
        id: instrumentID,
        kind: "etf",
        symbol: "ETF",
        name: "ETF",
        currency: "PLN",
      }),
      record("transaction", "22222222-2222-4222-8222-222222222222", {
        recordType: "transaction",
        id: "22222222-2222-4222-8222-222222222222",
        date: "2026-05-01T09:00:00.000Z",
        portfolioID: accountID,
        instrumentID: null,
        transactionType: "cashDeposit",
        grossAmount: 1_000,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
      record("transaction", "33333333-3333-4333-8333-333333333333", {
        recordType: "transaction",
        id: "33333333-3333-4333-8333-333333333333",
        date: "2026-05-01T10:00:00.000Z",
        portfolioID: accountID,
        instrumentID,
        transactionType: "buy",
        quantity: 10,
        price: 100,
        grossAmount: 1_000,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
    ];

    // Without quotes the position is held flat at its transaction price (100),
    // so every day in the series is 1000 — the "flat line then jump" problem.
    const flat = buildInvestorDataSnapshot(records, {
      asOf: new Date("2026-05-04T12:00:00.000Z"),
      historyGranularity: "daily",
      useMarketQuotes: true,
    });
    expect(flat.valuationSeries.map((point) => point.value)).toEqual([
      1_000, 1_000, 1_000, 1_000,
    ]);

    // With daily quotes injected, the series tracks real day-to-day prices.
    const quoted = buildInvestorDataSnapshot(records, {
      asOf: new Date("2026-05-04T12:00:00.000Z"),
      historyGranularity: "daily",
      useMarketQuotes: true,
      marketQuotes: [
        { instrumentID, price: 100, currency: "PLN", date: new Date("2026-05-01T00:00:00.000Z") },
        { instrumentID, price: 102, currency: "PLN", date: new Date("2026-05-02T00:00:00.000Z") },
        { instrumentID, price: 108, currency: "PLN", date: new Date("2026-05-03T00:00:00.000Z") },
        { instrumentID, price: 105, currency: "PLN", date: new Date("2026-05-04T00:00:00.000Z") },
      ],
    });
    expect(quoted.valuationSeries.map((point) => point.value)).toEqual([
      1_000, 1_020, 1_080, 1_050,
    ]);
    expect(quoted.totalValue).toBe(1_050);
  });
});
