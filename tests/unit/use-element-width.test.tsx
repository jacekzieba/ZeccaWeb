import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { useElementWidth } from "@/lib/use-element-width";

type Observed = { element: Element; callback: ResizeObserverCallback; disconnected: boolean };
let observed: Observed[] = [];

class FakeResizeObserver {
  private entry: Observed | null = null;
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(element: Element) {
    this.entry = { element, callback: this.callback, disconnected: false };
    observed.push(this.entry);
  }
  unobserve() {}
  disconnect() {
    if (this.entry) this.entry.disconnected = true;
  }
}

function resize(element: Element, width: number) {
  const target = observed.find((o) => o.element === element && !o.disconnected);
  if (!target) throw new Error("element nie jest obserwowany");
  act(() => {
    target.callback([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver);
  });
}

// Wykres bez danych nie renderuje kontenera — tak jak V2Area/AreaChart przy < 2 punktach.
function Chart({ points }: { points: number }) {
  const { ref, width } = useElementWidth<HTMLDivElement>(820, 320);
  if (points < 2) return null;
  return <div ref={ref} data-testid="chart" data-width={width} />;
}

beforeEach(() => {
  observed = [];
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useElementWidth", () => {
  it("podpina obserwatora, gdy kontener pojawi się dopiero po dociągnięciu danych", () => {
    const { rerender, getByTestId } = render(<Chart points={0} />);
    rerender(<Chart points={5} />);

    const chart = getByTestId("chart");
    resize(chart, 500);
    expect(chart.dataset.width).toBe("500");
  });

  it("trzyma minimalną szerokość i odłącza obserwatora po odmontowaniu kontenera", () => {
    const { rerender, getByTestId } = render(<Chart points={5} />);
    const chart = getByTestId("chart");
    resize(chart, 100);
    expect(chart.dataset.width).toBe("320");

    rerender(<Chart points={0} />);
    expect(observed.every((o) => o.disconnected)).toBe(true);
  });
});
