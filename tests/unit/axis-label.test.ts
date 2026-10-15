import { describe, expect, it } from "vitest";
import { axisLabeler } from "@/components/charts/axis-label";

describe("axisLabeler", () => {
  it("dodaje rok, gdy seria obejmuje co najmniej rok", () => {
    const points = [
      { label: "15 paź", date: "2025-10-15" },
      { label: "15 paź", date: "2026-10-15" },
    ];
    const label = axisLabeler(points);
    expect(label(points[0])).toBe("15 paź ’25");
    expect(label(points[1])).toBe("15 paź ’26");
  });

  it("zostawia krótką etykietę dla krótkich serii", () => {
    const points = [
      { label: "1 wrz", date: "2026-09-01" },
      { label: "15 paź", date: "2026-10-15" },
    ];
    expect(axisLabeler(points)(points[0])).toBe("1 wrz");
  });

  it("nie psuje się bez dat", () => {
    expect(axisLabeler([{ label: "Sty" }, { label: "Lut" }])({ label: "Sty" })).toBe("Sty");
  });
});
