import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseEarningsImportCsv, parseEarningsImportTable } from "@/features/earnings/earnings-import";
import { readSpreadsheet } from "@/features/import/read-spreadsheet";

// Kontrola krzyżowa z natywnym EarningsImporter (audyt 2026-10-20, część 2).
// Te same wejścia idą przez `EarningsImporterTests` w repo Zecca.

const HEADER = "period,kind,type,amount,currency,fx_rate_to_pln,amount_pln,source";
const empty = { earnings: [], burdens: [] };
const previousTimeZone = process.env.TZ;
afterEach(() => {
  process.env.TZ = previousTimeZone;
});

function periods(preview: ReturnType<typeof parseEarningsImportTable>) {
  return preview.itemsToImport.map((item) => ({
    got: `${item.payload.year}-${String(item.payload.month).padStart(2, "0")}`,
    expected: String(item.payload.source).slice(0, 7),
    source: item.payload.source,
  }));
}

describe("import zarobków: parytet z aplikacją natywną", () => {
  it("kwoty tylko w zapisie dziesiętnym (L-20)", () => {
    const preview = parseEarningsImportCsv(
      [
        HEADER.replaceAll(",", ";"),
        "2026-06;earning;employment;inf;PLN;1;;a",
        "2026-06;earning;employment;0x10;PLN;1;;b",
        "2026-06;earning;employment;0b101;PLN;1;;c",
        "2026-06;earning;employment;0o7;PLN;1;;d",
        "2026-06;earning;employment;1 234,56;PLN;1;;e",
        "2026-06;earning;employment;1e3;PLN;1;;f",
      ].join("\n"),
      empty,
    );

    expect(preview.issues.map((issue) => issue.rowNumber)).toEqual([2, 3, 4, 5]);
    expect(preview.itemsToImport.map((item) => [item.payload.source, item.payload.enteredAmount])).toEqual([
      ["e", 1234.56],
      ["f", 1000],
    ]);
  });

  it("komórka daty daje miesiąc zapisany w arkuszu, w każdej strefie przeglądarki", () => {
    for (const zone of ["Europe/Warsaw", "America/New_York", "Asia/Tokyo"]) {
      process.env.TZ = zone;
      const preview = parseEarningsImportTable(
        [
          HEADER.split(","),
          [new Date(Date.UTC(2024, 5, 1)), "earning", "employment", 1, "PLN", 1, 1, "2024-06 północ"],
          [new Date(Date.UTC(2024, 4, 31, 23, 30)), "earning", "employment", 1, "PLN", 1, 1, "2024-05 23:30"],
        ],
        empty,
      );
      for (const row of periods(preview)) expect(row.got, `${zone}: ${row.source}`).toBe(row.expected);
    }
  });

  // Wspólna fixtura z repo natywnego: w `source` oczekiwany miesiąc.
  it.each([
    ["read-excel-file", "earnings_date_cells.xlsx"],
    ["SheetJS", "earnings_date_cells.xls"],
  ])("fixtura natywna przez %s: miesiąc z arkusza w każdej strefie", async (_reader, name) => {
    const bytes = readFileSync(resolve(__dirname, "../fixtures/native-golden/earnings_date_cells.xlsx"));
    for (const zone of ["Europe/Warsaw", "America/New_York", "Asia/Tokyo"]) {
      process.env.TZ = zone;
      const file = new File([bytes], name);
      Object.assign(file, { arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
      const preview = parseEarningsImportTable(await readSpreadsheet(file), empty);

      expect(preview.errorCount, zone).toBe(0);
      expect(preview.itemsToImport).toHaveLength(8);
      for (const row of periods(preview)) expect(row.got, `${zone}: ${row.source}`).toBe(row.expected);
    }
  });

  it("sam rok nie jest numerem seryjnym daty z 1905 roku", () => {
    const preview = parseEarningsImportCsv([HEADER, "2024,earning,employment,100,PLN,1,100,Etat"].join("\n"), empty);

    expect(preview.insertCount).toBe(0);
    expect(preview.issues.map((issue) => issue.rowNumber)).toEqual([2]);
  });

  it("te same komunikaty i kolejność co w aplikacji: błędy wierszy, potem duplikaty wg wierszy", () => {
    const preview = parseEarningsImportCsv(
      [
        HEADER,
        "2026-06,earning,business,1000,PLN,1,1000,Klient",
        "2026-06,burden,zus,500,PLN,1,500,ZUS",
        "2026-06,burden,zus,600,PLN,1,600,ZUS",
        "2026-06,earning,business,2000,PLN,1,2000,Klient",
        "2026-06,earning,business,100,EURO,4,400,Klient UE",
      ].join("\n"),
      empty,
    );

    expect(preview.issues.map((issue) => issue.rowNumber)).toEqual([6, 4, 5]);
    expect(preview.issues.map((issue) => issue.message)).toEqual([
      "currency musi być trzyliterowym kodem waluty, np. PLN lub EUR",
      "powtórzone obciążenie (pierwszy wiersz: 3); zmień source, jeśli to osobny wpis",
      "powtórzony zarobek (pierwszy wiersz: 2); zmień source, jeśli to osobny wpis",
    ]);
  });

  it("rozpoznaje aliasy zapisane po polsku", () => {
    const preview = parseEarningsImportCsv([HEADER, "2026-06,Zarobek,Działalność,100,PLN,1,100,Firma"].join("\n"), empty);

    expect(preview.errorCount).toBe(0);
    expect(preview.itemsToImport[0]?.payload.employmentType).toBe("business");
  });
});
