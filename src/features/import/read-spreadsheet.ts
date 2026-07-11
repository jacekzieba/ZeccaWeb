// Reads a spreadsheet File into rows (`unknown[][]`) for the import parsers.
//
// `read-excel-file` (fast, small) is the primary reader, but it only handles
// OOXML `.xlsx` and rejects some valid-enough files (e.g. empty
// `<c t="inlineStr"/>` cells emitted by openpyxl). Legacy `.xls` is BIFF8/OLE2,
// which it cannot read at all — and real PKO Obligacje exports are exactly that.
//
// So: legacy `.xls` goes straight to SheetJS (reads BIFF8 + OOXML); `.xlsx`
// stays on read-excel-file with a SheetJS fallback if it throws. Both readers
// yield the same row shape the parsers expect (dates as Date, numbers as
// number, blank cells as null/undefined).

type ReadOptions = { sheet?: string };

export async function readSpreadsheet(
  file: File,
  options: ReadOptions = {},
): Promise<unknown[][]> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "xls") {
    return readWithSheetJs(file, options);
  }

  try {
    const { readSheet } = await import("read-excel-file/browser");
    try {
      return (await readSheet(file, options.sheet)) as unknown[][];
    } catch (err) {
      // Named sheet missing → retry the default sheet; otherwise propagate to
      // the SheetJS fallback below.
      if (options.sheet) return (await readSheet(file)) as unknown[][];
      throw err;
    }
  } catch {
    return readWithSheetJs(file, options);
  }
}

async function readWithSheetJs(
  file: File,
  options: ReadOptions,
): Promise<unknown[][]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const sheetName =
    options.sheet && workbook.SheetNames.includes(options.sheet)
      ? options.sheet
      : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    raw: true,
    blankrows: false,
  });
}
