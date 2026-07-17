import { describe, expect, it } from "vitest";
import {
  bondCatalogueUrl,
  decomposeBondCode,
  parseBondEmissionLetter,
} from "@/market-data/providers/treasury-bond-params";

// Representative emission-letter prose, copied from the live pages (verified
// 2026-07). Wrapped in tags so the HTML stripper is exercised too.
function letter(body: string): string {
  return `<html><body><div class="offer"><p>${body}</p></div></body></html>`;
}

const EDO0736 = letter(
  "Seria: EDO0736 Oprocentowanie: 5,35% w pierwszym rocznym okresie odsetkowym, " +
    "w kolejnych rocznych okresach odsetkowych: marża 2,00% + inflacja " +
    "Kapitalizacja odsetek: roczna Wypłata odsetek: przy wykupie obligacji",
);

const TOS0729 = letter(
  "Seria: TOS0729 Oprocentowanie: 4,40%, stałe przez cały 3-letni okres oszczędzania " +
    "Kapitalizacja odsetek: roczna Wypłata odsetek: przy wykupie obligacji",
);

const ROR0727 = letter(
  "Seria: ROR0727 Oprocentowanie: 4,00% w skali roku, w pierwszym miesięcznym okresie " +
    "odsetkowym. W kolejnych miesięcznych okresach odsetkowych: stopa referencyjna NBP " +
    "Kapitalizacja odsetek: brak Wypłata odsetek: co miesiąc",
);

const COI0730 = letter(
  "Seria: COI0730 Oprocentowanie: 4,75%, w skali roku, w pierwszym rocznym okresie " +
    "odsetkowym. W kolejnych rocznych okresach odsetkowych: marża 1,50% + inflacja " +
    "Kapitalizacja odsetek: brak Wypłata odsetek: co roku",
);

describe("decomposeBondCode", () => {
  it("splits family and maturity", () => {
    expect(decomposeBondCode("ROD0338")).toEqual({ family: "ROD", maturityMonth: 3, maturityYear: 2038 });
  });
  it("rejects malformed or unknown families", () => {
    expect(decomposeBondCode("AAPL")).toBeNull();
    expect(decomposeBondCode("XXX0338")).toBeNull();
    expect(decomposeBondCode("EDO1338")).toBeNull();
  });
});

describe("bondCatalogueUrl", () => {
  it("builds the current per-series slug", () => {
    expect(bondCatalogueUrl("EDO0736")).toBe(
      "https://www.obligacjeskarbowe.pl/oferta-obligacji/obligacje-10-letnie-edo/edo0736/",
    );
  });
  it("returns null for a non-retail code", () => {
    expect(bondCatalogueUrl("AAPL")).toBeNull();
  });
});

describe("parseBondEmissionLetter", () => {
  it("parses a CPI-indexed EDO (margin + inflation, annual cap, at maturity)", () => {
    const params = parseBondEmissionLetter(EDO0736, "EDO0736")!;
    expect(params).toMatchObject({
      firstPeriodRate: 5.35,
      subsequentBase: "inflacja",
      marginOverBase: 2,
      capitalization: "roczna",
      interestPayment: "przy wykupie",
      nominalValue: 100,
    });
    expect(params.issueDate!.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(params.maturityDate.toISOString()).toBe("2036-07-01T00:00:00.000Z");
  });

  it("parses a fixed-coupon TOS (whole rate carried as the subsequent margin)", () => {
    const params = parseBondEmissionLetter(TOS0729, "TOS0729")!;
    expect(params).toMatchObject({
      firstPeriodRate: 4.4,
      subsequentBase: "stałe",
      marginOverBase: 4.4,
      interestPayment: "przy wykupie",
    });
    expect(params.issueDate!.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });

  it("parses a reference-rate ROR (monthly, no capitalisation)", () => {
    const params = parseBondEmissionLetter(ROR0727, "ROR0727")!;
    expect(params).toMatchObject({
      firstPeriodRate: 4,
      subsequentBase: "stopa referencyjna NBP",
      marginOverBase: 0,
      capitalization: "brak",
      interestPayment: "co miesiąc",
    });
  });

  it("parses a COI with annual payout and no capitalisation", () => {
    const params = parseBondEmissionLetter(COI0730, "COI0730")!;
    expect(params).toMatchObject({
      firstPeriodRate: 4.75,
      subsequentBase: "inflacja",
      marginOverBase: 1.5,
      capitalization: "brak",
      interestPayment: "co rok",
    });
  });

  it("returns null when the headline rate is absent", () => {
    expect(parseBondEmissionLetter(letter("Brak danych"), "EDO0736")).toBeNull();
  });
});
