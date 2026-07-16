import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { KpiCard, KPI_TILE_META } from "@/components/metrics/portfolio-kpi-strip";

afterEach(cleanup);

describe("dashboard KPI layout", () => {
  it("keeps short sections at their natural height beside taller sections", () => {
    const { container } = render(<KpiCard label="MWR · XIRR" value="+11,47%" sub="rocznie" />);

    expect((container.firstElementChild as HTMLElement).style.height).toBe("auto");
  });

  it("keeps every KPI compact instead of stretching short content across two columns", () => {
    const presets = Object.fromEntries(
      KPI_TILE_META.map((tile) => [tile.id, tile.sizePresets.map((size) => size.width)]),
    );

    expect(presets).toEqual({
      kpiUnrealized: [1],
      kpiXirr: [1],
      kpiTwr: [1],
      kpiCagr: [1],
      kpiRealReturn: [1],
      kpiMaxDd: [1],
      kpiRealized: [1],
      kpiInvested: [1],
      kpiDividends: [1],
      kpiOpenPositions: [1],
    });
  });
});
