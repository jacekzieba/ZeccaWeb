import { describe, expect, it } from "vitest";
import { DARK } from "@/design/tokens";
import { PORTFOLIO_SWATCHES, portfolioDotColor } from "@/lib/asset-colors";

// Mirror Tests/InvestorPackageTests/DesignTokensTests.swift (PortfolioSwatches
// section) w repo natywnym — te same osiem barw, to samo przypisanie starych
// kolorów, ta sama zasada "nieznana wartość ląduje w palecie".

describe("portfolioDotColor", () => {
  it("osiem barw jest parami różnych i żadna nie jest bursztynem", () => {
    expect(new Set(PORTFOLIO_SWATCHES).size).toBe(PORTFOLIO_SWATCHES.length);
    expect(PORTFOLIO_SWATCHES).not.toContain(DARK.accent);
  });

  it("przypisanie ośmiu starych barw jest wzajemnie jednoznaczne", () => {
    const legacy = [
      "#7EA16B", "#4F6D8F", "#B07C3E", "#8B3A62",
      "#3E8A7A", "#A14F4F", "#5E4B8B", "#3A3A3A",
    ];
    const mapped = legacy.map(portfolioDotColor);
    expect(new Set(mapped).size).toBe(legacy.length);
    for (const color of mapped) {
      expect(PORTFOLIO_SWATCHES).toContain(color);
    }
  });

  it("nieznana wartość — ręczna albo z natywnego — ląduje w palecie", () => {
    expect(PORTFOLIO_SWATCHES).toContain(portfolioDotColor("#FF00FF"));
    expect(PORTFOLIO_SWATCHES).toContain(portfolioDotColor("123456"));
  });

  it("mapowanie jest idempotentne: barwa z palety wraca sama do siebie", () => {
    for (const swatch of PORTFOLIO_SWATCHES) {
      expect(portfolioDotColor(swatch)).toBe(swatch);
    }
  });

  it("zgadza się z paletą natywną (Sources/InvestorCore/PortfolioSwatches.swift)", () => {
    expect(PORTFOLIO_SWATCHES).toEqual([
      "#63A594", "#C9A24F", "#B6A2E4", "#8A9E97", "#5C7E93", "#A8776A", "#D4B87E", "#C6B8E6",
    ]);
  });
});
