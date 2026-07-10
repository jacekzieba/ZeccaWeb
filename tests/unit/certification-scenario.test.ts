import { describe, expect, it } from "vitest";
import {
  buildInvestorDataSnapshot,
  buildPortfolioDetail,
} from "@/sync/records/investor-snapshot";
import type { HoldingRow } from "@/domain/models/investor-data";
import {
  ASOF,
  CPI,
  FX,
  IKE_ID,
  IKZE_ID,
  TAXABLE_ID,
  buildCertificationRecords,
} from "./helpers/certification-records";

// Web parity with the native certification suite. Every expected amount is a
// frozen anchor from the native plan, hand-verified against the native engines.
// A mismatch is a cross-platform parity bug — report it with the numbers below,
// do NOT adjust the expectation.
describe("certification scenario — web parity", () => {
  const records = buildCertificationRecords();
  const snapshot = buildInvestorDataSnapshot(records, {
    fxRates: FX,
    asOf: ASOF,
    cpi: CPI,
  });
  const byId = new Map(snapshot.portfolios.map((p) => [p.id, p]));

  const holding = (portfolioId: string, symbol: string): HoldingRow => {
    const detail = buildPortfolioDetail(records, portfolioId, {
      fxRates: FX,
      asOf: ASOF,
      cpi: CPI,
    });
    const row = detail?.holdings.find((h) => h.symbol === symbol);
    if (!row) throw new Error(`holding ${symbol} not found in ${portfolioId}`);
    return row;
  };

  it("IKE: total, cash and per-instrument market values", () => {
    expect(byId.get(IKE_ID)!.value).toBeCloseTo(108_037.1, 2);

    const detail = buildPortfolioDetail(records, IKE_ID, { fxRates: FX, asOf: ASOF, cpi: CPI })!;
    expect(detail.cashValue).toBeCloseTo(28_167.1, 2);

    expect(holding(IKE_ID, "VWCE.DE").marketValue).toBeCloseTo(30_360, 2);
    expect(holding(IKE_ID, "CSPX.UK").marketValue).toBeCloseTo(43_680, 2);
    expect(holding(IKE_ID, "IEML.UK").marketValue).toBeCloseTo(5_830, 2);
  });

  it("IKZE: total, cash and EDO0432 valued via injected CPI (matured TOS0626 gone)", () => {
    expect(byId.get(IKZE_ID)!.value).toBeCloseTo(8_706.31, 2);

    const detail = buildPortfolioDetail(records, IKZE_ID, { fxRates: FX, asOf: ASOF, cpi: CPI })!;
    expect(detail.cashValue).toBeCloseTo(4_148.05, 2);

    // 40 units × dirty 113.9566343151 = 4558.2654.
    expect(holding(IKZE_ID, "EDO0432").marketValue).toBeCloseTo(4_558.27, 2);
    expect(detail.holdings.some((h) => h.symbol === "TOS0626")).toBe(false);
  });

  it("Portfel zwykły: total, cash, stocks and the settled/active deposits", () => {
    expect(byId.get(TAXABLE_ID)!.value).toBeCloseTo(62_945.3, 2);

    const detail = buildPortfolioDetail(records, TAXABLE_ID, { fxRates: FX, asOf: ASOF, cpi: CPI })!;
    expect(detail.cashValue).toBeCloseTo(30_505.3, 2);

    expect(holding(TAXABLE_ID, "CDR").marketValue).toBeCloseTo(4_480, 2);
    expect(holding(TAXABLE_ID, "PKN").marketValue).toBeCloseTo(7_040, 2);
    expect(holding(TAXABLE_ID, "ALE").marketValue).toBeCloseTo(5_920, 2);
    // Lokata B active → 15000; Lokata A closed → no open position.
    expect(holding(TAXABLE_ID, "LOKATA-B").marketValue).toBeCloseTo(15_000, 2);
    expect(detail.holdings.some((h) => h.symbol === "LOKATA-A")).toBe(false);
  });

  it("dashboard total across all three portfolios", () => {
    expect(snapshot.totalValue).toBeCloseTo(179_688.71, 2);
  });
});
