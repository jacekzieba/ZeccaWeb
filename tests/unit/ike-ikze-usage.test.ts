import { describe, expect, it } from "vitest";
import { computeIkeIkzeUsage } from "@/features/settings/ike-ikze-usage";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";
import type { RecordType } from "@/domain/models/investor-data";
import type { LegalLimits } from "@/market-data/types";

function record(type: RecordType, id: string, payload: unknown): DecryptedRecord {
  return {
    id,
    deviceId: "test",
    updatedAt: "2026-06-30T10:00:00.000Z",
    deletedAt: null,
    envelope: { type, payloadVersion: 1, schemaVersion: 1, payload },
  };
}

const limits: LegalLimits = {
  provider: "finwire",
  year: 2026,
  ike: 28260,
  ikze: 11304,
  ikzeSelfemployed: 16956,
};

const IKE_ID = "11111111-1111-4111-8111-111111111111";
const IKZE_ID = "22222222-2222-4222-8222-222222222222";
const now = new Date("2026-07-17T00:00:00.000Z");

describe("computeIkeIkzeUsage", () => {
  it("sums this year's cashDeposit contributions per wrapper and clamps the ratio", () => {
    const records = [
      record("account", IKE_ID, { id: IKE_ID, accountType: "IKE" }),
      // Two deposits this year: 6000 + 8000 = 14000 of 28260 → 0.4955...
      record("transaction", "t1", { portfolioID: IKE_ID, transactionType: "cashDeposit", grossAmount: 6000, date: "2026-02-01T00:00:00.000Z" }),
      record("transaction", "t2", { portfolioID: IKE_ID, transactionType: "cashDeposit", grossAmount: 8000, date: "2026-05-01T00:00:00.000Z" }),
      // Prior year — must be excluded.
      record("transaction", "t3", { portfolioID: IKE_ID, transactionType: "cashDeposit", grossAmount: 9999, date: "2025-12-31T00:00:00.000Z" }),
      // A buy is not a contribution.
      record("transaction", "t4", { portfolioID: IKE_ID, transactionType: "buy", grossAmount: 5000, date: "2026-03-01T00:00:00.000Z" }),
    ];

    const usage = computeIkeIkzeUsage(records, limits, now);
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ type: "IKE", contributed: 14000, limit: 28260 });
    expect(usage[0].ratio).toBeCloseTo(14000 / 28260, 5);
  });

  it("matches lowercase (fake-sync) account types and clamps an over-limit ratio to 1", () => {
    const records = [
      record("account", IKZE_ID, { id: IKZE_ID, accountType: "ikze" }),
      record("transaction", "t1", { portfolioID: IKZE_ID, transactionType: "cashDeposit", grossAmount: 20000, date: "2026-04-01T00:00:00.000Z" }),
    ];

    const usage = computeIkeIkzeUsage(records, limits, now);
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ type: "IKZE", contributed: 20000, ratio: 1 });
  });

  it("returns nothing without records or limits", () => {
    expect(computeIkeIkzeUsage(null, limits, now)).toEqual([]);
    expect(computeIkeIkzeUsage([record("account", IKE_ID, { id: IKE_ID, accountType: "IKE" })], null, now)).toEqual([]);
  });
});
