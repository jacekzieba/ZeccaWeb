import { describe, expect, it } from "vitest";
import { LANDING_DEMO_AS_OF, buildLandingDemoSnapshot } from "../../app/_landing/landing-demo-data";

describe("landing demo data", () => {
  it("builds a deterministic public snapshot for all preview modules", () => {
    const first = buildLandingDemoSnapshot();
    const second = buildLandingDemoSnapshot();

    expect(first.asOf).toBe(LANDING_DEMO_AS_OF);
    expect(first.totalValue).toBe(second.totalValue);
    expect(first.valuationSeries).toEqual(second.valuationSeries);
    expect(first.netInvestedSeries).toHaveLength(first.valuationSeries.length);
    expect(first.allocation.map((slice) => slice.label)).toEqual([
      "Akcje / ETF",
      "Kryptowaluty",
      "Gotówka",
    ]);
    expect(first.portfolios.map((portfolio) => portfolio.name)).toEqual(
      expect.arrayContaining(["IKE · długi termin", "IKZE · emerytura", "Portfel główny"]),
    );
  });
});
