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
        marketQuotes: [],
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

  it("uses manual valuations before market and transaction prices", () => {
    const price = resolveInstrumentPrice(
      instrumentID,
      {
        assetCurrency: "USD",
        marketQuotes: [
          {
            instrumentID,
            price: 125,
            currency: "USD",
            date: new Date("2026-05-10T00:00:00.000Z"),
          },
        ],
        manualValuations: [
          {
            instrumentID,
            value: 110,
            currency: "USD",
            date: new Date("2026-05-09T00:00:00.000Z"),
          },
        ],
        transactions: [
          {
            instrumentID,
            price: 90,
            currency: "USD",
            date: new Date("2026-05-08T00:00:00.000Z"),
          },
        ],
      },
      new Date("2026-05-15T00:00:00.000Z"),
    );

    expect(price).toEqual({
      value: 110,
      currency: "USD",
      date: new Date("2026-05-09T00:00:00.000Z"),
      source: "manual",
    });
  });

  it("uses the latest market quote before transaction prices when no manual valuation exists", () => {
    const price = resolveInstrumentPrice(
      instrumentID,
      {
        assetCurrency: "USD",
        marketQuotes: [
          {
            instrumentID,
            price: 125,
            currency: "USD",
            date: new Date("2026-05-10T00:00:00.000Z"),
          },
        ],
        manualValuations: [],
        transactions: [
          {
            instrumentID,
            price: 90,
            currency: "USD",
            date: new Date("2026-05-08T00:00:00.000Z"),
          },
        ],
      },
      new Date("2026-05-15T00:00:00.000Z"),
    );

    expect(price).toEqual({
      value: 125,
      currency: "USD",
      date: new Date("2026-05-10T00:00:00.000Z"),
      source: "market",
    });
  });

  it("falls back to the latest priced transaction before or on the valuation date", () => {
    const price = resolveInstrumentPrice(
      instrumentID,
      {
        assetCurrency: "USD",
        marketQuotes: [],
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
          marketQuotes: [],
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

  // iOS zapisywał przy wymianie walut stosunek kwot jako fxRateToBase — przy
  // USD→EUR to 0,92 EUR za USD, nie kurs do PLN. Natywny resolver już takie
  // rekordy pomija (`Transaction.fallbackFXRateToBase`).
  it("ignores the amount ratio stored on a conversion into a non-PLN currency", () => {
    const rate = resolveFxRate(
      "USD",
      [
        {
          transactionType: "buy",
          currency: "USD",
          grossAmount: 100,
          fxRateToBase: 4,
          date: new Date("2026-04-01T00:00:00.000Z"),
        },
        {
          transactionType: "fxConversion",
          currency: "USD",
          grossAmount: 50,
          fxRateToBase: 0.92,
          targetCurrency: "EUR",
          targetGrossAmount: 46,
          date: new Date("2026-04-02T00:00:00.000Z"),
        },
      ],
      new Date("2026-05-15T00:00:00.000Z"),
    );

    expect(rate).toEqual({
      rate: 4,
      date: new Date("2026-04-01T00:00:00.000Z"),
      source: "transaction",
    });
  });

  // Dwie transakcje z tego samego dnia: wygrywa później zapisana (createdAt,
  // potem id), niezależnie od kolejności wierszy — tak jak natywny
  // `Transaction.ledgerOrder`. Wcześniej wygrywała ostatnia na liście.
  it("breaks a same-day tie by the later saved transaction", () => {
    const day = new Date("2026-04-02T00:00:00.000Z");
    const rate = resolveFxRate(
      "USD",
      [
        {
          id: "bbbbbbbb-0000-4000-8000-000000000002",
          transactionType: "buy",
          currency: "USD",
          grossAmount: 100,
          fxRateToBase: 4.2,
          createdAt: new Date("2026-04-02T10:00:00.000Z"),
          date: day,
        },
        {
          id: "aaaaaaaa-0000-4000-8000-000000000001",
          transactionType: "buy",
          currency: "USD",
          grossAmount: 100,
          fxRateToBase: 4.0,
          createdAt: new Date("2026-04-02T09:00:00.000Z"),
          date: day,
        },
      ],
      new Date("2026-05-15T00:00:00.000Z"),
    );

    expect(rate.rate).toBe(4.2);
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
