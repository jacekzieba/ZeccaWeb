import type { CsvImportPreview } from "@/features/import/import-parser";
import type { WriteRecordPayload } from "@/sync/records/record-writer";

type SelectableImportPreview = Pick<CsvImportPreview, "validRows"> & {
  newInstrumentPayloads?: WriteRecordPayload[];
};

export function importRowId(
  row: CsvImportPreview["rows"][number],
): string | null {
  return row.payload?.id ?? null;
}

export function selectedImportPayloads(
  preview: SelectableImportPreview,
  selectedRowIds: ReadonlySet<string>,
) {
  const rows = preview.validRows.filter((row) => {
    const id = importRowId(row);
    return id !== null && selectedRowIds.has(id);
  });
  const referencedInstrumentIds = new Set(
    rows.flatMap((row) => {
      const instrumentID = row.payload?.instrumentID;
      return typeof instrumentID === "string" ? [instrumentID] : [];
    }),
  );
  const newInstrumentPayloads = (preview.newInstrumentPayloads ?? []).filter(
    (payload) => referencedInstrumentIds.has(payload.id),
  );

  return { rows, newInstrumentPayloads };
}
