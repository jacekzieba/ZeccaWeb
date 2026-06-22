export type GroupedTreasuryBondFamily = string;

export type BondSeriesDisplayEntry<T> =
  | { type: "item"; item: T }
  | { type: "group"; family: GroupedTreasuryBondFamily; items: T[] };

const TREASURY_BOND_FAMILY_LABELS: Record<string, string> = {
  OTS: "Obligacje trzymiesięczne",
  ROR: "Obligacje roczne",
  DOR: "Obligacje dwuletnie",
  TOS: "Obligacje trzyletnie",
  COI: "Obligacje czteroletnie",
  EDO: "Obligacje dziesięcioletnie",
  ROD: "Rodzinne obligacje dwunastoletnie",
  ROS: "Rodzinne obligacje sześcioletnie",
};

export function treasuryBondFamilyLabel(family: GroupedTreasuryBondFamily): string {
  return TREASURY_BOND_FAMILY_LABELS[family] ?? `${family} · obligacje skarbowe`;
}

export function treasuryBondFamily(item: { kind: string; symbol: string }): GroupedTreasuryBondFamily | null {
  if (item.kind !== "treasuryBond") return null;
  return item.symbol.trim().toUpperCase().match(/^([A-Z]+)\d+$/)?.[1] ?? null;
}

/** Keeps the source ordering and replaces each treasury-bond series type with one expandable family entry. */
export function groupTreasuryBondSeries<T extends { kind: string; symbol: string }>(
  items: T[],
): BondSeriesDisplayEntry<T>[] {
  const result: BondSeriesDisplayEntry<T>[] = [];
  const groups = new Map<GroupedTreasuryBondFamily, Extract<BondSeriesDisplayEntry<T>, { type: "group" }>>();

  for (const item of items) {
    const family = treasuryBondFamily(item);
    if (!family) {
      result.push({ type: "item", item });
      continue;
    }

    const existing = groups.get(family);
    if (existing) {
      existing.items.push(item);
      continue;
    }

    const group: Extract<BondSeriesDisplayEntry<T>, { type: "group" }> = {
      type: "group",
      family,
      items: [item],
    };
    groups.set(family, group);
    result.push(group);
  }

  return result;
}
