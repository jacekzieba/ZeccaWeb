import type { RecordType } from "@/domain/models/investor-data";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";

const recordTypes: RecordType[] = [
  "account",
  "asset",
  "transaction",
  "manualValuation",
  "income",
  "settings",
  "marketQuote",
];

export type SyncRecordSummary = {
  totalRecords: number;
  decryptedAt: string;
  latestUpdatedAt: string | null;
  byType: Record<RecordType, number>;
};

export function createEmptySyncRecordSummary(): SyncRecordSummary {
  return {
    totalRecords: 0,
    decryptedAt: new Date().toISOString(),
    latestUpdatedAt: null,
    byType: Object.fromEntries(recordTypes.map((type) => [type, 0])) as Record<
      RecordType,
      number
    >,
  };
}

export function summarizeDecryptedRecords(
  records: DecryptedRecord[],
): SyncRecordSummary {
  const summary = createEmptySyncRecordSummary();

  for (const record of records) {
    summary.totalRecords += 1;
    summary.byType[record.envelope.type] += 1;

    if (
      !summary.latestUpdatedAt ||
      record.updatedAt > summary.latestUpdatedAt
    ) {
      summary.latestUpdatedAt = record.updatedAt;
    }
  }

  return summary;
}
