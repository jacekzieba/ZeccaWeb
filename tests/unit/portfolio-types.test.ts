import { describe, expect, it } from "vitest";
import {
  NATIVE_PORTFOLIO_TYPES,
  normalizePortfolioType,
} from "@/features/portfolios/portfolio-types";

describe("portfolio types", () => {
  it("matches the native PortfolioType raw values", () => {
    expect(NATIVE_PORTFOLIO_TYPES).toEqual([
      "IKE",
      "IKZE",
      "Rachunek zwykły",
      "Bank",
      "Własny",
    ]);
  });

  it("normalizes legacy lowercase web values without discarding unknown types", () => {
    expect(normalizePortfolioType("ike")).toBe("IKE");
    expect(normalizePortfolioType("ikze")).toBe("IKZE");
    expect(normalizePortfolioType("taxable")).toBe("Rachunek zwykły");
    expect(normalizePortfolioType("custom")).toBe("Własny");
    expect(normalizePortfolioType("brokerage")).toBe("brokerage");
    expect(normalizePortfolioType(undefined)).toBe("Własny");
  });
});
