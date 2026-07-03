import { describe, expect, it } from "vitest";
import { INTRO_CARDS, TOUR_STEPS, nextPresentStep } from "@/features/onboarding/steps";

describe("onboarding step definitions", () => {
  it("has 2 intro cards and 5 tour steps in the approved order", () => {
    expect(INTRO_CARDS).toHaveLength(2);
    expect(TOUR_STEPS.map((s) => s.anchor)).toEqual([
      "dashboard-hero",
      "dashboard-instruments",
      "sidebar-portfolios",
      "positions-table",
      "earnings-summary",
    ]);
  });

  it("steps carry a route so the tour can navigate", () => {
    expect(TOUR_STEPS[0].route).toBe("/dashboard");
    expect(TOUR_STEPS[3].route).toBe("/positions");
    expect(TOUR_STEPS[4].route).toBe("/earnings");
  });

  it("ids are unique", () => {
    const ids = TOUR_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("nextPresentStep", () => {
  const present = (missing: string[]) => (anchor: string) => !missing.includes(anchor);

  it("advances to the immediate next step when present", () => {
    expect(nextPresentStep(TOUR_STEPS, 0, 1, present([]))).toBe(1);
  });

  it("skips steps whose anchor is missing", () => {
    expect(nextPresentStep(TOUR_STEPS, 0, 1, present(["dashboard-instruments"]))).toBe(2);
  });

  it("returns -1 past the last step", () => {
    expect(nextPresentStep(TOUR_STEPS, TOUR_STEPS.length - 1, 1, present([]))).toBe(-1);
  });

  it("walks backwards too", () => {
    expect(nextPresentStep(TOUR_STEPS, 2, -1, present(["dashboard-instruments"]))).toBe(0);
    expect(nextPresentStep(TOUR_STEPS, 0, -1, present([]))).toBe(-1);
  });
});
