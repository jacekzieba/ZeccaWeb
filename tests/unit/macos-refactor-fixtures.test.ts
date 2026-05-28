import { describe, expect, it } from "vitest";
import fixture from "../fixtures/macos-refactor/sync-fixture.json";
import { buildInvestorDataSnapshot, buildInstrumentList, buildPortfolioDetail, buildTransactionList } from "@/sync/records/investor-snapshot";
import { base64ToBytes } from "@/sync/encryption/base64";
import { decryptEncryptedRecords } from "@/sync/records/encrypted-records";
import { importAesGcmKey } from "@/sync/encryption/aes-gcm";

describe("macOS refactor sync fixtures", () => {
  it("decrypts native encrypted_records and builds a compatible web snapshot", async () => {
    const key = await importAesGcmKey(base64ToBytes(fixture.keyBase64));
    const records = await decryptEncryptedRecords(key, fixture.encryptedRecords);

    expect(records.map((record) => record.envelope.payload)).toEqual(
      fixture.plaintextPayloads,
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
    const portfolio = buildPortfolioDetail(records, native.portfolios[0].id);

    expect(records).toHaveLength(fixture.encryptedRecords.length);
    expect(snapshot.portfolios).toHaveLength(native.portfolios.length);
    expect(transactions).toHaveLength(native.transactions.length);
    expect(instruments).toHaveLength(native.instruments.length);
    expect(portfolio?.name).toBe(native.portfolios[0].name);

    expect(snapshot.income).toEqual({
      earningCount: native.earnings.length,
      burdenCount: native.earningBurdens.length,
      earningsPLN: 12_000,
      burdensPLN: 2_400,
      netPLN: 9_600,
    });
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
