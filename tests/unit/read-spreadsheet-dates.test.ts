import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { readSpreadsheet } from "@/features/import/read-spreadsheet";

// Arkusz nie zna strefy czasowej: komórka daty to tylko liczba dni od 1899-12-30.
// read-excel-file i natywny XTBImporter czytają ją jako czas UTC (XTB eksportuje
// czasy w UTC: transakcje na Euronext zaczynają się w pliku o 07:xx latem i o 08:xx
// zimą). SheetJS domyślnie tworzył datę w strefie przeglądarki, więc import przez
// SheetJS (pliki .xls i eksporty XTB ZIP64) przesuwał czas o 1–2 godziny i gubił
// sekundę. Strefa testu jest ustawiona na polską, bo w UTC różnicy nie widać.

const excelSerial = (utcMs: number) => (utcMs - Date.UTC(1899, 11, 30)) / 86_400_000;

async function readDateCells(values: number[]) {
  const sheet = XLSX.utils.aoa_to_sheet([["Time"], ...values.map((value) => [value])]);
  for (let row = 2; row <= values.length + 1; row++) {
    sheet[`A${row}`].z = "yyyy-mm-dd hh:mm:ss";
  }
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Cash Operations");
  const bytes = XLSX.write(book, { type: "array", bookType: "xls" }) as ArrayBuffer;
  // jsdom's File has no arrayBuffer(); the reader needs only these two members.
  const file = { name: "export.xls", arrayBuffer: async () => bytes } as unknown as File;
  return readSpreadsheet(file);
}

describe("readSpreadsheet: daty z komórek arkusza", () => {
  const previousTimeZone = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "Europe/Warsaw";
  });
  afterAll(() => {
    process.env.TZ = previousTimeZone;
  });

  it("zwraca czas z arkusza jako UTC, zimą i latem, co do sekundy", async () => {
    const winter = Date.UTC(2026, 0, 10, 10, 0, 0);
    const summerLateEvening = Date.UTC(2026, 6, 10, 23, 30, 15);

    const rows = await readDateCells([excelSerial(winter), excelSerial(summerLateEvening)]);

    expect((rows[1][0] as Date).toISOString()).toBe(new Date(winter).toISOString());
    expect((rows[2][0] as Date).toISOString()).toBe(new Date(summerLateEvening).toISOString());
  });
});
