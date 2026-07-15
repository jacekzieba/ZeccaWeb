// Reads a spreadsheet File into rows (`unknown[][]`) for the import parsers.
//
// `read-excel-file` (fast, small) is the primary reader, but it only handles
// OOXML `.xlsx` and rejects some valid-enough files (e.g. empty
// `<c t="inlineStr"/>` cells emitted by openpyxl). Legacy `.xls` is BIFF8/OLE2,
// which it cannot read at all — and real PKO Obligacje exports are exactly that.
//
// So: legacy `.xls` goes straight to SheetJS (reads BIFF8 + OOXML); `.xlsx`
// stays on read-excel-file with a SheetJS fallback if it throws or silently
// truncates a named sheet. Both readers yield the row shape the parsers expect.

type ReadOptions = { sheet?: string };

const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const ZIP_DATA_DESCRIPTOR = 0x08074b50;

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
    const rows = (await readSheet(file, options.sheet)) as unknown[][];
    // Some ZIP64 XTB exports are silently truncated by the browser reader to
    // the first cell instead of throwing. A named import sheet always needs
    // at least a header and one data row, so let the robust fallback repair it.
    if (!options.sheet || rows.length >= 2) return rows;
  } catch {
    // The primary reader could not load or parse the file; use SheetJS below.
  }

  return readWithSheetJs(file, options);
}

async function readWithSheetJs(
  file: File,
  options: ReadOptions,
): Promise<unknown[][]> {
  const source = new Uint8Array(await file.arrayBuffer());
  const XLSX = await import("xlsx");
  const needsNormalization = usesZeroSizedDataDescriptors(source);
  const spreadsheetBytes = needsNormalization
    ? await normalizeDataDescriptorZip(source)
    : source;
  const workbook = XLSX.read(spreadsheetBytes, {
    cellDates: true,
    type: "array",
  });
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

function usesZeroSizedDataDescriptors(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 30 || readUint32(bytes, 0) !== ZIP_LOCAL_FILE_HEADER) {
    return false;
  }

  const flags = readUint16(bytes, 6);
  return Boolean(flags & 8) && readUint32(bytes, 18) === 0 && readUint32(bytes, 22) === 0;
}

/**
 * Some XTB exports are ZIP64 XLSX archives whose local and central headers
 * report zero sizes and put the real sizes in a descriptor after each file.
 * Browser unzip implementations treat those entries as empty. Repack the
 * entries in memory into a standard ZIP before handing them to SheetJS.
 */
async function normalizeDataDescriptorZip(bytes: Uint8Array): Promise<Uint8Array> {
  const { inflateSync, zipSync } = await import("fflate");
  const files: Record<string, Uint8Array> = {};
  const decoder = new TextDecoder();
  let offset = 0;

  while (
    offset + 30 <= bytes.byteLength &&
    readUint32(bytes, offset) === ZIP_LOCAL_FILE_HEADER
  ) {
    const versionNeeded = readUint16(bytes, offset + 4);
    const flags = readUint16(bytes, offset + 6);
    const compressionMethod = readUint16(bytes, offset + 8);
    const localCompressedSize = readUint32(bytes, offset + 18);
    const nameLength = readUint16(bytes, offset + 26);
    const extraLength = readUint16(bytes, offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength));

    const descriptorSize = versionNeeded >= 45 ? 24 : 16;
    const descriptorOffset = flags & 8
      ? findDataDescriptor(bytes, dataStart, descriptorSize)
      : null;
    const dataEnd = descriptorOffset ?? dataStart + localCompressedSize;
    const compressed = bytes.subarray(dataStart, dataEnd);

    if (compressionMethod === 8) {
      files[name] = inflateSync(compressed);
    } else if (compressionMethod === 0) {
      files[name] = compressed.slice();
    } else {
      throw new Error(`Nieobsługiwana metoda kompresji XLSX: ${compressionMethod}.`);
    }

    offset = descriptorOffset == null
      ? dataEnd
      : descriptorOffset + descriptorSize;
  }

  if (Object.keys(files).length === 0) {
    throw new Error("Nie znaleziono danych w archiwum XLSX.");
  }

  return zipSync(files, { level: 6 });
}

function findDataDescriptor(
  bytes: Uint8Array,
  dataStart: number,
  descriptorSize: number,
): number {
  for (let offset = dataStart; offset + descriptorSize <= bytes.byteLength; offset += 1) {
    if (readUint32(bytes, offset) !== ZIP_DATA_DESCRIPTOR) continue;

    const compressedSize = descriptorSize === 24
      ? readUint64(bytes, offset + 8)
      : readUint32(bytes, offset + 8);
    if (compressedSize !== offset - dataStart) continue;

    const nextOffset = offset + descriptorSize;
    if (nextOffset === bytes.byteLength) return offset;
    const nextSignature = readUint32(bytes, nextOffset);
    if (
      nextSignature === ZIP_LOCAL_FILE_HEADER ||
      nextSignature === ZIP_CENTRAL_DIRECTORY_HEADER
    ) {
      return offset;
    }
  }

  throw new Error("Nie znaleziono deskryptora danych w archiwum XLSX.");
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function readUint64(bytes: Uint8Array, offset: number): number {
  const low = readUint32(bytes, offset);
  const high = readUint32(bytes, offset + 4);
  const value = low + high * 0x1_0000_0000;
  if (!Number.isSafeInteger(value)) {
    throw new Error("Archiwum XLSX jest zbyt duże do przetworzenia w przeglądarce.");
  }
  return value;
}
