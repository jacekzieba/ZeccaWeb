import { describe, expect, it } from "vitest";
import { groupTreasuryBondSeries, treasuryBondFamily } from "@/domain/bonds/bond-series-groups";

describe("treasury bond series grouping", () => {
  it("recognizes every treasury bond family from its series prefix", () => {
    expect(treasuryBondFamily({ kind: "treasuryBond", symbol: "ROD0338" })).toBe("ROD");
    expect(treasuryBondFamily({ kind: "treasuryBond", symbol: "ros1228" })).toBe("ROS");
    expect(treasuryBondFamily({ kind: "treasuryBond", symbol: "EDO0435" })).toBe("EDO");
    expect(treasuryBondFamily({ kind: "treasuryBond", symbol: "COI1130" })).toBe("COI");
    expect(treasuryBondFamily({ kind: "treasuryBond", symbol: "TOS0629" })).toBe("TOS");
    expect(treasuryBondFamily({ kind: "listedBond", symbol: "ROD0338" })).toBeNull();
  });

  it("keeps other instruments in place and combines each family once", () => {
    const rows = [
      { id: "etf", kind: "etf", symbol: "VWRL.NL" },
      { id: "ros-a", kind: "treasuryBond", symbol: "ROS0229" },
      { id: "edo-a", kind: "treasuryBond", symbol: "EDO0435" },
      { id: "rod-a", kind: "treasuryBond", symbol: "ROD0338" },
      { id: "ros-b", kind: "treasuryBond", symbol: "ROS1228" },
      { id: "edo-b", kind: "treasuryBond", symbol: "EDO0536" },
    ];

    const grouped = groupTreasuryBondSeries(rows);

    expect(grouped.map((entry) => entry.type === "item" ? entry.item.id : entry.family)).toEqual([
      "etf",
      "ROS",
      "EDO",
      "ROD",
    ]);
    expect(grouped[1]).toMatchObject({ type: "group", family: "ROS", items: [rows[1], rows[4]] });
    expect(grouped[2]).toMatchObject({ type: "group", family: "EDO", items: [rows[2], rows[5]] });
  });
});
