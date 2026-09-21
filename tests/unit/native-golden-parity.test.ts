import { describe, expect, it } from "vitest";
import allTypes from "../fixtures/native-golden/all_transaction_types.json";
import diversified from "../fixtures/native-golden/diversified_portfolio.json";
import { buildGoldenRecords, type GoldenScenario } from "./helpers/native-golden";
import {
  buildInvestorDataSnapshot,
  buildPortfolioDetail,
} from "@/sync/records/investor-snapshot";

// Parytet z natywnymi testami: te same wejścia, te same oczekiwane liczby.
// Silniki (Swift i TS) są dwiema niezależnymi implementacjami — ten plik jest
// jedynym miejscem, w którym ktoś porównuje ich wyniki metryk wydajności.
// Rozjazd to błąd parytetu do zgłoszenia, nie liczba do „poprawienia” tutaj.

function evaluate(fixture: unknown) {
  const scenario = fixture as GoldenScenario;
  const built = buildGoldenRecords(scenario);
  const options = {
    asOf: built.asOf,
    fxRates: built.fxRates,
    cpi: built.cpi,
    metricsCpi: built.cpi,
    useMarketQuotes: true,
    historyGranularity: "daily" as const,
  };
  const snapshot = buildInvestorDataSnapshot(built.records, { ...options, strict: true });
  const detail = buildPortfolioDetail(built.records, built.portfolioId, options)!;
  return { scenario, snapshot, detail, expected: scenario.expected, built };
}

const holdingValue = (detail: ReturnType<typeof evaluate>["detail"], symbol: string) =>
  detail.holdings.find((h) => h.symbol === symbol);

describe("złoty scenariusz: wszystkie typy transakcji (natywny all_transaction_types)", () => {
  const { scenario, snapshot, detail, expected } = evaluate(allTypes);

  it("wartość portfela i gotówka", () => {
    expect(snapshot.totalValue).toBeCloseTo(expected.totalValue, 2);
    expect(snapshot.cash).toBeCloseTo(expected.cashValue, 2);
    const holdings = detail.holdings.reduce((sum, h) => sum + h.marketValue, 0);
    expect(holdings).toBeCloseTo(expected.holdingsValue, 2);
  });

  it("salda gotówki per waluta", () => {
    for (const [currency, amount] of Object.entries(expected.cashBalances as Record<string, number>)) {
      const row = detail.cashBalances.find((b) => b.currency === currency);
      expect(row?.amount ?? 0, currency).toBeCloseTo(amount, 2);
    }
  });

  it("ilości pozycji (zamknięta lokata = brak pozycji)", () => {
    for (const [symbol, quantity] of Object.entries(expected.positions as Record<string, number>)) {
      expect(holdingValue(detail, symbol)?.quantity ?? 0, symbol).toBeCloseTo(quantity, 4);
    }
  });

  it("zrealizowany i niezrealizowany P/L", () => {
    expect(snapshot.metrics.realizedPnl).toBeCloseTo(expected.realizedPnL, 2);
    expect(snapshot.metrics.unrealizedPnl).toBeCloseTo(expected.unrealizedPnL, 2);
  });

  it("pierwszy i ostatni punkt serii wartości", () => {
    expect(snapshot.valuationSeries[0].value).toBeCloseTo(expected.firstSnapshotValue, 2);
    expect(snapshot.valuationSeries.at(-1)!.value).toBeCloseTo(expected.lastSnapshotValue, 2);
  });

  it("maksymalne obsunięcie", () => {
    expect(snapshot.metrics.maxDrawdownPct).toBeCloseTo(expected.maxDrawdown, 2);
  });

  // Te cztery sprawdzają przepływy zewnętrzne. Fixtura zawiera wpłatę 100 USD bez
  // `fxRateToBase`; przy kursie USD/PLN = 4 to 400 zł. Silnik webowy liczył ją 1:1
  // (100 zł), więc wartość portfela już zawierała 400 zł, a przepływ tylko 100 zł —
  // fantomowy zysk 300 zł zawyżał TWR z 9,68% do 12,62% (niezależny rachunek
  // z serii dziennej odtwarza obie liczby co do 10 cyfr).
  it("TWR (zwrot ważony czasem)", () => {
    expect(snapshot.metrics.totalReturnPct).toBeCloseTo(expected.twr, 2);
  });

  it("XIRR (zwrot ważony kwotą)", () => {
    expect(snapshot.metrics.xirrPct).not.toBeNull();
    expect(snapshot.metrics.xirrPct!).toBeCloseTo(expected.xirr, 2);
  });

  it("CAGR", () => {
    expect(snapshot.metrics.cagrPct).toBeCloseTo(expected.cagr, 2);
  });

  it("zwrot realny po inflacji", () => {
    expect(snapshot.metrics.realReturnPct).toBeCloseTo(expected.realReturn, 2);
  });

  // Sumy widoczne dla użytkownika: pola prowizji/podatku transakcji PLUS osobne transakcje
  // „opłata” i „podatek” (12 + 25 = 37, 54 + 30 = 84). Natywnie tak liczy `ExtendedStats`,
  // a od niedawna także migawki historii i eksport CSV.
  it("opłaty i podatki razem (z osobnymi transakcjami fee/tax)", () => {
    expect(snapshot.cashflows.fees).toBeCloseTo(expected.feesTotal, 2);
    expect(snapshot.cashflows.taxes).toBeCloseTo(expected.taxesTotal, 2);
  });

  // Natywne `dividendsInterest` (330) wlicza zysk z zamkniętej lokaty (2100 − 2000 = 100);
  // web pomijał go (230). Od tej zmiany oba liczą tak samo.
  it("dywidendy + odsetki wliczają zysk z lokaty (jak natywnie)", () => {
    expect(snapshot.cashflows.dividends + snapshot.cashflows.interest).toBeCloseTo(
      expected.dividendsInterest,
      2,
    );
  });
});

describe("złoty scenariusz: portfel wielowalutowy (natywny diversified_portfolio)", () => {
  const { scenario, snapshot, detail, expected } = evaluate(diversified);

  it("wartość portfela, pozycje i gotówka po kursach z dnia wyceny", () => {
    expect(snapshot.totalValue).toBeCloseTo(expected.totalValue, 2);
    expect(snapshot.cash).toBeCloseTo(expected.cashValue, 2);
    const holdings = detail.holdings.reduce((sum, h) => sum + h.marketValue, 0);
    expect(holdings).toBeCloseTo(expected.holdingsValue, 2);
  });

  // Różnica definicji, nie błąd: koszt pozycji w walucie obcej web przelicza kursem
  // z dnia zakupu (USD 4,0, EUR 4,5 → 5125 zł, więc P/L 1180 zawiera zysk kursowy),
  // natywny `ValuationEngine` — kursem bieżącym (4,2 i 4,6 → 5350 zł, P/L 955 bez
  // efektu kursu). Web jest tu spójny z serią wyniku (`pnlSeriesLastValue` = 1180).
  it("niezrealizowany P/L: koszt po kursie z dnia zakupu (natywnie: po bieżącym)", () => {
    const costAtPurchaseFx = scenario.transactions
      .filter((t) => t.type === "buy")
      .reduce((sum, t) => sum + t.grossAmount * (t.fxRateToBase ?? 1), 0);
    expect(snapshot.metrics.unrealizedPnl).toBeCloseTo(expected.holdingsValue - costAtPurchaseFx, 2);
    expect(snapshot.metrics.unrealizedPnl).toBeCloseTo(expected.pnlSeriesLastValue, 2);
    expect(snapshot.metrics.unrealizedPnl).not.toBeCloseTo(expected.unrealizedPnL, 2);
  });

  it("seria wartości: początek i koniec", () => {
    expect(snapshot.valuationSeries[0].value).toBeCloseTo(expected.firstSnapshotValue, 2);
    expect(snapshot.valuationSeries.at(-1)!.value).toBeCloseTo(expected.lastSnapshotValue, 2);
  });

  it("wynik od początku (P/L z serii) = wartość − wpłaty", () => {
    expect(snapshot.totalValue - snapshot.metrics.netInvested).toBeCloseTo(expected.pnlSeriesLastValue, 2);
  });
});
