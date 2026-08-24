import { describe, expect, it } from "vitest";
import type { RecordType } from "@/domain/models/investor-data";
import { makeRecord } from "./helpers/records";
import { buildPortfolioDetail } from "@/sync/records/investor-snapshot";
import { fundingDepositForTrade } from "@/features/transactions/funding-deposit";

const accountID = "11111111-1111-4111-8111-111111111111";
const instrumentID = "22222222-2222-4222-8222-222222222222";
const buyID = "33333333-3333-4333-8333-333333333333";
const depositID = "44444444-4444-4444-8444-444444444444";

const record = (type: RecordType, id: string, payload: unknown) =>
  makeRecord(type, id, payload, "2026-05-15T10:00:00.000Z");

describe("fundingDepositForTrade", () => {
  it("funds a PLN buy with gross plus fees", () => {
    expect(
      fundingDepositForTrade({
        transactionType: "buy",
        currency: "PLN",
        grossAmount: 1_000,
        fees: 12.5,
        fxRateToBase: null,
      }),
    ).toEqual({ currency: "PLN", grossAmount: 1_012.5 });
  });

  it("funds a foreign buy in its own currency when it settles abroad", () => {
    expect(
      fundingDepositForTrade({
        transactionType: "buy",
        currency: "USD",
        grossAmount: 1_000,
        fees: 5,
        fxRateToBase: null,
      }),
    ).toEqual({ currency: "USD", grossAmount: 1_005 });
  });

  it("funds a foreign buy in PLN at the settlement rate", () => {
    expect(
      fundingDepositForTrade({
        transactionType: "buy",
        currency: "USD",
        grossAmount: 1_000,
        fees: 5,
        fxRateToBase: 4,
      }),
    ).toEqual({ currency: "PLN", grossAmount: 4_020 });
  });

  it("returns null for types that do not consume cash for a position", () => {
    for (const transactionType of ["sell", "cashDeposit", "dividend", "fee"]) {
      expect(
        fundingDepositForTrade({
          transactionType,
          currency: "PLN",
          grossAmount: 1_000,
          fees: 0,
          fxRateToBase: null,
        }),
      ).toBeNull();
    }
  });
});

describe("the generated deposit against the ledger", () => {
  const buildRecords = (buy: Record<string, unknown>) => {
    const funding = fundingDepositForTrade({
      transactionType: "buy",
      currency: buy.currency as string,
      grossAmount: buy.grossAmount as number,
      fees: buy.fees as number,
      fxRateToBase: (buy.fxRateToBase as number | undefined) ?? null,
    });
    if (!funding) throw new Error("expected a funding deposit for a buy");

    return [
      record("account", accountID, {
        recordType: "account",
        id: accountID,
        name: "IKE",
        accountType: "IKE",
        baseCurrency: "PLN",
        targetAllocation: {},
      }),
      record("asset", instrumentID, {
        recordType: "asset",
        id: instrumentID,
        kind: "etf",
        symbol: "VWRL.NL",
        name: "FTSE All-World",
        currency: buy.currency,
      }),
      record("transaction", buyID, {
        recordType: "transaction",
        id: buyID,
        date: "2026-05-10T10:00:00.000Z",
        portfolioID: accountID,
        instrumentID,
        transactionType: "buy",
        taxes: 0,
        ...buy,
      }),
      record("transaction", depositID, {
        recordType: "transaction",
        id: depositID,
        date: "2026-05-10T10:00:00.000Z",
        portfolioID: accountID,
        instrumentID: null,
        transactionType: "cashDeposit",
        quantity: null,
        price: null,
        grossAmount: funding.grossAmount,
        currency: funding.currency,
        fees: 0,
        taxes: 0,
      }),
    ];
  };

  it("leaves no cash balance behind for a PLN buy", () => {
    const detail = buildPortfolioDetail(
      buildRecords({
        quantity: 10,
        price: 100,
        grossAmount: 1_000,
        currency: "PLN",
        fees: 12.5,
      }),
      accountID,
    );

    expect(detail?.cashBalances).toEqual([]);
    expect(detail?.cashValue).toBeCloseTo(0, 6);
  });

  it("leaves no cash balance behind for a foreign buy settled abroad", () => {
    const detail = buildPortfolioDetail(
      buildRecords({
        quantity: 10,
        price: 100,
        grossAmount: 1_000,
        currency: "USD",
        fees: 5,
      }),
      accountID,
    );

    expect(detail?.cashBalances).toEqual([]);
  });

  it("leaves no cash balance behind for a foreign buy settled in PLN", () => {
    const detail = buildPortfolioDetail(
      buildRecords({
        quantity: 10,
        price: 100,
        grossAmount: 1_000,
        currency: "USD",
        fees: 5,
        fxRateToBase: 4,
      }),
      accountID,
    );

    expect(detail?.cashBalances).toEqual([]);
  });
});
