import { describe, expect, it } from "vitest";
import fixture from "../fixtures/native-golden/treasury_bond_calendar_days.json";
import { valueInstrumentPosition } from "@/domain/valuation/position-valuator";

// Wspólna fixtura z aplikacją natywną (TreasuryBondCalendarDayTests): obligacje
// detaliczne wyceniane po dniach kalendarzowych w Polsce. Daty są w formacie
// synchronizacji (sekundy od 2001-01-01): `app` to północ czasu warszawskiego
// (tak zapisuje aplikacja), `web` to północ UTC. Web czytał daty z aplikacji jako
// dzień wcześniej, więc EDO kupiona 1. dnia miesiąca brała CPI z niewłaściwego
// miesiąca (135,84 zł zamiast 132,94 zł).

const APPLE_REFERENCE_DATE_UNIX_MS = Date.UTC(2001, 0, 1);
const fromSwiftSeconds = (seconds: number) => new Date(APPLE_REFERENCE_DATE_UNIX_MS + seconds * 1000);

const cpi = Object.fromEntries(fixture.cpi.map((entry) => [entry.month, entry.yoy]));
const referenceRates = fixture.referenceRates.map((entry) => ({
  date: fromSwiftSeconds(entry.date),
  rate: entry.rate,
}));

describe("obligacje: dni kalendarzowe w Polsce (wspólna fixtura z aplikacją natywną)", () => {
  it("fixtura ma przypadki obu kodowań dat", () => {
    expect(fixture.cases.length).toBeGreaterThan(10);
    expect(new Set(fixture.cases.map((c) => c.dateEncoding))).toEqual(new Set(["app", "web"]));
  });

  it.each(fixture.cases.map((c) => [c.name, c] as const))("%s", (_, scenario) => {
    const bond = scenario.bond;
    const valuation = valueInstrumentPosition({
      instrumentID: "bond",
      quantity: 1,
      asset: {
        kind: "treasuryBond",
        currency: "PLN",
        bondParams: {
          issueDate: fromSwiftSeconds(bond.issueDate),
          maturityDate: fromSwiftSeconds(bond.maturityDate),
          nominalValue: bond.nominalValue,
          firstPeriodRate: bond.firstPeriodRate,
          subsequentBase: bond.subsequentBase,
          marginOverBase: bond.marginOverBase,
          capitalization: bond.capitalization,
          interestPayment: bond.interestPayment,
        },
      },
      lots: [{ purchaseDate: fromSwiftSeconds(scenario.purchaseDate), quantity: 1 }],
      dataset: { manualValuations: [], marketQuotes: [], transactions: [], fxRates: [], cpi, referenceRates },
      asOf: fromSwiftSeconds(scenario.asOf),
    });

    expect(valuation.price).toBeCloseTo(scenario.expectedPrice, 4);
  });
});
