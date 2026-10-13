import { describe, expect, it } from "vitest";
import { marketDataCandidates } from "@/market-data/symbols";

describe("marketDataCandidates", () => {
  it("goły ticker w USD: najpierw sam symbol (akcje USA), potem Londyn", () => {
    expect(marketDataCandidates({ symbol: "IEMA", currency: "USD" })).toEqual([
      "IEMA", "IEMA.L", "IEMA.AS", "IEMA.DE",
    ]);
  });

  it("goły ticker w EUR: giełdy europejskie przed gołym symbolem", () => {
    expect(marketDataCandidates({ symbol: "IEMA", currency: "EUR" })).toEqual([
      "IEMA.AS", "IEMA.DE", "IEMA.L", "IEMA",
    ]);
  });

  it("PLN i GBP wskazują Warszawę i Londyn", () => {
    expect(marketDataCandidates({ symbol: "CBU", currency: "PLN" })[0]).toBe("CBU.WA");
    expect(marketDataCandidates({ symbol: "VUSA", currency: "GBP" })[0]).toBe("VUSA.L");
  });

  it("goły marketDataID nie blokuje wyboru giełdy", () => {
    expect(marketDataCandidates({ symbol: "IEMA", currency: "USD", marketDataID: "IEMA" })).toEqual([
      "IEMA",
      "IEMA.L",
      "IEMA.AS",
      "IEMA.DE",
    ]);
  });

  it("jawne marketDataID jest jedynym kandydatem", () => {
    expect(
      marketDataCandidates({ symbol: "IEMA", currency: "USD", marketDataID: "iema.as" }),
    ).toEqual(["IEMA.AS"]);
  });

  it("sufiksy XTB zachowują dotychczasowe mapowanie", () => {
    expect(marketDataCandidates({ symbol: "VWRL.NL", currency: "USD", isin: "IE00B3RBWM25" })).toEqual(["VWRL.L"]);
    expect(marketDataCandidates({ symbol: "VWRL.NL", currency: "EUR" })).toEqual(["VWRL.AS"]);
  });
});
