import { describe, expect, it } from "vitest";
import { buildInvestorDataSnapshot, buildTransactionList } from "@/sync/records/investor-snapshot";
import { buildParitySnapshot } from "@/sync/records/parity-snapshot";
import { treasuryBondMacroGaps, type BondParamsInput } from "@/domain/valuation/position-valuator";
import { makeRecord as record } from "./helpers/records";

const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const USD_ASSET = "22222222-2222-4222-8222-222222222222";

describe("snapshot diagnostics", () => {
  it("flags a held foreign asset with no price and no FX rate", () => {
    const records = [
      record("account", ACCOUNT, { recordType: "account", id: ACCOUNT, name: "Core", baseCurrency: "PLN" }),
      record("asset", USD_ASSET, {
        recordType: "asset",
        id: USD_ASSET,
        kind: "stock",
        symbol: "AAPL",
        name: "Apple",
        currency: "USD",
      }),
      // An incoming asset transfer establishes the holding without a purchase
      // price, and carries no fxRateToBase, so both the price and the USD rate
      // are unresolved. (A price-less *buy* can't stand in here: both engines
      // skip one outright, so it establishes no holding to warn about.)
      record("transaction", "33333333-3333-4333-8333-333333333333", {
        recordType: "transaction",
        id: "33333333-3333-4333-8333-333333333333",
        date: "2026-01-05T00:00:00.000Z",
        portfolioID: ACCOUNT,
        instrumentID: USD_ASSET,
        transactionType: "accountTransferIn",
        transferKind: "asset",
        quantity: 10,
        grossAmount: 0,
        currency: "USD",
        fees: 0,
        taxes: 0,
      }),
    ];

    const snapshot = buildInvestorDataSnapshot(records, { asOf: new Date("2026-06-30T00:00:00.000Z") });
    const codes = (snapshot.diagnostics ?? []).map((d) => d.code);
    expect(codes).toContain("price-missing");
    expect(snapshot.diagnostics?.find((d) => d.code === "price-missing")?.context).toBe("AAPL");
  });

  it("emits no diagnostics when a held asset has a market price", () => {
    const records = [
      record("account", ACCOUNT, { recordType: "account", id: ACCOUNT, name: "Core", baseCurrency: "PLN" }),
      record("asset", USD_ASSET, {
        recordType: "asset",
        id: USD_ASSET,
        kind: "stock",
        symbol: "PKN",
        name: "Orlen",
        currency: "PLN",
      }),
      record("transaction", "33333333-3333-4333-8333-333333333333", {
        recordType: "transaction",
        id: "33333333-3333-4333-8333-333333333333",
        date: "2026-01-05T00:00:00.000Z",
        portfolioID: ACCOUNT,
        instrumentID: USD_ASSET,
        transactionType: "buy",
        quantity: 10,
        price: 65,
        grossAmount: 650,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      }),
    ];

    const snapshot = buildInvestorDataSnapshot(records, { asOf: new Date("2026-06-30T00:00:00.000Z") });
    expect(snapshot.diagnostics).toEqual([]);
  });
});

describe("malformed record resilience", () => {
  const goodAccount = record("account", ACCOUNT, {
    recordType: "account",
    id: ACCOUNT,
    name: "Core",
    baseCurrency: "PLN",
  });
  // Missing required fields (grossAmount, currency) → fails the schema.
  const badTransaction = record("transaction", "99999999-9999-4999-8999-999999999999", {
    recordType: "transaction",
    id: "99999999-9999-4999-8999-999999999999",
    portfolioID: ACCOUNT,
    transactionType: "cashDeposit",
  });

  it("skips a malformed record and reports it instead of throwing (runtime/lenient)", () => {
    const snapshot = buildInvestorDataSnapshot([goodAccount, badTransaction], {
      asOf: new Date("2026-06-30T00:00:00.000Z"),
    });
    const skipped = (snapshot.diagnostics ?? []).filter((d) => d.code === "record-skipped");
    expect(skipped).toHaveLength(1);
    expect(skipped[0].context).toBe("transaction");
    // The healthy account still produced a portfolio.
    expect(snapshot.portfolios).toHaveLength(1);
  });

  it("throws on a malformed record in strict (parity) mode", () => {
    expect(() =>
      buildParitySnapshot([goodAccount, badTransaction], {
        asOf: new Date("2026-06-30T00:00:00.000Z"),
      }),
    ).toThrow();
  });

  it("throws in strict mode when buildTransactionList meets a malformed record", () => {
    expect(() =>
      buildTransactionList([goodAccount, badTransaction], { strict: true }),
    ).toThrow();
  });

  it("does not credit phantom sell proceeds when the matching buy was skipped", () => {
    const asset = record("asset", USD_ASSET, {
      recordType: "asset", id: USD_ASSET, kind: "etf", symbol: "ETF", name: "ETF", currency: "PLN",
    });
    const deposit = record("transaction", "88888888-8888-4888-8888-888888888888", {
      recordType: "transaction", id: "88888888-8888-4888-8888-888888888888",
      date: "2026-01-01T00:00:00.000Z", portfolioID: ACCOUNT,
      transactionType: "cashDeposit", grossAmount: 1000, currency: "PLN", fees: 0, taxes: 0,
    });
    // The buy that would back the sell fails the schema and is skipped.
    const badBuy = record("transaction", "99999999-9999-4999-8999-999999999998", {
      recordType: "transaction", id: "99999999-9999-4999-8999-999999999998",
      portfolioID: ACCOUNT, instrumentID: USD_ASSET, transactionType: "buy",
    });
    const sell = record("transaction", "77777777-7777-4777-8777-777777777776", {
      recordType: "transaction", id: "77777777-7777-4777-8777-777777777776",
      date: "2026-01-02T00:00:00.000Z", portfolioID: ACCOUNT, instrumentID: USD_ASSET,
      transactionType: "sell", quantity: 2, price: 100, grossAmount: 200,
      currency: "PLN", fees: 0, taxes: 0,
    });

    const snapshot = buildInvestorDataSnapshot([goodAccount, asset, deposit, badBuy, sell], {
      asOf: new Date("2026-06-30T00:00:00.000Z"),
    });

    // Cash must stay at the deposit: crediting the sell's 200 would invent
    // money the ledger never spent on the (skipped) buy.
    expect(snapshot.totalValue).toBeCloseTo(1000, 6);
  });

  it("does not credit phantom bondRedemption/depositClose proceeds when the acquisition was skipped", () => {
    const BOND = "44444444-4444-4444-8444-444444444444";
    const DEPOSIT = "55555555-5555-4555-8555-555555555555";
    const cash = record("transaction", "88888888-8888-4888-8888-888888888887", {
      recordType: "transaction", id: "88888888-8888-4888-8888-888888888887",
      date: "2026-01-01T00:00:00.000Z", portfolioID: ACCOUNT,
      transactionType: "cashDeposit", grossAmount: 1000, currency: "PLN", fees: 0, taxes: 0,
    });
    // Both acquisitions fail the schema and are skipped.
    const badBondBuy = record("transaction", "99999999-9999-4999-8999-999999999997", {
      recordType: "transaction", id: "99999999-9999-4999-8999-999999999997",
      portfolioID: ACCOUNT, instrumentID: BOND, transactionType: "buy",
    });
    const badDepositOpen = record("transaction", "99999999-9999-4999-8999-999999999996", {
      recordType: "transaction", id: "99999999-9999-4999-8999-999999999996",
      portfolioID: ACCOUNT, instrumentID: DEPOSIT, transactionType: "depositOpen",
    });
    const redemption = record("transaction", "77777777-7777-4777-8777-777777777775", {
      recordType: "transaction", id: "77777777-7777-4777-8777-777777777775",
      date: "2026-01-02T00:00:00.000Z", portfolioID: ACCOUNT, instrumentID: BOND,
      transactionType: "bondRedemption", quantity: 2, grossAmount: 200,
      currency: "PLN", fees: 0, taxes: 0,
    });
    const depositClose = record("transaction", "77777777-7777-4777-8777-777777777774", {
      recordType: "transaction", id: "77777777-7777-4777-8777-777777777774",
      date: "2026-01-02T00:00:00.000Z", portfolioID: ACCOUNT, instrumentID: DEPOSIT,
      transactionType: "depositClose", grossAmount: 300,
      currency: "PLN", fees: 0, taxes: 0,
    });

    const snapshot = buildInvestorDataSnapshot(
      [goodAccount, cash, badBondBuy, badDepositOpen, redemption, depositClose],
      { asOf: new Date("2026-06-30T00:00:00.000Z") },
    );

    expect(snapshot.totalValue).toBeCloseTo(1000, 6);
  });
});

describe("treasuryBondMacroGaps", () => {
  const rorParams: BondParamsInput = {
    issueDate: new Date("2026-01-01T00:00:00.000Z"),
    maturityDate: new Date("2027-01-01T00:00:00.000Z"),
    nominalValue: 100,
    firstPeriodRate: 5.75,
    subsequentBase: "stopa referencyjna NBP",
    marginOverBase: 0,
    capitalization: "brak",
    interestPayment: "co miesiąc",
  };

  it("reports a gap when the reference-rate series does not cover a subsequent period", () => {
    // Empty reference series → every period after the first falls back.
    expect(
      treasuryBondMacroGaps(rorParams, new Date("2026-01-01T00:00:00.000Z"), new Date("2026-05-01T00:00:00.000Z"), undefined, []),
    ).toBe(true);
  });

  it("reports no gap when the series covers the periods", () => {
    const series = [{ date: new Date("2025-01-01T00:00:00.000Z"), rate: 4.5 }];
    expect(
      treasuryBondMacroGaps(rorParams, new Date("2026-01-01T00:00:00.000Z"), new Date("2026-05-01T00:00:00.000Z"), undefined, series),
    ).toBe(false);
  });
});
