import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { AreaChart } from "@/components/charts/area-chart";
import { ValueVsDepositsChart } from "@/components/charts/value-vs-deposits-chart";
import type { ValuationPoint } from "@/domain/models/investor-data";

const UP = "var(--up)";
const DOWN = "var(--down)";

beforeAll(() => {
  // Oba wykresy mierzą się przez ResizeObserver, którego jsdom nie ma.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(cleanup);

function series(values: number[]): ValuationPoint[] {
  return values.map((value, index) => ({
    date: `2026-0${index + 1}-01`,
    label: `M${index + 1}`,
    value,
  }));
}

/** Kolor linii to komunikat o znaku wyniku, nie ozdoba — zielony gdy na plus,
 * czerwony gdy na minus. Te testy pilnują tej reguły na obu wykresach. */
describe("kolory wykresów niosą znak wyniku", () => {
  it("AreaChart rysuje rosnącą serię na zielono, malejącą na czerwono", () => {
    const rising = render(<AreaChart data={series([100, 120, 140])} />);
    expect(rising.container.querySelector("polyline")?.getAttribute("stroke")).toBe(UP);
    cleanup();

    const falling = render(<AreaChart data={series([140, 120, 100])} />);
    expect(falling.container.querySelector("polyline")?.getAttribute("stroke")).toBe(DOWN);
  });

  it("AreaChart oddaje pierwszeństwo jawnemu kolorowi serii", () => {
    const { container } = render(<AreaChart data={series([140, 100])} color="#123456" />);
    expect(container.querySelector("polyline")?.getAttribute("stroke")).toBe("#123456");
  });

  it("ValueVsDepositsChart barwi linię wartości względem wpłat, a wpłaty trzyma neutralne", () => {
    const above = render(
      <ValueVsDepositsChart value={series([100, 130])} deposits={series([100, 110])} />,
    );
    const aboveLines = [...above.container.querySelectorAll("polyline")];
    expect(aboveLines.at(-1)?.getAttribute("stroke")).toBe(UP);
    expect(aboveLines.some((line) => line.getAttribute("stroke") === "var(--ink-muted)")).toBe(true);
    cleanup();

    const below = render(
      <ValueVsDepositsChart value={series([100, 90])} deposits={series([100, 110])} />,
    );
    expect([...below.container.querySelectorAll("polyline")].at(-1)?.getAttribute("stroke")).toBe(DOWN);
  });
});
