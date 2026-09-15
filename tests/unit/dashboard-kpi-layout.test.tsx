import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { KPI_TILE_META } from "@/components/metrics/portfolio-kpi-strip";
import { MetricTiles } from "@/components/layout/metric-tiles";

afterEach(cleanup);

describe("dashboard KPI layout", () => {
  it("keeps short sections at their natural height beside taller sections", () => {
    // KpiCard, sprawdzany tu wcześniej, nie istnieje już nigdzie w produkcie —
    // Dashboard, Portfel i Raporty przeszły na MetricTiles. Ten sam kafelek
    // renderuje się w SectionGrid pojedynczo (Portfel ma per-KPI sekcje), więc
    // ryzyko rozciągnięcia obok wyższej sekcji zostaje takie samo jak było.
    const { container } = render(
      <MetricTiles
        rows={[{ key: "kpiXirr", source: "Liczone lokalnie", detail: "na Twoim urządzeniu", label: "MWR · XIRR", value: "+11,47%", sub: "rocznie" }]}
      />,
    );

    expect((container.querySelector(".metric-tile") as HTMLElement).style.height).toBe("auto");
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
