import { beforeEach, describe, expect, it, vi } from "vitest";
import { readSpreadsheet } from "@/features/import/read-spreadsheet";

const readSheet = vi.fn();
const read = vi.fn();
const sheetToJson = vi.fn();

vi.mock("read-excel-file/browser", () => ({ readSheet }));
vi.mock("xlsx", () => ({
  read,
  utils: { sheet_to_json: sheetToJson },
}));

describe("readSpreadsheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes browser ArrayBuffers to SheetJS with the explicit array type", async () => {
    const buffer = new ArrayBuffer(8);
    const file = {
      name: "xtb.xlsx",
      arrayBuffer: vi.fn().mockResolvedValue(buffer),
    } as unknown as File;
    const worksheet = {};
    const rows = [
      ["Type", "Time", "Amount"],
      ["IKE deposit", "2026-01-01", 1000],
    ];

    readSheet.mockRejectedValue(new Error("unsupported XLSX"));
    read.mockReturnValue({
      SheetNames: ["Closed Positions", "Cash Operations"],
      Sheets: { "Closed Positions": {}, "Cash Operations": worksheet },
    });
    sheetToJson.mockReturnValue(rows);

    await expect(
      readSpreadsheet(file, { sheet: "Cash Operations" }),
    ).resolves.toEqual(rows);
    expect(read).toHaveBeenCalledWith(new Uint8Array(buffer), {
      cellDates: true,
      type: "array",
    });
    expect(sheetToJson).toHaveBeenCalledWith(worksheet, {
      header: 1,
      raw: true,
      blankrows: false,
    });
  });

  it("normalizes ZIP64 data-descriptor XLSX archives before SheetJS reads them", async () => {
    const source = makeStoredZip64DescriptorEntry(
      "xl/worksheets/sheet1.xml",
      new TextEncoder().encode("<worksheet />"),
    );
    const file = {
      name: "xtb.xlsx",
      arrayBuffer: vi.fn().mockResolvedValue(source.buffer),
    } as unknown as File;
    const worksheet = {};
    const rows = [
      ["Type", "Time", "Amount"],
      ["IKE deposit", "2026-01-01", 1000],
    ];

    readSheet.mockResolvedValue([["Account number"]]);
    read.mockReturnValue({
      SheetNames: ["Cash Operations"],
      Sheets: { "Cash Operations": worksheet },
    });
    sheetToJson.mockReturnValue(rows);

    await expect(
      readSpreadsheet(file, { sheet: "Cash Operations" }),
    ).resolves.toEqual(rows);

    const normalized = read.mock.calls[0][0] as Uint8Array;
    expect(normalized).toBeInstanceOf(Uint8Array);
    expect(normalized).not.toEqual(source);
    expect(read).toHaveBeenCalledWith(normalized, {
      cellDates: true,
      type: "array",
    });
  });
});

function makeStoredZip64DescriptorEntry(
  name: string,
  contents: Uint8Array,
): Uint8Array {
  const encodedName = new TextEncoder().encode(name);
  const descriptorSize = 24;
  const bytes = new Uint8Array(30 + encodedName.length + contents.length + descriptorSize);
  const view = new DataView(bytes.buffer);

  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 45, true);
  view.setUint16(6, 8, true);
  view.setUint16(8, 0, true);
  view.setUint16(26, encodedName.length, true);
  bytes.set(encodedName, 30);

  const dataStart = 30 + encodedName.length;
  bytes.set(contents, dataStart);
  const descriptorOffset = dataStart + contents.length;
  view.setUint32(descriptorOffset, 0x08074b50, true);
  view.setUint32(descriptorOffset + 8, contents.length, true);
  view.setUint32(descriptorOffset + 16, contents.length, true);

  return bytes;
}
