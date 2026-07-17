import { describe, expect, it } from "vitest";
import {
  parseFinwireCpi,
  parseFinwireLegalLimits,
  parseFinwireReferenceRateLatest,
} from "@/market-data/providers/finwire";

const CPI_JSON = {
  data: {
    source: "GUS (stat.gov.pl)",
    entries: [
      { period: "2026-06", yoy: 2.5, mom: null },
      { period: "2026-05", yoy: 3.1, mom: null },
      { period: "2025-02", yoy: 4.9, mom: null },
      { period: "bad", yoy: 9, mom: null },
      { period: "2026-04", yoy: null, mom: null },
    ],
  },
};

describe("parseFinwireCpi", () => {
  it("keeps only well-formed months inside the range, sorted ascending", () => {
    const observations = parseFinwireCpi(CPI_JSON, "2025-01-01", "2026-12-31");
    expect(observations).toEqual([
      { provider: "gus", date: "2025-02-01", yoyRate: 4.9 },
      { provider: "gus", date: "2026-05-01", yoyRate: 3.1 },
      { provider: "gus", date: "2026-06-01", yoyRate: 2.5 },
    ]);
  });

  it("excludes months outside the requested window", () => {
    const observations = parseFinwireCpi(CPI_JSON, "2026-05-01", "2026-06-30");
    expect(observations.map((o) => o.date)).toEqual(["2026-05-01", "2026-06-01"]);
  });
});

describe("parseFinwireReferenceRateLatest", () => {
  it("extracts the reference-rate entry", () => {
    const json = {
      data: {
        entries: [
          { indicator: "lom", value: 4.25, date: "2026-03-05" },
          { indicator: "ref", value: 3.75, date: "2026-03-05" },
        ],
      },
    };
    expect(parseFinwireReferenceRateLatest(json)).toEqual({
      provider: "nbp",
      effectiveDate: "2026-03-05",
      rate: 3.75,
    });
  });

  it("returns null when no ref indicator is present", () => {
    expect(
      parseFinwireReferenceRateLatest({ data: { entries: [{ indicator: "lom", value: 4, date: "2026-03-05" }] } }),
    ).toBeNull();
  });
});

describe("parseFinwireLegalLimits", () => {
  it("maps the IKE/IKZE caps", () => {
    const json = {
      data: {
        limits: {
          year: 2026,
          ike: 28260,
          ikze: 11304,
          ikzeSelfemployed: 16956,
          taxBelka: 0.19,
        },
      },
    };
    expect(parseFinwireLegalLimits(json)).toEqual({
      provider: "finwire",
      year: 2026,
      ike: 28260,
      ikze: 11304,
      ikzeSelfemployed: 16956,
    });
  });
});
