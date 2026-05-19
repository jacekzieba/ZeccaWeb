import { describe, expect, it } from "vitest";
import {
  stooqSymbolForInstrument,
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
  });

  it("preserves explicit Yahoo symbols", () => {
    expect(yahooSymbolForInstrument("BRK-B", "USD")).toBe("BRK-B");
    expect(yahooSymbolForInstrument("EURPLN=X", "PLN")).toBe("EURPLN=X");
  });
});

describe("stooqSymbolForInstrument", () => {
  it("maps Yahoo and raw symbols to Stooq suffixes", () => {
    expect(stooqSymbolForInstrument("AAPL", "USD")).toBe("aapl.us");
    expect(stooqSymbolForInstrument("CDR.WA", "PLN")).toBe("cdr.pl");
    expect(stooqSymbolForInstrument("VOD.L", "GBP")).toBe("vod.uk");
  });
});
