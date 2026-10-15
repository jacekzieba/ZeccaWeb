import { describe, expect, it } from "vitest";
import type { RecordType } from "@/domain/models/investor-data";
import { makeRecord } from "./helpers/records";
import { buildPortfolioDetail } from "@/sync/records/investor-snapshot";
import {
  fundingDepositForTrade,
  fundingDepositIdsForBuys,
  fundingDepositNote,
} from "@/features/transactions/funding-deposit";

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

describe("fundingDepositIdsForBuys", () => {
  const otherBuyID = "55555555-5555-4555-8555-555555555555";
  const otherDepositID = "66666666-6666-4666-8666-666666666666";
  const date = "2026-05-10T10:00:00.000Z";

  const buy = (id: string, extra: Record<string, unknown> = {}) =>
    record("transaction", id, {
      recordType: "transaction",
      id,
      date,
      portfolioID: accountID,
      instrumentID,
      transactionType: "buy",
      quantity: 10,
      price: 10,
      grossAmount: 100,
      currency: "USD",
      fees: 0,
      taxes: 0,
      ...extra,
    });

  const deposit = (id: string, extra: Record<string, unknown> = {}) =>
    record("transaction", id, {
      recordType: "transaction",
      id,
      date,
      portfolioID: accountID,
      instrumentID: null,
      transactionType: "cashDeposit",
      quantity: null,
      price: null,
      grossAmount: 100,
      currency: "USD",
      fees: 0,
      taxes: 0,
      notes: "Zasilenie pod zakup VWRL.NL",
      ...extra,
    });

  it("finds the deposit the buy was funded with", () => {
    expect(
      fundingDepositIdsForBuys([buy(buyID), deposit(depositID)], [buyID]),
    ).toEqual([depositID]);
  });

  it("ignores deposits entered by hand, even with the same amount", () => {
    expect(
      fundingDepositIdsForBuys(
        [buy(buyID), deposit(depositID, { notes: "Wpłata z konta" })],
        [buyID],
      ),
    ).toEqual([]);
  });

  it("ignores a funding deposit of a different amount, date or portfolio", () => {
    const records = [
      buy(buyID),
      deposit("a", { grossAmount: 99 }),
      deposit("b", { date: "2026-05-11T10:00:00.000Z" }),
      deposit("c", { portfolioID: otherBuyID }),
    ];
    expect(fundingDepositIdsForBuys(records, [buyID])).toEqual([]);
  });

  it("ignores deposits that are already deleted", () => {
    const deleted = { ...deposit(depositID), deletedAt: "2026-05-12T10:00:00.000Z" };
    expect(fundingDepositIdsForBuys([buy(buyID), deleted], [buyID])).toEqual([]);
  });

  it("matches the settlement-currency amount of a foreign buy settled in PLN", () => {
    const records = [
      buy(buyID, { fees: 5, fxRateToBase: 4 }),
      deposit(depositID, { grossAmount: 420, currency: "PLN" }),
    ];
    expect(fundingDepositIdsForBuys(records, [buyID])).toEqual([depositID]);
  });

  it("gives two identical buys one deposit each", () => {
    const records = [
      buy(buyID),
      buy(otherBuyID),
      deposit(depositID),
      deposit(otherDepositID),
    ];
    expect(
      fundingDepositIdsForBuys(records, [buyID, otherBuyID]).sort(),
    ).toEqual([depositID, otherDepositID].sort());
    expect(fundingDepositIdsForBuys(records, [buyID])).toHaveLength(1);
  });

  it("returns nothing for non-buy transactions", () => {
    const sell = buy(buyID, { transactionType: "sell" });
    expect(fundingDepositIdsForBuys([sell, deposit(depositID)], [buyID])).toEqual([]);
  });

  it("does not guess when more buys than deposits share the same key", () => {
    // Dwa identyczne zakupy, tylko jeden z wpłatą: nie wiadomo, który był
    // sfinansowany, więc nie wolno proponować usunięcia cudzej wpłaty.
    const records = [buy(buyID), buy(otherBuyID), deposit(depositID)];
    expect(fundingDepositIdsForBuys(records, [otherBuyID])).toEqual([]);
    expect(fundingDepositIdsForBuys(records, [buyID, otherBuyID])).toEqual([]);
  });

  it("still finds the deposit after the buy's amount was edited", () => {
    const asset = record("asset", instrumentID, {
      recordType: "asset",
      id: instrumentID,
      kind: "etf",
      symbol: "VWRL.NL",
      name: "FTSE All-World",
      currency: "USD",
    });
    const records = [
      asset,
      buy(buyID, { price: 11, grossAmount: 110 }),
      deposit(depositID, { notes: fundingDepositNote("VWRL.NL") }),
    ];
    expect(fundingDepositIdsForBuys(records, [buyID])).toEqual([depositID]);
  });

  it("does not use the symbol fallback when the date or symbol differs", () => {
    const asset = record("asset", instrumentID, {
      recordType: "asset",
      id: instrumentID,
      kind: "etf",
      symbol: "VWRL.NL",
      name: "FTSE All-World",
      currency: "USD",
    });
    const edited = buy(buyID, { grossAmount: 110 });
    expect(
      fundingDepositIdsForBuys(
        [asset, edited, deposit(depositID, { notes: fundingDepositNote("XYZ") })],
        [buyID],
      ),
    ).toEqual([]);
    expect(
      fundingDepositIdsForBuys(
        [asset, edited, deposit(depositID, { notes: fundingDepositNote("VWRL.NL"), date: "2026-05-11T10:00:00.000Z" })],
        [buyID],
      ),
    ).toEqual([]);
  });
});

describe("fundingDepositNote", () => {
  it("names the instrument when it is known", () => {
    expect(fundingDepositNote("VWRL.NL")).toBe("Zasilenie pod zakup VWRL.NL");
    expect(fundingDepositNote(undefined)).toBe("Zasilenie pod zakup");
  });
});
