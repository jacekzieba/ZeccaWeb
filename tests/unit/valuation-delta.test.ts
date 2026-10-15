import { describe, expect, it } from "vitest";
import { calculateDeltaPLN } from "@/domain/metrics/valuation-delta";

const point = (date: string, value: number) => ({ label: date, date, value });

describe("calculateDeltaPLN", () => {
  it("zwraca 0 dla pustej serii", () => {
    expect(calculateDeltaPLN([])).toBe(0);
  });

  it("liczy różnicę względem ostatniego punktu sprzed miesiąca", () => {
    const series = [point("2026-08-01", 90), point("2026-09-15", 100), point("2026-10-01", 105), point("2026-10-15", 110)];
    expect(calculateDeltaPLN(series)).toBe(10);
  });

  it("dla krótkiej serii bierze pierwszy punkt jako bazę", () => {
    const series = [point("2026-10-10", 100), point("2026-10-15", 103)];
    expect(calculateDeltaPLN(series)).toBe(3);
  });
});
