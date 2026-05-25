import { describe, expect, it, vi } from "vitest";
import {
  makeAccountPayload,
  makeAssetPayload,
  makeManualValuationPayload,
  makeTransactionPayload,
  swiftReferenceSeconds,
} from "@/sync/records/macos-payloads";

describe("macOS sync payload helpers", () => {
  it("creates account payloads with fields expected by macOS Codable", () => {
    expect(
      makeAccountPayload({
        id: "11111111-1111-4111-8111-111111111111",
        name: "IKE",
        baseCurrency: "PLN",
      }),
    ).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      recordType: "account",
      name: "IKE",
      accountType: "custom",
      baseCurrency: "PLN",
      colorHex: "#7EA16B",
      targetAllocation: {},
    });
  });

  it("creates asset payloads with nullable refactor fields", () => {
    expect(
      makeAssetPayload({
        id: "22222222-2222-4222-8222-222222222222",
        kind: "stock",
        symbol: "AAPL",
        name: "Apple",
        currency: "USD",
      }),
    ).toMatchObject({
      recordType: "asset",
      exchange: null,
      country: null,
      isin: null,
      marketDataID: null,
      listedBondParams: null,
      depositParams: null,
    });
  });

  it("creates transaction payloads with macOS-required metadata fields", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-25T12:00:00.000Z"));

    const payload = makeTransactionPayload({
      id: "33333333-3333-4333-8333-333333333333",
      date: swiftReferenceSeconds(new Date("2026-05-24T00:00:00.000Z")),
      portfolioID: "11111111-1111-4111-8111-111111111111",
      instrumentID: null,
      transactionType: "cashDeposit",
      grossAmount: 1000,
      currency: "PLN",
      fees: 0,
      taxes: 0,
    });

    expect(payload).toMatchObject({
      recordType: "transaction",
      bookingDate: null,
      notes: "",
      externalImportID: null,
      sourcePortfolioID: null,
      transferKind: null,
      transferSourceKind: null,
      contributionTreatment: null,
      transferCostBasisMode: null,
      transferLots: null,
    });
    expect(payload.createdAt).toBe(swiftReferenceSeconds(new Date("2026-05-25T12:00:00.000Z")));
    expect(payload.updatedAt).toBe(swiftReferenceSeconds(new Date("2026-05-25T12:00:00.000Z")));

    vi.useRealTimers();
  });

  it("creates manual valuation payloads with note and timestamps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-25T12:00:00.000Z"));

    const payload = makeManualValuationPayload({
      id: "44444444-4444-4444-8444-444444444444",
      instrumentID: "22222222-2222-4222-8222-222222222222",
      date: "2026-05-24T00:00:00.000Z",
      value: 123,
      currency: "USD",
    });

    expect(payload).toMatchObject({
      recordType: "manualValuation",
      note: "",
      createdAt: swiftReferenceSeconds(new Date("2026-05-25T12:00:00.000Z")),
      updatedAt: swiftReferenceSeconds(new Date("2026-05-25T12:00:00.000Z")),
    });

    vi.useRealTimers();
  });
});
