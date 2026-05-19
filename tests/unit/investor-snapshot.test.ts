import { describe, expect, it } from "vitest";
import type { RecordType } from "@/domain/models/investor-data";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";
import {
  buildInstrumentList,
  buildInvestorDataSnapshot,
  buildPortfolioDetail,
  buildTransactionList,
} from "@/sync/records/investor-snapshot";

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
    expect(instruments[0]?.lastPrice).toBeCloseTo(100.7233, 4);
    expect(instruments[0]?.marketValue).toBeCloseTo(5_036.16, 2);
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
    expect(detail?.holdings[0]?.marketValue).toBeCloseTo(2_520, 5);
    expect(instruments[0]?.marketValue).toBeCloseTo(2_520, 5);
  });
});
