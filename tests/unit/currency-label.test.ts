import { describe, expect, it } from "vitest";
import { currencyLabel } from "@/lib/money";

// Symbol tam, gdzie mierzy kwotę — pełna lista rozstrzygnięta po stronie
// natywnej (DisplayNumberFormatter.swift), zob. docs/superpowers/
// prompt-web-parytet-skarbiec.md w repo ~/Desktop/Zecca, punkt 4.
describe("currencyLabel", () => {
  it("zwraca symbol dla walut z ustalonej listy", () => {
    expect(currencyLabel("PLN")).toBe("zł");
    expect(currencyLabel("USD")).toBe("$");
    expect(currencyLabel("EUR")).toBe("€");
    expect(currencyLabel("GBP")).toBe("£");
    expect(currencyLabel("JPY")).toBe("¥");
    expect(currencyLabel("CZK")).toBe("Kč");
    expect(currencyLabel("SEK")).toBe("kr");
    expect(currencyLabel("NOK")).toBe("kr");
    expect(currencyLabel("DKK")).toBe("kr");
  });

  it("nieznany kod zostaje kodem", () => {
    expect(currencyLabel("CHF")).toBe("CHF");
    expect(currencyLabel("XYZ")).toBe("XYZ");
  });
});
