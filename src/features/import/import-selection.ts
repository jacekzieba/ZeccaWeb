import type { CsvImportPreview } from "@/features/import/import-parser";
import type { WriteRecordPayload } from "@/sync/records/record-writer";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";

type SelectableImportPreview = Pick<CsvImportPreview, "validRows"> & {
  newInstrumentPayloads?: WriteRecordPayload[];
  updatedInstrumentPayloads?: WriteRecordPayload[];
};

export function importRowId(row: CsvImportPreview["rows"][number]): string | null {
  return row.payload?.id ?? null;
}

/** Recheck identity at commit time, including records received after preview. */
export function selectedImportPayloads(
  preview: SelectableImportPreview,
  selectedRowIds: ReadonlySet<string>,
  records: readonly DecryptedRecord[] = [],
) {
  const active = records.filter(record => !record.deletedAt);
  const ids = new Set(active.map(record => record.id));
  const externalIDs = new Set(active.filter(record => record.envelope.type === "transaction")
    .map(record => (record.envelope.payload as WriteRecordPayload).externalImportID).filter(Boolean));
  let rows = preview.validRows.filter(row => {
    const payload = row.payload;
    if (!payload || !selectedRowIds.has(payload.id) || ids.has(payload.id)) return false;
    if (payload.externalImportID && externalIDs.has(payload.externalImportID)) return false;
    ids.add(payload.id);
    if (payload.externalImportID) externalIDs.add(payload.externalImportID);
    return true;
  });
  const referenced = new Set(rows.flatMap(row => typeof row.payload?.instrumentID === "string" ? [row.payload.instrumentID] : []));
  const rewrites = new Map<string, string>();
  const updates = new Map((preview.updatedInstrumentPayloads ?? []).map(payload => [payload.id, payload]));
  const newInstrumentPayloads = (preview.newInstrumentPayloads ?? []).filter(payload => {
    const existing = active.find(record => record.envelope.type === "asset" && (record.id === payload.id || (
      payload.kind === "treasuryBond" && (record.envelope.payload as WriteRecordPayload).kind === "treasuryBond"
      && String((record.envelope.payload as WriteRecordPayload).symbol).toUpperCase() === String(payload.symbol).toUpperCase()
    )));
    if (existing) {
      rewrites.set(payload.id, existing.id);
      return false;
    }
    return referenced.has(payload.id);
  });
  rows = rows.map(row => {
    const id = row.payload?.instrumentID;
    return typeof id === "string" && rewrites.has(id)
      ? { ...row, payload: { ...row.payload!, instrumentID: rewrites.get(id)! } }
      : row;
  });
  // Refreshes apply to existing, still-live instruments only; deleting an asset
  // while preview is open must never resurrect it through an update.
  const updatedInstrumentPayloads = [...updates.values()].filter(payload => active.some(record => record.envelope.type === "asset" && record.id === payload.id));
  return { rows, newInstrumentPayloads, updatedInstrumentPayloads };
}
