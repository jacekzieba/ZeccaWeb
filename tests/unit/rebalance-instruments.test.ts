import { describe, expect, it } from "vitest";
import { splitOrdersByInstrument } from "@/domain/allocation/rebalance";

const holding = (
  instrumentId: string,
  kind: string,
  marketValue: number,
  quantity: number,
) => ({ instrumentId, symbol: instrumentId.toUpperCase(), name: instrumentId, kind, marketValue, quantity });

describe("splitOrdersByInstrument", () => {
  it("splits a class order across its instruments proportionally to value", () => {
    const lines = splitOrdersByInstrument(
      [{ key: "equity", action: "buy", amount: 1000, resultingDriftPp: 0 }],
      [holding("a", "etf", 600, 6), holding("b", "stock", 200, 4), holding("c", "treasuryBond", 500, 5)],
    );
    expect(lines.map((l) => l.instrumentId)).toEqual(["a", "b"]);
    expect(lines[0].amount).toBeCloseTo(750, 2);
    expect(lines[1].amount).toBeCloseTo(250, 2);
    // units = amount / (marketValue / quantity)
    expect(lines[0].quantity).toBeCloseTo(7.5, 4);
    expect(lines[1].quantity).toBeCloseTo(5, 4);
  });

  it("sells proportionally and never more than a holding is worth", () => {
    const lines = splitOrdersByInstrument(
      [{ key: "equity", action: "sell", amount: 400, resultingDriftPp: 0 }],
      [holding("a", "etf", 600, 6), holding("b", "etf", 200, 2)],
    );
    expect(lines.reduce((s, l) => s + l.amount, 0)).toBeCloseTo(400, 2);
    expect(lines[0].amount).toBeLessThanOrEqual(600);
    expect(lines[1].amount).toBeLessThanOrEqual(200);
  });

  it("aggregates the same instrument held in several portfolios", () => {
    const lines = splitOrdersByInstrument(
      [{ key: "equity", action: "buy", amount: 300, resultingDriftPp: 0 }],
      [holding("a", "etf", 100, 1), holding("a", "etf", 200, 2)],
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].amount).toBeCloseTo(300, 2);
    expect(lines[0].quantity).toBeCloseTo(3, 4);
  });

  it("keeps a class-only line when the class holds no instruments", () => {
    const lines = splitOrdersByInstrument(
      [{ key: "crypto", action: "buy", amount: 500, resultingDriftPp: 0 }],
      [holding("a", "etf", 100, 1)],
    );
    expect(lines).toEqual([
      { key: "crypto", action: "buy", instrumentId: null, symbol: null, name: null, amount: 500, quantity: null },
    ]);
  });

  it("has no instrument lines for cash", () => {
    const lines = splitOrdersByInstrument(
      [{ key: "cash", action: "buy", amount: 100, resultingDriftPp: 0 }],
      [],
    );
    expect(lines[0].instrumentId).toBeNull();
  });
});
