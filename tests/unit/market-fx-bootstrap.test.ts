import { describe, expect, it } from "vitest";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";
import { currenciesNeedingFx } from "@/features/sync/market-fx-bootstrap";

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
});
