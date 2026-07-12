import { describe, expect, it } from "vitest";
import { buildEtfCatalog, loadEtfCatalog } from "@/features/import/etf-catalog";

// The catalog enriches new import instruments with identity (ISIN, full name,
// domicile). Lookup is by base ticker — XTB symbols carry an exchange suffix
// (VWCE.DE) that the catalog keys don't.

const catalog = buildEtfCatalog([
  { ticker: "VWCE", isin: "IE00BK5BQT80", name: "Vanguard FTSE All-World", domicile: "Irlandia" },
  { ticker: "CSPX", isin: "IE00B5BMR087", name: "iShares Core S&P 500", domicile: "Irlandia" },
]);

describe("buildEtfCatalog lookup", () => {
  it("matches a plain base ticker", () => {
    expect(catalog.lookup("VWCE")?.isin).toBe("IE00BK5BQT80");
  });

  it("strips the XTB exchange suffix before matching", () => {
    const hit = catalog.lookup("VWCE.DE");
    expect(hit?.name).toBe("Vanguard FTSE All-World");
    expect(hit?.domicile).toBe("Irlandia");
  });

  it("is case-insensitive", () => {
    expect(catalog.lookup("cspx.uk")?.isin).toBe("IE00B5BMR087");
  });

  it("returns null for an unknown ticker", () => {
    expect(catalog.lookup("ZZZZ.XX")).toBeNull();
  });
});

describe("loadEtfCatalog (bundled data)", () => {
  it("loads the real catalog and resolves a known ticker by XTB symbol", async () => {
    const cat = await loadEtfCatalog();
    const hit = cat.lookup("VWCE.DE");
    expect(hit?.isin).toBe("IE00BK5BQT80");
    expect(hit?.domicile).toBe("Irlandia");
  });
});
