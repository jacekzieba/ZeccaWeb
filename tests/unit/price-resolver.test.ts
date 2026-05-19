import { describe, expect, it } from "vitest";
import {
  resolveFxRate,
  resolveInstrumentPrice,
} from "@/domain/valuation/price-resolver";

const instrumentID = "22222222-2222-4222-8222-222222222222";

describe("resolveInstrumentPrice", () => {
  it("uses the latest manual valuation before or on the valuation date", () => {
    const price = resolveInstrumentPrice(
      instrumentID,
      {
        assetCurrency: "USD",
        manualValuations: [
          {
            instrumentID,
            value: 110,
            currency: "USD",
            date: new Date("2026-04-30T00:00:00.000Z"),
          },
          {
            instrumentID,
            value: 130,
            currency: "USD",
            date: new Date("2026-05-31T00:00:00.000Z"),
          },
        ],
        transactions: [
          {
            instrumentID,
            price: 90,
            currency: "USD",
            date: new Date("2026-04-01T00:00:00.000Z"),
          },
        ],
      },
      new Date("2026-05-15T00:00:00.000Z"),
    );

    expect(price).toEqual({
      value: 110,
      currency: "USD",
      date: new Date("2026-04-30T00:00:00.000Z"),
      source: "manual",
    });
  });

  it("falls back to the latest priced transaction before or on the valuation date", () => {
    const price = resolveInstrumentPrice(
      instrumentID,
      {
        assetCurrency: "USD",
        manualValuations: [],
        transactions: [
          {
            instrumentID,
            price: 90,
            currency: "USD",
            date: new Date("2026-04-01T00:00:00.000Z"),
          },
          {
            instrumentID,
            price: 95,
            currency: "USD",
            date: new Date("2026-05-20T00:00:00.000Z"),
          },
        ],
      },
      new Date("2026-05-15T00:00:00.000Z"),
    );

    expect(price).toMatchObject({
      value: 90,
      currency: "USD",
      source: "transaction",
    });
  });

  it("returns a deterministic missing price when no source is available", () => {
    expect(
      resolveInstrumentPrice(
        instrumentID,
        {
          assetCurrency: "EUR",
          manualValuations: [],
          transactions: [],
        },
        new Date("2026-05-15T00:00:00.000Z"),
      ),
    ).toEqual({
      value: 0,
      currency: "EUR",
      date: null,
      source: "missing",
    });
  });
});

describe("resolveFxRate", () => {
  it("resolves PLN as 1", () => {
    expect(resolveFxRate("PLN", [], new Date("2026-05-15T00:00:00.000Z"))).toEqual({
      rate: 1,
      date: new Date("2026-05-15T00:00:00.000Z"),
      source: "pln",
    });
  });

  it("uses the latest historical FX rate before or on the valuation date", () => {
    const rate = resolveFxRate(
      "USD",
      [
        {
          transactionType: "buy",
          currency: "USD",
          grossAmount: 500,
          fxRateToBase: 4,
          date: new Date("2026-04-02T00:00:00.000Z"),
        },
      ],
      new Date("2026-05-15T00:00:00.000Z"),
      [
        {
          currency: "USD",
          rate: 4.1,
          date: new Date("2026-04-30T00:00:00.000Z"),
        },
        {
          currency: "USD",
          rate: 4.2,
          date: new Date("2026-05-31T00:00:00.000Z"),
        },
      ],
    );

    expect(rate).toEqual({
      rate: 4.1,
      date: new Date("2026-04-30T00:00:00.000Z"),
      source: "history",
    });
  });

  it("uses direct transaction FX before conversion-derived rates", () => {
    const rate = resolveFxRate(
      "USD",
      [
        {
          transactionType: "fxConversion",
          currency: "PLN",
          grossAmount: 4_200,
          targetCurrency: "USD",
          targetGrossAmount: 1_000,
          date: new Date("2026-04-01T00:00:00.000Z"),
        },
        {
          transactionType: "buy",
          currency: "USD",
          grossAmount: 500,
          fxRateToBase: 4,
          date: new Date("2026-04-02T00:00:00.000Z"),
        },
      ],
      new Date("2026-05-15T00:00:00.000Z"),
    );

    expect(rate).toEqual({
      rate: 4,
      date: new Date("2026-04-02T00:00:00.000Z"),
      source: "transaction",
    });
  });

  it("falls back to inverse FX conversion rates", () => {
    const rate = resolveFxRate(
      "USD",
      [
        {
          transactionType: "fxConversion",
          currency: "PLN",
          grossAmount: 4_200,
          targetCurrency: "USD",
          targetGrossAmount: 1_000,
          date: new Date("2026-04-01T00:00:00.000Z"),
        },
      ],
      new Date("2026-05-15T00:00:00.000Z"),
    );

    expect(rate).toEqual({
      rate: 4.2,
      date: new Date("2026-04-01T00:00:00.000Z"),
      source: "fxConversion",
    });
  });
});
