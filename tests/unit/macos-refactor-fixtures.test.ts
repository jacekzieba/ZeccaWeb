import { lowercaseUuids } from "@/sync/records/encrypted-records";
import { describe, expect, it } from "vitest";
import fixture from "../fixtures/macos-refactor/sync-fixture.json";
import {
  buildIncomeLists,
  buildInvestorDataSnapshot,
  buildInstrumentList,
  buildPortfolioDetail,
  buildTransactionList,
} from "@/sync/records/investor-snapshot";
import { buildParitySnapshot } from "@/sync/records/parity-snapshot";
import { base64ToBytes } from "@/sync/encryption/base64";
import { decryptEncryptedRecords } from "@/sync/records/encrypted-records";
import { importAesGcmKey } from "@/sync/encryption/aes-gcm";

describe("macOS refactor sync fixtures", () => {
  it("decrypts native encrypted_records and builds a compatible web snapshot", async () => {
    const key = await importAesGcmKey(base64ToBytes(fixture.keyBase64));
    const records = await decryptEncryptedRecords(key, fixture.encryptedRecords);

    expect(records.map((record) => record.envelope.payload)).toEqual(
      lowercaseUuids(fixture.plaintextPayloads),
    );
    expect(new Set(records.map((record) => record.envelope.type))).toEqual(
      new Set([
        "account",
        "asset",
        "transaction",
        "manualValuation",
        "income",
        "settings",
      ]),
    );

    const native = fixture.nativeSnapshot;
    const snapshot = buildInvestorDataSnapshot(records);
    const transactions = buildTransactionList(records);
    const instruments = buildInstrumentList(records);
    const incomeLists = buildIncomeLists(records);
    const portfolio = buildPortfolioDetail(records, native.portfolios[0].id);
    const paritySnapshot = buildParitySnapshot(records);

    expect(records).toHaveLength(fixture.encryptedRecords.length);
    expect(snapshot.portfolios).toHaveLength(native.portfolios.length);
    expect(transactions).toHaveLength(native.transactions.length);
    expect(instruments).toHaveLength(native.instruments.length);
    expect(portfolio?.name).toBe(native.portfolios[0].name);
    expect(paritySnapshot.schema).toBe("investor-web-parity-snapshot/v1");
    expect(paritySnapshot.recordSummary.byType.income).toBe(2);
    expect(paritySnapshot.totals.income.netPLN).toBe(9_600);
    expect(paritySnapshot.portfolios.map((item) => item.id)).toEqual(
      [...paritySnapshot.portfolios.map((item) => item.id)].sort(),
    );

    expect(snapshot.income).toEqual({
      earningCount: native.earnings.length,
      burdenCount: native.earningBurdens.length,
      earningsPLN: 12_000,
      burdensPLN: 2_400,
      netPLN: 9_600,
    });
    expect(incomeLists.earnings).toEqual([
      {
        ...native.earnings[0],
        kind: "earning",
        sourceUpdatedAt: "2025-05-21T00:11:00.000Z",
      },
    ]);
    expect(incomeLists.burdens).toEqual([
      {
        ...native.earningBurdens[0],
        kind: "burden",
        sourceUpdatedAt: "2025-05-21T00:12:00.000Z",
      },
    ]);
    expect(incomeLists.summaries).toEqual([
      {
        id: "2025-5",
        year: 2025,
        month: 5,
        periodStart: "2025-05-01T00:00:00.000Z",
        employmentPLN: 12_000,
        businessRevenuePLN: 0,
        burdenPLN: 2_400,
        sourcePLN: 12_000,
        totalPLN: 9_600,
        earningsCount: 1,
      },
    ]);
    expect(snapshot.totalValue).toBeGreaterThan(0);
    expect(snapshot.cash).toBeGreaterThan(0);
    expect(instruments.some((instrument) => instrument.symbol === "AAPL")).toBe(
      true,
    );
    expect(
      transactions.some(
        (transaction) =>
          transaction.transactionType === "fxConversion" &&
          transaction.currency === "PLN",
      ),
    ).toBe(true);
  });
});
