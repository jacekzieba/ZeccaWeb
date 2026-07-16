import { describe, expect, it } from "vitest";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";
import {
  currenciesNeedingFx,
  marketFxSeriesPath,
} from "@/features/sync/market-fx-bootstrap";

describe("MarketFxBootstrap currency collection", () => {
  it("keeps valid record and quote currencies while discarding placeholders", () => {
    const records = [
      {
        deletedAt: null,
        envelope: { payload: { currency: "USD", targetCurrency: "?" } },
      },
      {
        deletedAt: null,
        envelope: { payload: { currency: " PLN " } },
      },
    ] as DecryptedRecord[];

    expect(currenciesNeedingFx(records, [{ currency: "GBP" }, { currency: "?" }])).toEqual([
      "GBP",
      "USD",
    ]);
  });

  it("requests historical FX coverage before the first valuation day", () => {
    expect(marketFxSeriesPath("GBP", "2026-05-01", "2026-05-04")).toBe(
      "/api/market-data/fx?code=GBP&start=2026-04-17&end=2026-05-04",
    );
  });
});
