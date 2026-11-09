import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBondEmissionLetter } from "@/market-data/providers/treasury-bond-params";

const root = resolve(process.cwd(), "tests/fixtures/bond-pages");
const issues = JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8")) as {
  code: string; firstPeriodRate: number; marginOverBase: number; earlyRedemptionFee: number;
}[];
const page = (code: string) => readFileSync(resolve(root, `${code}.html`), "utf8");

describe("issuer page safety", () => {
  it.each(issues)("reads reviewed fields for $code", issue => {
    expect(parseBondEmissionLetter(page(issue.code), issue.code)).toMatchObject({
      firstPeriodRate: issue.firstPeriodRate, marginOverBase: issue.marginOverBase,
      earlyRedemptionFee: issue.earlyRedemptionFee, parserVersion: 2,
    });
  });
  const badPages = [
    (html: string) => html.replaceAll("ROD0135", "EDO1233"),
    (html: string) => html.replaceAll("Seria:", "Nazwa:"),
    (html: string) => html.replaceAll("7,50%", "brak danych"),
    (html: string) => html.replaceAll("marża 1,75%", "brak marży"),
    (html: string) => html.replaceAll("2,00 zł", "nieznana opłata"),
    (html: string) => html.replaceAll("marża 1,75%", "marża 1,75% lub marża 2,00%"),
    (html: string) => html.replaceAll("2,00 zł", "2,00 zł od każdej obligacji albo 3,00 zł"),
    (html: string) => html.replaceAll("2,00 zł", "1000 zł"),
    (html: string) => html.replaceAll("2,00 zł", "1,005 zł"),
    (html: string) => html.replaceAll("2,00 zł", "1 000 zł"),
  ];
  it.each(badPages.map((mutate, index) => ({ mutate, index })))("rejects unsafe page $index", ({ mutate }) => {
    expect(parseBondEmissionLetter(mutate(page("ROD0135")), "ROD0135")).toBeNull();
  });
  it("ignores unrelated marketing and does not use it to fill a missing rate", () => {
    const marketing = "<p>Oprocentowanie: 9,99% w pierwszym rocznym okresie odsetkowym; marża 8,00%.</p>";
    expect(parseBondEmissionLetter(marketing + page("ROD0135"), "ROD0135")?.firstPeriodRate).toBe(7.5);
    expect(parseBondEmissionLetter(page("ROD0135").replaceAll("7,50%", "brak") + marketing, "ROD0135")).toBeNull();
  });
});
