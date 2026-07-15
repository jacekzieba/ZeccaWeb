import { describe, expect, it } from "vitest";
import {
  validateImportIdentities,
  validateTreasuryBondImports,
} from "@/features/import/import-identity-validation";

const etf = {
  id: "asset-vwrl",
  recordType: "asset",
  kind: "etf",
  symbol: "VWRL.NL",
  name: "Vanguard FTSE All-World UCITS ETF",
  currency: "USD",
  exchange: "LSE",
  isin: "IE00B3RBWM25",
  marketDataID: "VWRL.L",
};

describe("import identity validation", () => {
  it("accepts a complete confirmed ETF identity", () => {
    expect(validateImportIdentities([etf])).toEqual([]);
  });

  it("blocks an ambiguous or incomplete ETF identity before commit", () => {
    const errors = validateImportIdentities([
      { ...etf, currency: "?", exchange: "", isin: null, marketDataID: null },
    ]);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.fields).toEqual(
      expect.arrayContaining(["currency", "exchange", "isin", "marketDataID"]),
    );
  });

  it("requires a full emission definition and a dated buy for each imported treasury bond", () => {
    const bond = {
      id: "bond-ros",
      recordType: "asset",
      kind: "treasuryBond",
      symbol: "ROS0229",
      bondParams: {
        issueDate: "2023-02-27T00:00:00.000Z",
        maturityDate: "2029-02-27T00:00:00.000Z",
        nominalValue: 100,
        firstPeriodRate: 7.2,
        subsequentBase: "inflacja",
        marginOverBase: 1.5,
        capitalization: "roczna",
        interestPayment: "przy wykupie",
      },
    };

    expect(validateTreasuryBondImports([bond], [{ instrumentID: bond.id, transactionType: "buy", date: 1 }])).toEqual([]);

    const errors = validateTreasuryBondImports(
      [{ ...bond, bondParams: { ...bond.bondParams, issueDate: "" } }],
      [{ instrumentID: bond.id, transactionType: "buy", date: null }],
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]?.fields).toEqual(expect.arrayContaining(["bondParams.issueDate", "purchaseDate"]));
  });
});
