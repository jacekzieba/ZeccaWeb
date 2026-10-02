import { describe, expect, it } from "vitest";
import {
  marketDataExchangeForSymbol,
  marketDataIDAfterEdit,
  marketDataSymbolForInstrument,
  suggestedMarketDataID,
  yahooSymbolForInstrument,
} from "@/market-data/symbols";

describe("yahooSymbolForInstrument", () => {
  it("keeps US symbols without a suffix", () => {
    expect(yahooSymbolForInstrument("aapl", "USD")).toBe("AAPL");
    expect(yahooSymbolForInstrument("aapl.us", "USD")).toBe("AAPL");
  });

  it("maps Polish and UK instruments to Yahoo exchange suffixes", () => {
    expect(yahooSymbolForInstrument("cdr", "PLN")).toBe("CDR.WA");
    expect(yahooSymbolForInstrument("cdr.pl", "PLN")).toBe("CDR.WA");
    expect(yahooSymbolForInstrument("vod", "GBP")).toBe("VOD.L");
    expect(yahooSymbolForInstrument("vod.uk", "GBP")).toBe("VOD.L");
    expect(yahooSymbolForInstrument("vwrl.nl", "EUR")).toBe("VWRL.AS");
  });

  it("preserves explicit Yahoo symbols", () => {
    expect(yahooSymbolForInstrument("BRK-B", "USD")).toBe("BRK-B");
    expect(yahooSymbolForInstrument("EURPLN=X", "PLN")).toBe("EURPLN=X");
  });

  it("uses the broker-compatible Yahoo line before legacy suffixes", () => {
    expect(
      marketDataSymbolForInstrument({
        symbol: "VWRL.NL",
        currency: "USD",
        isin: "IE00B3RBWM25",
      }),
    ).toBe("VWRL.L");
    expect(
      marketDataSymbolForInstrument({
        symbol: "ICOM.UK",
        currency: "USD",
        isin: "IE00BDFL4P12",
      }),
    ).toBe("ICOM.L");
    expect(
      marketDataSymbolForInstrument({ symbol: "VWRL.NL", currency: "EUR" }),
    ).toBe("VWRL.AS");
  });

  it("prefers an explicit market-data identifier", () => {
    expect(
      marketDataSymbolForInstrument({
        symbol: "VWRL.NL",
        currency: "USD",
        isin: "IE00B3RBWM25",
        marketDataID: "VWCE.DE",
      }),
    ).toBe("VWCE.DE");
  });

  it("identifies the quote venue from a verified Yahoo listing", () => {
    expect(marketDataExchangeForSymbol("VWRL.L")).toBe("LSE");
    expect(marketDataExchangeForSymbol("VWRL.AS")).toBe("Euronext Amsterdam");
  });
});

// Te same przypadki co w natywnym MarketDataIdentityResolver (Zecca/Sources/
// InvestorDomain) — web i aplikacje muszą wyliczać identyczny symbol notowań.
describe("suggestedMarketDataID", () => {
  it("picks the VWRL line from the settlement currency", () => {
    expect(suggestedMarketDataID("VWRL.NL", "EUR")).toBe("VWRL.AS");
    expect(suggestedMarketDataID("vwrl", "eur")).toBe("VWRL.AS");
    expect(suggestedMarketDataID("VWRL.NL", "USD")).toBe("VWRL.L");
    expect(suggestedMarketDataID("VWRL", "GBP")).toBe("VWRL.L");
    expect(suggestedMarketDataID("VWRL.NL", "PLN")).toBeNull();
  });

  it("maps XTB venue suffixes to Yahoo listings", () => {
    expect(suggestedMarketDataID("ICOM.UK", "USD")).toBe("ICOM.L");
    expect(suggestedMarketDataID("ICOM.L", "GBP")).toBe("ICOM.L");
    expect(suggestedMarketDataID("IWDA.NL", "EUR")).toBe("IWDA.AS");
    expect(suggestedMarketDataID("VOD.UK", "GBP")).toBe("VOD.L");
    expect(suggestedMarketDataID("VOD.GB", "GBP")).toBe("VOD.L");
    expect(suggestedMarketDataID("CDR.PL", "PLN")).toBe("CDR.WA");
  });

  it("keeps other dotted symbols and does not guess bare tickers", () => {
    expect(suggestedMarketDataID("VWCE.DE", "EUR")).toBe("VWCE.DE");
    expect(suggestedMarketDataID("AAPL.US", "USD")).toBe("AAPL.US");
    expect(suggestedMarketDataID("AAPL", "USD")).toBeNull();
    expect(suggestedMarketDataID("  ", "USD")).toBeNull();
  });
});

describe("marketDataIDAfterEdit", () => {
  function after(
    currency: string,
    previous: string | null,
    typed: string,
    { symbol = "VWRL.NL", previousCurrency = "USD" } = {},
  ) {
    return marketDataIDAfterEdit({
      symbol,
      currency,
      previousSymbol: "VWRL.NL",
      previousCurrency,
      previousMarketDataID: previous,
      editedMarketDataID: typed,
    });
  }

  it("re-derives an untouched old listing when the currency changes", () => {
    expect(after("EUR", "VWRL.L", "VWRL.L")).toBe("VWRL.AS");
  });

  it("re-derives an untouched bare symbol when the currency changes", () => {
    // Prawdziwy przypadek: VWRL.NL przestawiony z USD na EUR zostawał
    // z „VWRL” (linia londyńska w GBP, Yahoo zwraca cenę 0).
    expect(after("EUR", "VWRL", "VWRL")).toBe("VWRL.AS");
  });

  it("lets a symbol typed in this edit win", () => {
    expect(after("EUR", "VWRL.L", "vwrl.mi")).toBe("VWRL.MI");
  });

  it("derives a cleared field from symbol and currency", () => {
    expect(after("EUR", "VWRL.L", "  ")).toBe("VWRL.AS");
  });

  it("keeps the explicit symbol when nothing about the listing changed", () => {
    expect(after("USD", "VWRL.L", "VWRL.L")).toBe("VWRL.L");
  });

  it("re-derives when the broker symbol changes", () => {
    expect(after("USD", "VWRL.L", "VWRL.L", { symbol: "ICOM.UK" })).toBe("ICOM.L");
  });

  it("keeps the old listing when a changed listing cannot be derived", () => {
    expect(after("PLN", "VWRL.L", "VWRL.L")).toBe("VWRL.L");
  });
});
