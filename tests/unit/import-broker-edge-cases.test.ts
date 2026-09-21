import { describe, expect, it } from "vitest";
import { parseXtbXlsx } from "@/features/import/xtb-parser";
import { parsePkoBondsXls } from "@/features/import/pko-parser";
import type { ImportReferenceData } from "@/features/import/import-parser";
import { parseSpreadsheetNumber } from "@/lib/parse-amount";
import { Rng } from "./helpers/random-book";

// Pliki brokerów (XTB .xlsx, PKO Obligacje .xls) przychodzą już jako tablice wierszy.
// Testy sprawdzają nagłówki w nietypowych miejscach, daty jako serial Excela, liczby
// zapisane tekstem i puste/uszkodzone wiersze: import ma je ostrzec albo pominąć jawnie,
// nigdy po cichu zmienić kwotę.

const PORTFOLIO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const refs: ImportReferenceData = {
  portfolios: [{ id: PORTFOLIO, name: "IKE" }],
  instruments: [],
  existingTransactionIds: new Set(),
  existingManualValuationIds: new Set(),
  existingExternalImportIds: new Set(),
};

const excelSerial = (iso: string) => (Date.parse(`${iso}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86_400_000;
const swiftDate = (payload: unknown) => new Date(Date.UTC(2001, 0, 1) + (payload as { date: number }).date * 1000).toISOString().slice(0, 10);

describe("parseSpreadsheetNumber", () => {
  it.each([
    [1000.5, 1000.5],
    ["1000,50", 1000.5],
    ["1000.50", 1000.5],
    ["1 000,50", 1000.5],
    ["1 000,50", 1000.5],
    ["-45", -45],
    ["1e3", 1000],
    ["  7  ", 7],
  ])("%s → %d", (input, expected) => {
    expect(parseSpreadsheetNumber(input)).toBeCloseTo(expected, 6);
  });

  it.each([
    "12abc", "abc", "", "  ", "1,234.50", "0x10", "Infinity", "1e999", "--3", null, undefined,
    Number.NaN, Number.POSITIVE_INFINITY, 1e13, "1000000000001",
  ])("odrzuca %s", (input) => {
    expect(parseSpreadsheetNumber(input)).toBeNull();
  });
});

describe("XTB .xlsx: przypadki brzegowe", () => {
  const HEADER = ["ID", "Type", "Time", "Ticker", "Instrument", "Comment", "Amount"];
  const deposit = (id: number, time: unknown, amount: unknown) => [id, "IKE Deposit", time, "", "", "Deposit", amount];
  const parse = (rows: unknown[][], references = refs) => parseXtbXlsx(rows, PORTFOLIO, references);

  it("mniej niż dwa wiersze → pusty podgląd", () => {
    expect(parse([]).rows).toEqual([]);
    expect(parse([HEADER]).rows).toEqual([]);
  });

  it("brak wymaganych kolumn → jeden wiersz błędu, nic do importu", () => {
    const preview = parse([["Foo", "Bar"], ["a", "b"]]);
    expect(preview.validRows).toEqual([]);
    expect(preview.errorRows[0].errors[0]).toContain("Brak wymaganych kolumn");
  });

  it("nagłówek poniżej wierszy tytułowych raportu", () => {
    const preview = parse([
      ["Raport historii konta"],
      ["Konto: IKE"],
      [],
      HEADER,
      deposit(1, new Date("2026-05-17T10:00:00Z"), 1000),
    ]);
    expect(preview.validRows).toHaveLength(1);
    expect((preview.validRows[0].payload as unknown as { transactionType: string }).transactionType).toBe("cashDeposit");
  });

  it("data jako serial Excela = ta sama data co obiekt Date", () => {
    const fromSerial = parse([HEADER, deposit(1, excelSerial("2026-05-17") + 0.5, 1000)]);
    const fromDate = parse([HEADER, deposit(1, new Date("2026-05-17T12:00:00Z"), 1000)]);
    expect(swiftDate(fromSerial.validRows[0].payload)).toBe("2026-05-17");
    expect(swiftDate(fromSerial.validRows[0].payload)).toBe(swiftDate(fromDate.validRows[0].payload));
  });

  it("nieczytelna data → ostrzeżenie i pominięcie wiersza (nie zapis z bieżącą datą)", () => {
    const preview = parse([HEADER, deposit(1, "nie data", 1000), deposit(2, new Date("2026-05-17T10:00:00Z"), 500)]);
    expect(preview.validRows).toHaveLength(1);
    expect(preview.warnings.join(" ")).toContain("brak poprawnej daty");
  });

  it.each([
    ["kwota tekstem z przecinkiem", "1000,50", 1000.5],
    ["kwota tekstem ze spacją w tysiącach", "1 000,50", 1000.5],
  ])("%s", (_name, raw, expected) => {
    const preview = parse([HEADER, deposit(1, new Date("2026-05-17T10:00:00Z"), raw)]);
    expect((preview.validRows[0].payload as unknown as { grossAmount: number }).grossAmount).toBeCloseTo(expected, 6);
  });

  it.each(["12abc", "abc", ""])("nieczytelna kwota „%s” → ostrzeżenie, wiersz pominięty jawnie", (raw) => {
    const preview = parse([HEADER, deposit(1, new Date("2026-05-17T10:00:00Z"), raw)]);
    expect(preview.validRows).toEqual([]);
    expect(preview.warnings.join(" ")).toContain("brak poprawnej kwoty");
  });

  it("wiersz „Total” zgodny z sumą — bez ostrzeżenia; niezgodny — ostrzega", () => {
    const rows = (total: number) => [
      HEADER,
      deposit(1, new Date("2026-05-17T10:00:00Z"), 1000),
      deposit(2, new Date("2026-05-18T10:00:00Z"), 500),
      ["", "Total", "", "", "", "", total],
    ];
    expect(parse(rows(1500)).warnings.join(" ")).not.toContain("Total");
    expect(parse(rows(1200)).warnings.join(" ")).toContain("Total");
  });

  it("wiersze bez typu są pomijane, nieznany typ dostaje ostrzeżenie", () => {
    const preview = parse([
      HEADER,
      [9, "", new Date("2026-05-17T10:00:00Z"), "", "", "", 1],
      [10, "Zupełnie nowy typ", new Date("2026-05-17T10:00:00Z"), "", "", "", 5],
      deposit(11, new Date("2026-05-17T10:00:00Z"), 1000),
    ]);
    expect(preview.validRows).toHaveLength(1);
    expect(preview.warnings.join(" ")).toContain("nieznany typ");
  });

  it("ponowny import tego samego pliku: wiersze z znanym ID są pomijane", () => {
    const known = { ...refs, existingExternalImportIds: new Set(["xtb:1"]) };
    const preview = parse([HEADER, deposit(1, new Date("2026-05-17T10:00:00Z"), 1000)], known);
    expect(preview.validRows).toEqual([]);
  });

  it("losowe śmieci w komórkach nie zrywają importu", () => {
    const rng = new Rng(7);
    const junk: unknown[] = ["", "abc", -1, 0, 1e15, null, undefined, "Stock purchase", "IKE Deposit", "Total", new Date("invalid"), "🙂", "OPEN BUY x @ y"];
    for (let n = 0; n < 200; n += 1) {
      const row = Array.from({ length: 7 }, () => rng.pick(junk));
      expect(() => parse([HEADER, row])).not.toThrow();
    }
  });
});

describe("PKO Obligacje .xls: przypadki brzegowe", () => {
  const HEADER = ["DATA DYSPOZYCJI", "RODZAJ DYSPOZYCJI", "KOD OBLIGACJI", "NR ZAPISU", "SERIA", "LICZBA OBLIGACJI", "KWOTA OPERACJI", "STATUS"];
  const buy = (date: unknown, qty: unknown, amount: unknown, nr: unknown = 1001) =>
    [date, "zakup papierów", "EDO0432", nr, 432, qty, amount, "zrealizowana"];
  const parse = (rows: unknown[][]) => parsePkoBondsXls(rows, PORTFOLIO, refs);

  it("mniej niż dwa wiersze → pusty podgląd", () => {
    expect(parse([]).rows).toEqual([]);
  });

  it("brak nagłówka albo brak kolumny → jeden wiersz błędu", () => {
    expect(parse([["a", "b"], ["c", "d"]]).errorRows[0].errors[0]).toContain("Brak nagłówka");
    const withoutStatus = HEADER.slice(0, -1);
    expect(parse([withoutStatus, ["2024-04-15", "zakup papierów", "EDO0432", 1, 432, 5, 500]]).errorRows[0].errors[0])
      .toContain("Brak wymaganej kolumny");
  });

  it("nagłówek poniżej wierszy tytułowych", () => {
    const preview = parse([["Historia dyspozycji"], [], HEADER, buy("2024-04-15", 50, 5000)]);
    expect(preview.validRows.length).toBeGreaterThan(0);
  });

  it.each([
    ["ISO", "2024-04-15", "2024-04-15"],
    ["z kropkami", "15.04.2024", "2024-04-15"],
    ["serial Excela", excelSerial("2024-04-15"), "2024-04-15"],
  ])("data %s", (_name, raw, iso) => {
    const preview = parse([HEADER, buy(raw, 50, 5000)]);
    const purchase = preview.validRows.map((r) => r.payload as unknown as { transactionType: string; date: number }).find((p) => p.transactionType === "buy");
    expect(swiftDate(purchase)).toBe(iso);
  });

  it.each(["31.02.2024", "32.01.2024", "13.13.2024", "2024abc", "nie data", ""])(
    "data „%s” → zakup pominięty z ostrzeżeniem, nie zapis z inną datą",
    (raw) => {
      const preview = parse([HEADER, buy(raw, 50, 5000)]);
      expect(preview.validRows).toEqual([]);
      expect(preview.warnings.join(" ")).toContain("zakup bez daty/ilości/kwoty");
    },
  );

  it.each([
    ["ilość zero", 0, 5000],
    ["kwota zero", 50, 0],
    ["ilość tekstem", "abc", 5000],
    ["kwota tekstem z literami", 50, "12abc"],
    ["ilość ujemna", -5, 5000],
  ])("%s → zakup pominięty z ostrzeżeniem", (_name, qty, amount) => {
    const preview = parse([HEADER, buy("2024-04-15", qty, amount)]);
    expect(preview.validRows).toEqual([]);
    expect(preview.warnings.join(" ")).toContain("zakup bez daty/ilości/kwoty");
  });

  it("liczby z przecinkiem i spacją w tysiącach jako tekst", () => {
    const preview = parse([HEADER, buy("2024-04-15", "50", "5 000,50")]);
    const purchase = preview.validRows.map((r) => r.payload as unknown as { transactionType: string; grossAmount: number }).find((p) => p.transactionType === "buy");
    expect(purchase?.grossAmount).toBeCloseTo(5000.5, 6);
  });

  it("anulowana dyspozycja jest pomijana", () => {
    const cancelled = ["2024-04-15", "dyspozycja zakupu", "EDO0432", 1002, 432, 20, 2000, "anulowana"];
    expect(parse([HEADER, cancelled]).validRows).toEqual([]);
  });

  it("losowe śmieci w komórkach nie zrywają importu", () => {
    const rng = new Rng(11);
    const junk: unknown[] = ["", "abc", -1, 0, 1e15, null, undefined, "zakup papierów", "przedterminowy wykup", "odsetki", "31.02.2024", "2024-04-15", "anulowana", "🙂"];
    for (let n = 0; n < 200; n += 1) {
      const row = Array.from({ length: 8 }, () => rng.pick(junk));
      expect(() => parse([HEADER, row])).not.toThrow();
    }
  });
});
