import { describe, expect, it } from "vitest";
import { findAccountRecord } from "@/sync/records/account-record";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";

function account(recordId: string, payloadId: string, deletedAt: string | null = null): DecryptedRecord {
  return {
    id: recordId,
    deviceId: null,
    updatedAt: "2026-10-02T06:47:22.294Z",
    deletedAt,
    envelope: {
      type: "account",
      payloadVersion: 1,
      schemaVersion: 1,
      payload: { recordType: "account", id: payloadId, name: "Główny", baseCurrency: "PLN" },
    },
  } as DecryptedRecord;
}

// Migracja z lipca przeniosła rekordy pod nowe ID, ale portfel startowy
// zachował w treści stare ID („00000000-…-0001”). Widok zna portfel po ID
// z treści, więc szukanie rekordu tylko po ID rekordu go nie znajdowało.
describe("findAccountRecord", () => {
  const seedId = "00000000-0000-0000-0000-000000000001";

  it("znajduje rekord przeniesiony pod inne ID po ID z treści", () => {
    const records = [account("00000000-0000-0000-0000-000000000001", seedId, "2026-07-16T20:31:07.768Z"), account("e6506530-749a-4695-823f-93b9bca19a8a", seedId)];
    expect(findAccountRecord(records, seedId)?.id).toBe("e6506530-749a-4695-823f-93b9bca19a8a");
  });

  it("znajduje zwykły rekord po jego ID", () => {
    const id = "03ad0e17-b487-4d99-8c15-b92ad9af2b41";
    expect(findAccountRecord([account(id, id)], id)?.id).toBe(id);
  });

  it("pomija usunięte rekordy", () => {
    expect(findAccountRecord([account(seedId, seedId, "2026-07-16T20:31:07.768Z")], seedId)).toBeUndefined();
  });
});
