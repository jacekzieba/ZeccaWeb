import { describe, expect, it } from "vitest";
import cases from "../fixtures/native-golden/csv_cell_cases.json";
import { csvCell, incomeCsvLines, transactionsCsvLines } from "@/features/import/csv-export";
import type { TransactionRow } from "@/domain/models/investor-data";

// Kontrola krzyżowa z natywnym eksportem (audyt 2026-10-20, część 2).
describe("eksport CSV: parytet z aplikacją natywną", () => {
  // Ta sama fixtura co `testCSVCellMatchesSharedCases` w Zecca: tekst, który
  // arkusz wykona jako formułę (CWE-1236), dostaje apostrof; liczby zostają.
  it.each(cases.map((testCase) => [JSON.stringify(testCase.input), testCase] as const))("komórka %s", (_name, testCase) => {
    expect(csvCell(testCase.input)).toBe(testCase.expected);
  });

  it("liczby wychodzą bez apostrofu", () => {
    expect(csvCell(-12.5)).toBe("-12.5");
    expect(csvCell(null)).toBe("");
  });

  // Aplikacja zapisuje północ w Warszawie (dzień wcześniej w UTC), web północ
  // UTC. Dzień transakcji to dzień kalendarzowy w Polsce, jak w BOND-001.
  it("data transakcji to dzień w Polsce w obu kodowaniach", () => {
    const row = (date: string, transactionType = "dividend"): TransactionRow => ({
      id: date,
      date,
      portfolioId: "p",
      portfolioName: "=Portfel",
      instrumentId: null,
      instrumentSymbol: "VWCE",
      instrumentName: null,
      transactionType,
      quantity: null,
      price: null,
      grossAmount: 10,
      currency: "EUR",
      fees: 0,
      taxes: 0,
    });
    const fromApp = row("2026-05-31T22:00:00.000Z");
    const fromWeb = row("2026-07-01T00:00:00.000Z");

    expect(transactionsCsvLines([fromApp, fromWeb]).slice(1)).toEqual([
      "2026-06-01,'=Portfel,VWCE,dividend,,,10,EUR,0,0",
      "2026-07-01,'=Portfel,VWCE,dividend,,,10,EUR,0,0",
    ]);
    expect(incomeCsvLines([fromApp, row("2026-05-31T22:00:00.000Z", "buy")]).slice(1)).toEqual([
      "2026-06-01,'=Portfel,VWCE,dividend,10,EUR,0,0",
    ]);
  });
});
