import { describe, expect, it } from "vitest";
import {
  buildImportReferenceData,
  parseImportTable,
  parseTransactionCsvImport,
  type ImportReferenceData,
} from "@/features/import/import-parser";
import { Rng } from "./helpers/random-book";
import { makeRecord } from "./helpers/records";

// Import CSV przyjmuje pliki od ludzi: przecinki i kropki dziesiętne, spacje w tysiącach,
// BOM z Excela, różne separatory, daty w kilku zapisach, śmieci w komórkach. Testy
// tabelaryczne sprawdzają, że poprawny plik daje dokładnie tę transakcję, a niepoprawny
// — błąd w wierszu, nigdy cichą zmianę wartości (31.02 → 3.03, „0x10” → 16, złe opłaty → 0).

const PORTFOLIO_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AAPL_ID = "11111111-1111-4111-8111-111111111111";
const CDR_ID = "22222222-2222-4222-8222-222222222222";
const EXISTING_ID = "33333333-3333-4333-8333-333333333333";

const refs: ImportReferenceData = {
  portfolios: [
    { id: PORTFOLIO_ID, name: "Portfel główny" },
    { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Portfel, testowy" },
  ],
  instruments: [
    { id: AAPL_ID, symbol: "AAPL", name: "Apple Inc", currency: "USD" },
    { id: CDR_ID, symbol: "CDR", name: "CD Projekt", currency: "PLN" },
  ],
  existingTransactionIds: new Set([EXISTING_ID]),
  existingManualValuationIds: new Set(),
  existingExternalImportIds: new Set(),
};

const HEADER = "date,portfolio,instrument,transactionType,quantity,price,grossAmount,currency,fees,taxes";

type Cells = Partial<Record<"date" | "portfolio" | "instrument" | "type" | "qty" | "price" | "gross" | "currency" | "fees" | "taxes", string>>;

/** Wiersz z domyślnie poprawną wpłatą gotówki; nadpisujemy tylko to, co testujemy. */
function line(cells: Cells = {}) {
  const c = {
    date: "2026-05-17", portfolio: "Portfel główny", instrument: "", type: "cashDeposit",
    qty: "", price: "", gross: "1000", currency: "PLN", fees: "", taxes: "", ...cells,
  };
  // Komórki z separatorem (kwota „1234,50”, portfel „Portfel, testowy”) idą w cudzysłowie.
  const quote = (cell: string) => (/[",]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell);
  return [c.date, c.portfolio, c.instrument, c.type, c.qty, c.price, c.gross, c.currency, c.fees, c.taxes]
    .map(quote)
    .join(",");
}

const parse = (...lines: string[]) => parseTransactionCsvImport([HEADER, ...lines].join("\n"), refs);
const only = (...lines: string[]) => parse(...lines).rows[0];
const swiftDateToIso = (seconds: number) =>
  new Date(Date.UTC(2001, 0, 1) + seconds * 1000).toISOString().slice(0, 10);
const payload = (row: ReturnType<typeof only>) => row.payload as unknown as Record<string, number | string>;

describe("import CSV: daty", () => {
  it.each([
    ["2026-05-17", "2026-05-17"],
    ["17.05.2026", "2026-05-17"],
    ["17-05-2026", "2026-05-17"],
    ["17/05/2026", "2026-05-17"],
    ["1.5.2026", "2026-05-01"],
    ["29.02.2024", "2024-02-29"], // rok przestępny
    ["2026-05-17 10:30:00", "2026-05-17"], // eksport Excela z godziną
    ["2026-05-17T10:30:00Z", "2026-05-17"],
  ])("poprawna data %s → %s", (raw, iso) => {
    const row = only(line({ date: raw }));
    expect(row.errors).toEqual([]);
    expect(swiftDateToIso(payload(row).date as number)).toBe(iso);
  });

  it.each([
    "2026-02-31", "31.02.2026", "29.02.2025", "13.13.2026", "2026-13-01", "2026-00-10",
    "0.0.2026", "32.01.2026", "abc", "2026", "17.05.26",
  ])("nieistniejąca lub niepełna data %s jest błędem, nie zmianą daty", (raw) => {
    const row = only(line({ date: raw }));
    expect(row.errors).toContain("Nieprawidłowa data.");
    expect(row.payload).toBeNull();
  });

  it("pusta data jest błędem", () => {
    expect(only(line({ date: "" })).errors).toContain("Nieprawidłowa data.");
  });
});

describe("import CSV: kwoty i liczby", () => {
  it.each([
    ["1234,50", 1234.5],
    ["1234.50", 1234.5],
    ["1 234,50", 1234.5],
    ["1 234,50", 1234.5], // twarda spacja z Excela
    ["1234", 1234],
    ["0,01", 0.01],
    ["1e3", 1000], // notacja naukowa z eksportu Excela
    ["+250", 250],
  ])("kwota %s → %d", (raw, expected) => {
    const row = only(line({ gross: raw }));
    expect(row.errors).toEqual([]);
    expect(payload(row).grossAmount).toBeCloseTo(expected, 6);
  });

  it.each([
    "0x10", "0b11", "Infinity", "NaN", "abc", "12abc", "1,234.50", "1.234,50", "1__000", "--5",
    "1000000000001", // ponad limit 1e12
  ])("kwota %s jest odrzucona zamiast zamieniona na inną liczbę", (raw) => {
    const row = only(line({ gross: raw }));
    expect(row.errors).toContain("Brak poprawnej kwoty brutto.");
  });

  it("pusta kwota jest błędem", () => {
    expect(only(line({ gross: "" })).errors).toContain("Brak poprawnej kwoty brutto.");
  });
});

describe("import CSV: reguły znaków (jak natywny TransactionValidator)", () => {
  const buy = (cells: Cells) =>
    line({ type: "buy", instrument: "AAPL", qty: "2", price: "190", gross: "380", currency: "USD", ...cells });

  it.each([
    ["ujemna wpłata", line({ gross: "-100" }), "Kwota brutto musi być dodatnia."],
    ["wpłata zero", line({ gross: "0" }), "Kwota brutto musi być dodatnia."],
    ["ujemna wypłata", line({ type: "cashWithdrawal", gross: "-5" }), "Kwota brutto musi być dodatnia."],
    ["korekta zero", line({ type: "correction", gross: "0" }), "Korekta musi mieć niezerową kwotę."],
    ["ilość zero", buy({ qty: "0" }), "Ilość musi być dodatnia."],
    ["ilość ujemna", buy({ qty: "-3" }), "Ilość musi być dodatnia."],
    ["cena zero", buy({ price: "0" }), "Cena musi być dodatnia."],
    ["cena ujemna", buy({ price: "-190" }), "Cena musi być dodatnia."],
    ["ujemna prowizja", line({ fees: "-1" }), "Prowizja nie może być ujemna."],
    ["ujemny podatek", line({ taxes: "-1" }), "Podatek nie może być ujemny."],
    ["prowizja z literami", line({ fees: "abc" }), "Nieprawidłowe opłaty."],
    ["podatek z literami", line({ taxes: "12zł" }), "Nieprawidłowy podatek."],
  ])("%s → błąd wiersza", (_name, csvLine, message) => {
    const row = only(csvLine);
    expect(row.errors).toContain(message);
    expect(row.payload).toBeNull();
  });

  it("korekta ujemna jest poprawna (to jedyny typ z kwotą ze znakiem)", () => {
    const row = only(line({ type: "correction", gross: "-20" }));
    expect(row.errors).toEqual([]);
    expect(payload(row).grossAmount).toBe(-20);
  });

  it("prowizja i podatek zero lub puste są poprawne", () => {
    const row = only(line({ fees: "0", taxes: "" }));
    expect(row.errors).toEqual([]);
    expect(payload(row).fees).toBe(0);
    expect(payload(row).taxes).toBe(0);
  });
});

describe("import CSV: struktura pliku", () => {
  const rowsOf = (text: string) => parseTransactionCsvImport(text, refs);
  const goodRow = line();

  it("BOM z Excela na początku nie psuje nagłówka", () => {
    const preview = rowsOf(`﻿${HEADER}\n${goodRow}`);
    expect(preview.validRows).toHaveLength(1);
  });

  it.each([
    ["CRLF", "\r\n"],
    ["CR (stary Mac)", "\r"],
    ["LF", "\n"],
  ])("końce linii %s", (_name, eol) => {
    const preview = rowsOf([HEADER, goodRow, goodRow].join(eol) + eol + eol);
    expect(preview.validRows).toHaveLength(2);
  });

  it("separator średnik z przecinkiem dziesiętnym w kwotach", () => {
    const text = [
      "date;portfolio;instrument;transactionType;quantity;price;grossAmount;currency;fees;taxes",
      "2026-05-17;Portfel główny;;cashDeposit;;;1 234,50;PLN;;",
    ].join("\n");
    const preview = rowsOf(text);
    expect(preview.errorRows).toEqual([]);
    expect(payload(preview.rows[0]).grossAmount).toBeCloseTo(1234.5, 6);
  });

  it("separator tabulator", () => {
    const text = [HEADER, goodRow].map((l) => l.replaceAll(",", "\t")).join("\n");
    expect(rowsOf(text).validRows).toHaveLength(1);
  });

  it("pole w cudzysłowie z separatorem i z podwójnym cudzysłowem", () => {
    const text = [HEADER, `2026-05-17,"Portfel, testowy",,cashDeposit,,,1000,PLN,,`].join("\n");
    const preview = rowsOf(text);
    expect(preview.errorRows).toEqual([]);
    expect(preview.rows[0].values.portfolio).toBe("Portfel, testowy");
    const escaped = rowsOf([HEADER, `2026-05-17,"Portfel ""główny""",,cashDeposit,,,1000,PLN,,`].join("\n"));
    expect(escaped.rows[0].values.portfolio).toBe('Portfel "główny"');
  });

  it("aliasy nagłówków (polskie znaki, wielkość liter, angielskie nazwy)", () => {
    const text = [
      "Data,Account,Instrument,transactionType,Quantity,Price,Brutto,CurrencyCode,Fee,Tax",
      "2026-05-17,Portfel główny,,cashDeposit,,,1000,PLN,0,0",
    ].join("\n");
    expect(rowsOf(text).validRows).toHaveLength(1);
  });

  it.each([
    ["pusty plik", ""],
    ["same białe znaki", "  \n \n"],
    ["sam nagłówek", HEADER],
  ])("%s → brak wierszy, bez wyjątku", (_name, text) => {
    const preview = rowsOf(text);
    expect(preview.rows).toEqual([]);
  });

  it("puste wiersze w środku i na końcu są pomijane", () => {
    const preview = rowsOf([HEADER, goodRow, ",,,,,,,,,", "", goodRow, ""].join("\n"));
    expect(preview.rows).toHaveLength(2);
  });

  it("brak kolumny kwoty: każdy wiersz dostaje błąd, import nie przechodzi", () => {
    const text = ["date,portfolio,transactionType,currency", "2026-05-17,Portfel główny,cashDeposit,PLN"].join("\n");
    const preview = rowsOf(text);
    expect(preview.validRows).toEqual([]);
    expect(preview.errorRows[0].errors).toContain("Brak poprawnej kwoty brutto.");
  });
});

describe("import CSV: identyfikatory, typy, odwołania", () => {
  it("własne ID: poprawne UUID przechodzi, złe / istniejące / zdublowane są błędem", () => {
    const fresh = "44444444-4444-4444-8444-444444444444";
    const preview = parseTransactionCsvImport(
      [
        "id," + HEADER,
        `${fresh},${line()}`,
        `${fresh},${line()}`, // duplikat w pliku
        `${EXISTING_ID},${line()}`, // już istnieje w danych
        `nie-uuid,${line()}`,
      ].join("\n"),
      refs,
    );
    expect(preview.rows[0].errors).toEqual([]);
    expect(preview.rows[1].errors).toContain("Duplikat ID w importowanym pliku.");
    expect(preview.rows[2].errors).toContain("Transakcja o tym ID już istnieje.");
    expect(preview.rows[3].errors.join(" ")).toContain("UUID");
  });

  it("typ transakcji jest rozróżniany co do wielkości liter (ścisły zapis camelCase)", () => {
    expect(only(line({ type: "cashDeposit" })).errors).toEqual([]);
    expect(only(line({ type: "CashDeposit" })).errors).toContain("Nieznany typ transakcji.");
    expect(only(line({ type: "wpłata" })).errors).toContain("Nieznany typ transakcji.");
  });

  it("instrument po symbolu, nazwie i ID — bez względu na wielkość liter", () => {
    for (const instrument of ["AAPL", "aapl", "Apple Inc", AAPL_ID]) {
      const row = only(line({ type: "buy", instrument, qty: "2", price: "190", gross: "380", currency: "USD" }));
      expect(row.errors, instrument).toEqual([]);
      expect(payload(row).instrumentID).toBe(AAPL_ID);
    }
  });

  it("nieznany instrument, brak instrumentu przy kupnie, brak portfela, brak waluty", () => {
    expect(only(line({ type: "buy", instrument: "NIEMA", qty: "1", price: "1", gross: "1" })).errors)
      .toContain("Nie znaleziono instrumentu.");
    expect(only(line({ type: "buy", qty: "1", price: "1", gross: "1" })).errors)
      .toContain("Ten typ transakcji wymaga instrumentu.");
    expect(only(line({ portfolio: "Nie ma takiego" })).errors).toContain("Nie znaleziono portfela.");
    expect(only(line({ currency: "" })).errors).toContain("Brak waluty.");
  });

  it("waluta zapisana małymi literami trafia do rekordu wielkimi", () => {
    expect(payload(only(line({ currency: "pln" }))).currency).toBe("PLN");
  });

  it("kupno bez ceny jest ostrzeżeniem, nie błędem (zapis bez wpływu na wyniki)", () => {
    const row = only(line({ type: "buy", instrument: "CDR", qty: "5", gross: "500" }));
    expect(row.errors).toEqual([]);
    expect(row.warnings.join(" ")).toContain("Brak ceny");
  });
});

describe("import CSV: wycena ręczna", () => {
  const table = (rows: string[][]) => parseImportTable(rows, refs);

  it("nagłówek z `value` kieruje do importu wycen, nie transakcji", () => {
    const preview = table([
      ["date", "instrument", "quantity", "totalValue", "currency", "note"],
      ["2026-06-05", "CDR", "10", "1500,00", "PLN", "PKO"],
    ]);
    expect(preview.kind).toBe("manualValuation");
    const row = preview.rows[0] as { payload: Record<string, number | string> | null; errors: string[] };
    expect(row.errors).toEqual([]);
    expect(row.payload!.value).toBeCloseTo(150, 6); // totalValue / quantity
  });

  it.each([
    ["brak value i totalValue", ["2026-06-05", "CDR", "10", "", "PLN"], "Podaj value albo totalValue z dodatnią quantity."],
    ["totalValue bez quantity", ["2026-06-05", "CDR", "", "1500", "PLN"], "totalValue wymaga quantity."],
    ["nieistniejąca data", ["2026-02-31", "CDR", "10", "1500", "PLN"], "Nieprawidłowa data."],
    ["nieznany instrument", ["2026-06-05", "NIEMA", "10", "1500", "PLN"], "Nie znaleziono instrumentu."],
  ])("%s → błąd", (_name, cells, message) => {
    const preview = table([["date", "instrument", "quantity", "totalValue", "currency"], cells]);
    expect((preview.rows[0] as { errors: string[] }).errors).toContain(message);
  });
});

describe("import CSV: odporność", () => {
  it("3000 wierszy wczytuje się bez utraty i w rozsądnym czasie", () => {
    const lines = Array.from({ length: 3000 }, (_, i) => line({ gross: String(100 + i) }));
    const started = Date.now();
    const preview = parse(...lines);
    expect(preview.validRows).toHaveLength(3000);
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it("losowe śmieci w komórkach nie zrywają importu: każdy wiersz ma ładunek XOR błędy", () => {
    const rng = new Rng(2026);
    const junk = ["", " ", "abc", "-1", "0", "1e999", "NaN", "0x1F", " ", "'\"", "2026-02-31", "🙂", "1,2,3", "  12,5  ", "9".repeat(30)];
    const types = ["buy", "sell", "cashDeposit", "dividend", "correction", "???", ""];
    for (let n = 0; n < 300; n += 1) {
      const cells = Array.from({ length: 10 }, () => rng.pick(junk));
      cells[3] = rng.pick(types);
      const text = [HEADER, cells.map((c) => c.replaceAll(",", ";").replaceAll('"', "")).join(",")].join("\n");
      const preview = parseTransactionCsvImport(text, refs);
      for (const row of preview.rows) {
        expect(row.payload === null, `n=${n}`).toBe(row.errors.length > 0);
      }
    }
  });
});

describe("import CSV: kontrola sprzedaży ponad stan (zgodność z natywnym ADR-0002)", () => {
  // Natywnie sprzedaż ponad dostępną pozycję jest odrzucana jeszcze przed zapisem
  // (FinancialRecordAdmission). Web nie ma żadnego odpowiednika: parser importu nie zna
  // pozycji, a zapis nie sprawdza księgi. `it.fails` dokumentuje lukę — gdy web dostanie
  // kontrolę, ten test zacznie przechodzić i trzeba zdjąć `.fails`.
  it.fails("odrzuca sprzedaż, gdy w pliku i w danych nie ma wcześniejszego kupna", () => {
    const row = only(line({ type: "sell", instrument: "AAPL", qty: "10", price: "190", gross: "1900", currency: "USD" }));
    expect(row.errors.length).toBeGreaterThan(0);
  });
});

describe("buildImportReferenceData", () => {
  it("zbiera portfele, instrumenty i identyfikatory istniejących rekordów; pomija usunięte", () => {
    const deleted = { ...makeRecord("account", "dddddddd-dddd-4ddd-8ddd-dddddddddddd", { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Usunięty" }), deletedAt: "2026-01-01T00:00:00.000Z" };
    const data = buildImportReferenceData([
      makeRecord("account", PORTFOLIO_ID, { id: PORTFOLIO_ID, name: "Zeta" }),
      makeRecord("account", "cccccccc-cccc-4ccc-8ccc-cccccccccccc", { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "Alfa" }),
      makeRecord("asset", AAPL_ID, { id: AAPL_ID, symbol: "AAPL", name: "Apple", currency: "USD" }),
      makeRecord("asset", CDR_ID, { id: CDR_ID, symbol: "CDR", name: "CD Projekt" }), // bez waluty → PLN
      makeRecord("asset", "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", symbol: "", name: "Bez symbolu" }),
      makeRecord("transaction", EXISTING_ID, { externalImportID: "xtb:1" }),
      makeRecord("transaction", "ffffffff-ffff-4fff-8fff-ffffffffffff", { externalImportID: null }),
      makeRecord("manualValuation", "99999999-9999-4999-8999-999999999999", {}),
      deleted,
    ]);
    expect(data.portfolios.map((p) => p.name)).toEqual(["Alfa", "Zeta"]); // posortowane
    expect(data.instruments.map((i) => [i.symbol, i.currency])).toEqual([["AAPL", "USD"], ["CDR", "PLN"]]);
    expect(data.existingTransactionIds.has(EXISTING_ID)).toBe(true);
    expect(data.existingExternalImportIds?.has("xtb:1")).toBe(true);
    expect(data.existingManualValuationIds.size).toBe(1);
  });

  it("brak rekordów (null) daje puste odwołania", () => {
    const data = buildImportReferenceData(null);
    expect(data.portfolios).toEqual([]);
    expect(data.instruments).toEqual([]);
  });
});
