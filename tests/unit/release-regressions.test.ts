import { describe, expect, it } from "vitest";
import { makeAccountPayload, makeAssetPayload, makeManualValuationPayload, makeTransactionPayload } from "@/sync/records/macos-payloads";
import { knownTreasuryBondIssue } from "@/domain/valuation/treasury-bond-issues";
import { buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";
import { makeRecord } from "./helpers/records";

const portfolioID = "11111111-1111-4111-8111-111111111111";
const instrumentID = "22222222-2222-4222-8222-222222222222";
const asOf = new Date("2026-10-26T12:00:00Z");

describe("release regressions: native payload contract", () => {
  it("W02 sends a quote date as Swift reference seconds", () => {
    const payload = makeManualValuationPayload({ id: portfolioID, instrumentID, date: "2001-01-02T00:00:00.000Z", value: 10, currency: "PLN" });
    expect(payload.date).toBe(86400);
  });
  it("W03 completes the known treasury issue for the native decoder", () => {
    const payload = makeAssetPayload({ id: instrumentID, kind: "treasuryBond", symbol: "ROD0338", name: "ROD0338", currency: "PLN", bondParams: { ...knownTreasuryBondIssue("ROD0338") } });
    expect(payload.bondParams).toMatchObject({ series: "ROD", fullCode: "ROD0338", earlyRedemptionFee: expect.any(Number), issueDate: expect.any(Number), maturityDate: expect.any(Number) });
  });
  it.each(["depositParams", "listedBondParams", "bondParams"])("W04 keeps %s when only renaming an existing asset", (field) => {
    const params = { nominalValue: 1000, annualRate: 5, issuer: "Test" };
    const input = { id: instrumentID, kind: field === "depositParams" ? "deposit" : field === "listedBondParams" ? "listedBond" : "treasuryBond", symbol: "TEST", name: "Renamed", currency: "PLN", existing: { [field]: params } };
    const payload = makeAssetPayload(input);
    expect(payload[field as keyof typeof payload]).toEqual(params);
    expect(payload.name).toBe("Renamed");
  });
});

const records = () => [
  makeRecord("account", portfolioID, makeAccountPayload({ id: portfolioID, name: "Test", baseCurrency: "PLN" })),
  makeRecord("asset", instrumentID, makeAssetPayload({ id: instrumentID, kind: "stock", symbol: "TEST", name: "Test", currency: "USD" })),
  makeRecord("transaction", "33333333-3333-4333-8333-333333333333", makeTransactionPayload({ id: "33333333-3333-4333-8333-333333333333", portfolioID, transactionType: "cashDeposit", date: "2026-10-01T00:00:00Z", grossAmount: 1000, currency: "USD", fees: 0, taxes: 0 })),
  makeRecord("transaction", "44444444-4444-4444-8444-444444444444", makeTransactionPayload({ id: "44444444-4444-4444-8444-444444444444", portfolioID, instrumentID, transactionType: "buy", date: "2026-10-02T00:00:00Z", quantity: 10, price: 50, grossAmount: 500, currency: "USD", fees: 0, taxes: 0 })),
];

describe("release regressions: valuation parity", () => {
  it("W05 excludes USD without FX from PLN totals", () => {
    const snapshot = buildInvestorDataSnapshot(records(), { asOf, strict: true, useLatestTransactionFxRate: true, useMarketQuotes: true });
    expect(snapshot.totalValue).toBe(0);
    expect(snapshot.cash).toBe(0);
    expect(snapshot.diagnostics?.some((item) => item.code === "fx-missing")).toBe(true);
  });
  it("W06 uses current FX for a lot without historical FX, so an unchanged price has no gain", () => {
    const snapshot = buildInvestorDataSnapshot(records(), { asOf, strict: true, useLatestTransactionFxRate: true, useMarketQuotes: true, fxRates: [{ currency: "USD", rate: 4, date: new Date("2026-10-01T00:00:00Z") }] });
    expect(snapshot.totalValue).toBe(4000);
    expect(snapshot.metrics.unrealizedPnl).toBe(0);
  });
});
