import { afterEach, describe, expect, it } from "vitest";
import { exposeParityExport } from "@/sync/records/parity-snapshot";
import { makeRecord as record } from "./helpers/records";

const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const goodAccount = record("account", ACCOUNT, { recordType: "account", id: ACCOUNT, name: "Core", baseCurrency: "PLN" });
// Brak grossAmount/currency — pobłażliwy UI pomija, ścisły parytet rzuca.
const badTransaction = record("transaction", "99999999-9999-4999-8999-999999999999", {
  recordType: "transaction",
  id: "99999999-9999-4999-8999-999999999999",
  portfolioID: ACCOUNT,
  transactionType: "cashDeposit",
});

afterEach(() => exposeParityExport(null));

describe("exposeParityExport", () => {
  it("nie liczy parytetu przy instalacji — rekord o złym kształcie nie wywraca aplikacji", () => {
    expect(() => exposeParityExport([goodAccount, badTransaction])).not.toThrow();
    // Błąd wychodzi dopiero przy jawnym eksporcie z devtools.
    expect(() => window.__investorWebExportParitySnapshot?.()).toThrow();
  });

  it("eksportuje JSON parytetu na żądanie i znika po wyczyszczeniu rekordów", () => {
    exposeParityExport([goodAccount]);
    const exported = JSON.parse(window.__investorWebExportParitySnapshot!());
    expect(exported.schema).toBe("investor-web-parity-snapshot/v1");
    expect(exported.portfolios).toHaveLength(1);

    exposeParityExport(null);
    expect(window.__investorWebExportParitySnapshot).toBeUndefined();
  });
});
