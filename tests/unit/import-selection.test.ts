import { describe, expect, it } from "vitest";
import {
  importRowId,
  selectedImportPayloads,
} from "@/features/import/import-selection";
import type { TransactionImportRow } from "@/features/import/import-parser";

function row(
  id: string,
  instrumentID?: string,
): TransactionImportRow {
  return {
    rowNumber: 1,
    values: {},
    payload: {
      id,
      recordType: "transaction",
      ...(instrumentID ? { instrumentID } : {}),
    },
    errors: [],
    warnings: [],
  };
}

describe("import row selection", () => {
  it("returns only selected rows and their required new instruments", () => {
    const first = row("transaction-a", "instrument-a");
    const second = row("transaction-b", "instrument-b");
    const cash = row("transaction-c");

    const selected = selectedImportPayloads(
      {
        validRows: [first, second, cash],
        newInstrumentPayloads: [
          { id: "instrument-a", recordType: "asset" },
          { id: "instrument-b", recordType: "asset" },
        ],
      },
      new Set(["transaction-a", "transaction-c"]),
    );

    expect(selected.rows).toEqual([first, cash]);
    expect(selected.newInstrumentPayloads).toEqual([
      { id: "instrument-a", recordType: "asset" },
    ]);
  });

  it("uses the payload id as the stable checkbox identity", () => {
    expect(importRowId(row("transaction-a"))).toBe("transaction-a");
    expect(importRowId({ ...row("transaction-a"), payload: null })).toBeNull();
  });
});
