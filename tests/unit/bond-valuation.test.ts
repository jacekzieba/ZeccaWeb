import { describe, expect, it } from "vitest";
import {
  valueInstrumentPosition,
  type BondParamsInput,
  type PositionValuationDataset,
} from "@/domain/valuation/position-valuator";
import { bondPeriodRate, inflationReferenceRate } from "@/domain/valuation/bond-rates";
import { normalizeTreasuryBondParams } from "@/domain/valuation/treasury-bond-issues";

const EMPTY_DATASET: PositionValuationDataset = {
  manualValuations: [],
  marketQuotes: [],
  transactions: [],
  fxRates: [],
};

/** Wartość bieżąca jednej obligacji (per sztuka) liczona przez silnik. */
function unitPrice(
  bondParams: BondParamsInput,
  purchaseDate: Date,
  asOf: Date,
): number {
  return valueInstrumentPosition({
    instrumentID: "00000000-0000-4000-8000-000000000000",
    quantity: 1,
    asset: { kind: "treasuryBond", currency: "PLN", bondParams },
    lots: [{ purchaseDate, quantity: 1 }],
    dataset: EMPTY_DATASET,
    asOf,
  }).price;
}

const inflationParams = (
  maturity: string,
  firstPeriodRate: number,
  marginOverBase: number,
): BondParamsInput => ({
  maturityDate: new Date(maturity),
  nominalValue: 100,
  firstPeriodRate,
  subsequentBase: "inflacja",
  marginOverBase,
  capitalization: "roczna",
  interestPayment: "przy wykupie",
});

describe("treasury bond inflation-indexed valuation", () => {
  // Stan na dzień zrzutu ekranu użytkownika.
  const asOf = new Date("2026-06-21T00:00:00.000Z");

  // Emisje, kwoty i daty zakupu/wykupu jak w portfelu użytkownika.
  // Oczekiwane wartości bieżące per sztuka pochodzą z obligacjeskarbowe.pl.
  const holdings = [
    {
      code: "ROS1228",
      params: inflationParams("2028-12-22T00:00:00.000Z", 7.2, 1.5),
      purchase: new Date("2022-12-22T00:00:00.000Z"),
      quantity: 15,
      expectedUnit: 126.05,
    },
    {
      code: "ROS0229",
      params: inflationParams("2029-02-27T00:00:00.000Z", 7.2, 1.5),
      purchase: new Date("2023-02-27T00:00:00.000Z"),
      quantity: 100,
      expectedUnit: 124.11,
    },
    {
      code: "ROS1129",
      params: inflationParams("2029-11-30T00:00:00.000Z", 6.95, 1.75),
      purchase: new Date("2023-11-30T00:00:00.000Z"),
      quantity: 20,
      expectedUnit: 117.01,
    },
    {
      code: "ROD0338",
      params: inflationParams("2038-03-27T00:00:00.000Z", 5.85, 2.5),
      purchase: new Date("2026-03-27T00:00:00.000Z"),
      quantity: 50,
      expectedUnit: 101.38,
    },
  ];

  it.each(holdings)(
    "reproduces official current value for $code",
    ({ params, purchase, expectedUnit }) => {
      // Tolerancja 0,05 zł — oficjalna wartość jest zaokrąglana do grosza.
      expect(unitPrice(params, purchase, asOf)).toBeCloseTo(expectedUnit, 1);
    },
  );

  it("reproduces the portfolio total of 21 710,95 zł", () => {
    const total = holdings.reduce((sum, h) => {
      const perBond = Math.round(unitPrice(h.params, h.purchase, asOf) * 100) / 100;
      return sum + perBond * h.quantity;
    }, 0);
    expect(total).toBeCloseTo(21_710.95, 2);
  });

  it("normalizes legacy synced issue params before valuation", () => {
    const legacyParams = inflationParams("2029-02-01T00:00:00.000Z", 1.5, 1.5);
    const normalized = normalizeTreasuryBondParams("ROS0229", legacyParams);

    expect(normalized.firstPeriodRate).toBe(7.2);
    expect(normalized.maturityDate.toISOString()).toBe("2029-02-27T00:00:00.000Z");
    expect(unitPrice(normalized, new Date("2023-02-27T00:00:00.000Z"), asOf))
      .toBeCloseTo(124.11, 1);
  });

  it("uses inflation + margin (not margin alone) for periods after year 1", () => {
    // ROS1228 okres 2 startuje 2022-12-22 + 1 rok = 2023-12-22.
    // Referencja inflacji = CPI z października 2023 = 6,6%.
    const periodStart = new Date("2023-12-22T00:00:00.000Z");
    expect(inflationReferenceRate(periodStart)).toBe(6.6);
    const rate = bondPeriodRate(
      { firstPeriodRate: 7.2, subsequentBase: "inflacja", marginOverBase: 1.5 },
      1,
      periodStart,
    );
    expect(rate).toBeCloseTo(8.1, 5); // 6,6% inflacja + 1,5% marża
  });

  it("treats a 'stałe' bond as a fixed coupon", () => {
    const rate = bondPeriodRate(
      { firstPeriodRate: 7.0, subsequentBase: "stałe", marginOverBase: 6.4 },
      2,
      new Date("2025-01-01T00:00:00.000Z"),
    );
    expect(rate).toBe(6.4);
  });
});
