import { describe, expect, it } from "vitest";
import type { HoldingRow } from "@/domain/models/investor-data";
import { isStaleValuation, summarizeValuations } from "@/features/portfolios/holdings-quality";

const NOW = new Date("2026-10-15T12:00:00Z");

const holding = (label: string, lastPriceDate: string | null): HoldingRow => ({
  instrumentId: label + String(lastPriceDate),
  symbol: "X",
  name: "X",
  kind: "stock",
  quantity: 1,
  lastPrice: 1,
  lastPriceDate,
  currency: "PLN",
  valuationSource: "manual",
  valuationSourceLabel: label,
  marketValue: 1,
  portfolioPercent: 0,
});

describe("isStaleValuation", () => {
  it("świeża wycena nie jest stara", () => {
    expect(isStaleValuation("2026-10-12T00:00:00Z", NOW)).toBe(false);
  });
  it("wycena sprzed ponad tygodnia jest stara", () => {
    expect(isStaleValuation("2026-10-01T00:00:00Z", NOW)).toBe(true);
  });
  it("brak daty nie oznacza starej wyceny", () => {
    expect(isStaleValuation(null, NOW)).toBe(false);
  });
});

describe("summarizeValuations", () => {
  it("jedno źródło dla wszystkich pozycji", () => {
    const summary = summarizeValuations(
      [holding("Wycena ręczna", "2026-10-14T00:00:00Z"), holding("Wycena ręczna", "2026-09-01T00:00:00Z")],
      NOW,
    );
    expect(summary).toEqual({ dominantLabel: "Wycena ręczna", allSame: true, staleCount: 1 });
  });

  it("wskazuje dominujące źródło przy mieszanych", () => {
    const summary = summarizeValuations(
      [holding("Rynek", null), holding("Wycena ręczna", null), holding("Rynek", null)],
      NOW,
    );
    expect(summary.dominantLabel).toBe("Rynek");
    expect(summary.allSame).toBe(false);
  });

  it("puste pozycje", () => {
    expect(summarizeValuations([], NOW)).toEqual({ dominantLabel: null, allSame: true, staleCount: 0 });
  });
});
