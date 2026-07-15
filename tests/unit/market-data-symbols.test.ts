import { describe, expect, it } from "vitest";
import {
  marketDataSymbolForInstrument,
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
});
