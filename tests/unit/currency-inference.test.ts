import { describe, expect, it } from "vitest";
import { inferCurrencyFromFx } from "@/features/import/currency-inference";

// D2: recover an instrument's settlement currency from the observed FX ratio
// (|Amount| / (qty × price)) by matching it against candidate CCY→PLN rates on
// the trade date. Only a single, clearly-closest candidate resolves; anything
// ambiguous or out of tolerance stays unresolved (null) so the caller keeps the
// "?" placeholder rather than guessing.

describe("inferCurrencyFromFx", () => {
  it("picks the single closest candidate within tolerance (IEML.UK → GBP)", () => {
    const result = inferCurrencyFromFx(5.2, [
      { currency: "USD", rate: 4.0 },
      { currency: "EUR", rate: 4.3 },
      { currency: "GBP", rate: 5.1 },
    ]);
    expect(result).toBe("GBP");
  });

  it("returns null when two candidates are both within tolerance (ambiguous)", () => {
    const result = inferCurrencyFromFx(4.15, [
      { currency: "USD", rate: 4.1 },
      { currency: "EUR", rate: 4.2 },
    ]);
    expect(result).toBeNull();
  });

  it("returns null when no candidate is within tolerance", () => {
    const result = inferCurrencyFromFx(10, [
      { currency: "USD", rate: 4.0 },
      { currency: "GBP", rate: 5.1 },
    ]);
    expect(result).toBeNull();
  });

  it("returns null for a non-positive observed rate or empty candidates", () => {
    expect(inferCurrencyFromFx(0, [{ currency: "USD", rate: 4.0 }])).toBeNull();
    expect(inferCurrencyFromFx(5.2, [])).toBeNull();
  });
});
