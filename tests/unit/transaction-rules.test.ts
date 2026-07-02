import { describe, expect, it } from "vitest";
import {
  showsTaxField,
  showsFXSettlement,
  fxRateToBaseForSave,
  taxAppliesToType,
} from "@/features/transactions/transaction-rules";

// Parity with native `TransactionEditorDecisionLogicTests`.

describe("showsTaxField", () => {
  const taxedTypes = ["dividend", "interest", "bondCoupon", "sell", "bondRedemption", "depositClose"];

  it("hides the tax field on IKE/IKZE for every taxed type", () => {
    for (const type of taxedTypes) {
      expect(showsTaxField(type, "ike")).toBe(false);
      expect(showsTaxField(type, "ikze")).toBe(false);
    }
  });

  it("hides the tax field on IKE/IKZE using native raw values (display strings)", () => {
    // Real native sync writes PortfolioType.rawValue ("IKE"/"IKZE").
    expect(showsTaxField("dividend", "IKE")).toBe(false);
    expect(showsTaxField("sell", "IKZE")).toBe(false);
  });

  it("shows the tax field on taxable/bank accounts for taxed types", () => {
    for (const type of taxedTypes) {
      expect(showsTaxField(type, "taxable")).toBe(true);
      expect(showsTaxField(type, "Rachunek zwykły")).toBe(true);
      expect(showsTaxField(type, "Bank")).toBe(true);
      expect(showsTaxField(type, null)).toBe(true);
    }
  });

  it("hides the tax field for non-taxed types regardless of portfolio", () => {
    expect(showsTaxField("buy", "taxable")).toBe(false);
    expect(showsTaxField("cashDeposit", "taxable")).toBe(false);
    expect(showsTaxField("fxConversion", "Bank")).toBe(false);
  });

  it("taxAppliesToType matches the native Belka type set", () => {
    for (const type of taxedTypes) expect(taxAppliesToType(type)).toBe(true);
    expect(taxAppliesToType("buy")).toBe(false);
  });
});

describe("showsFXSettlement", () => {
  it("shows only for buy/sell in a non-PLN currency", () => {
    expect(showsFXSettlement("buy", "EUR")).toBe(true);
    expect(showsFXSettlement("sell", "usd")).toBe(true);
    expect(showsFXSettlement("buy", "PLN")).toBe(false);
    expect(showsFXSettlement("sell", "pln")).toBe(false);
    expect(showsFXSettlement("dividend", "EUR")).toBe(false);
    expect(showsFXSettlement("interest", "USD")).toBe(false);
  });
});

describe("fxRateToBaseForSave", () => {
  it("returns the rate for a foreign buy/sell settled in PLN with a positive rate", () => {
    expect(fxRateToBaseForSave({ type: "buy", currency: "EUR", settleInPLN: true, rate: 4.32 })).toBe(4.32);
  });

  it("returns null when settling in the foreign currency", () => {
    expect(fxRateToBaseForSave({ type: "buy", currency: "EUR", settleInPLN: false, rate: 4.32 })).toBeNull();
  });

  it("returns null for a non-positive or missing rate in PLN mode", () => {
    expect(fxRateToBaseForSave({ type: "buy", currency: "EUR", settleInPLN: true, rate: 0 })).toBeNull();
    expect(fxRateToBaseForSave({ type: "buy", currency: "EUR", settleInPLN: true, rate: -1 })).toBeNull();
    expect(fxRateToBaseForSave({ type: "buy", currency: "EUR", settleInPLN: true, rate: null })).toBeNull();
  });

  it("returns null when the FX block does not apply (PLN currency or other type)", () => {
    expect(fxRateToBaseForSave({ type: "buy", currency: "PLN", settleInPLN: true, rate: 4.32 })).toBeNull();
    expect(fxRateToBaseForSave({ type: "dividend", currency: "EUR", settleInPLN: true, rate: 4.32 })).toBeNull();
  });
});
