import { describe, expect, it } from "vitest";
import { marketQuoteInputsFromHistory } from "@/features/sync/market-quote-bootstrap";
import { currenciesNeedingFx } from "@/features/sync/market-fx-bootstrap";
import { resolveFxRate } from "@/domain/valuation/price-resolver";

describe("MarketQuoteBootstrap quote provenance", () => {
  it("uses the latest provider quote for the current value while retaining the provider currency", () => {
    const quotes = marketQuoteInputsFromHistory(
      { id: "vwrl", currency: "USD" },
      [
        {
          provider: "yahoo",
          symbol: "VWRL.L",
          currency: "GBP",
          date: "2026-07-15",
          open: 130,
          high: 132,
          low: 129,
          close: 131.25,
          volume: 10,
        },
      ],
      {
        provider: "yahoo",
        symbol: "VWRL.L",
        currency: "GBP",
        date: "2026-07-15",
        open: 130,
        high: 132,
        low: 129,
        close: 131.5,
        volume: 10,
      },
    );

    expect(quotes).toEqual([
      expect.objectContaining({
        instrumentID: "vwrl",
        price: 131.5,
        currency: "GBP",
        date: new Date("2026-07-15T00:00:00.000Z"),
      }),
    ]);
    expect(currenciesNeedingFx([], quotes)).toEqual(["GBP"]);
    expect(
      resolveFxRate("GBP", [], quotes[0]!.date, [
        { currency: "GBP", rate: 5.1234, date: quotes[0]!.date },
      ]),
    ).toMatchObject({ rate: 5.1234, source: "history" });
  });

  it("does not replace a newer history session with a stale latest quote", () => {
    const quotes = marketQuoteInputsFromHistory(
      { id: "icom", currency: "USD" },
      [{
        provider: "yahoo",
        symbol: "ICOM.L",
        currency: "USD",
        date: "2026-07-15",
        open: 8.6,
        high: 8.7,
        low: 8.5,
        close: 8.6595,
        volume: 10,
      }],
      {
        provider: "yahoo",
        symbol: "ICOM.L",
        currency: "USD",
        date: "2026-07-14",
        open: 8.7,
        high: 8.8,
        low: 8.6,
        close: 8.7648,
        volume: 10,
      },
    );

    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toMatchObject({ price: 8.6595, date: new Date("2026-07-15T00:00:00.000Z") });
  });
});
