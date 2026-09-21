import { describe, expect, it } from "vitest";
import { utcDateOrNull } from "@/lib/calendar-date";

// `Date.UTC` przelicza nieistniejące daty po cichu (31.02 → 3.03). utcDateOrNull ma zwrócić
// datę tylko wtedy, gdy wraca z tymi samymi składnikami.
describe("utcDateOrNull", () => {
  it.each([
    [2026, 5, 17, "2026-05-17"],
    [2024, 2, 29, "2024-02-29"], // rok przestępny
    [2000, 2, 29, "2000-02-29"], // podzielny przez 400
    [2026, 12, 31, "2026-12-31"],
    [2026, 1, 1, "2026-01-01"],
    [2026, 4, 30, "2026-04-30"],
    [1000, 1, 1, "1000-01-01"], // dolna granica roku
    [9999, 12, 31, "9999-12-31"], // górna granica roku
  ])("%i-%i-%i istnieje", (y, m, d, iso) => {
    expect(utcDateOrNull(y, m, d)?.toISOString().slice(0, 10)).toBe(iso);
  });

  it.each([
    [2026, 2, 29], // nie rok przestępny
    [1900, 2, 29], // podzielny przez 100, ale nie przez 400
    [2026, 2, 30], [2026, 2, 31],
    [2026, 4, 31], [2026, 6, 31], [2026, 9, 31], [2026, 11, 31], // miesiące po 30 dni
    [2026, 1, 32], [2026, 1, 0], [2026, 1, -1],
    [2026, 0, 15], [2026, 13, 1], [2026, -1, 1],
    [999, 1, 1], [10000, 1, 1], [0, 1, 1], [-2026, 1, 1], // poza zakresem lat
    [2026.5, 1, 1], [Number.NaN, 1, 1], [2026, Number.NaN, 1], [2026, 1, Number.NaN],
    [Number.POSITIVE_INFINITY, 1, 1],
  ])("%s-%s-%s nie istnieje", (y, m, d) => {
    expect(utcDateOrNull(y, m, d)).toBeNull();
  });

  it("zwraca północ UTC danego dnia", () => {
    expect(utcDateOrNull(2026, 5, 17)?.toISOString()).toBe("2026-05-17T00:00:00.000Z");
  });
});
