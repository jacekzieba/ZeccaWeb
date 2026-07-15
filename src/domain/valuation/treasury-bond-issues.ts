import type { BondParamsInput } from "@/domain/valuation/position-valuator";

type KnownTreasuryBondIssue = Omit<BondParamsInput, "issueDate" | "maturityDate"> & {
  issueDate: string;
  maturityDate: string;
};

const KNOWN_ISSUES: Record<string, KnownTreasuryBondIssue> = {
  ROS1228: inflationBond("2022-12-22T00:00:00.000Z", "2028-12-22T00:00:00.000Z", 7.2, 1.5),
  ROS0229: inflationBond("2023-02-27T00:00:00.000Z", "2029-02-27T00:00:00.000Z", 7.2, 1.5),
  ROS1129: inflationBond("2023-11-30T00:00:00.000Z", "2029-11-30T00:00:00.000Z", 6.95, 1.75),
  ROD0338: inflationBond("2026-03-27T00:00:00.000Z", "2038-03-27T00:00:00.000Z", 5.85, 2.5),
};

/** Full persisted parameters used when PKO imports a known treasury issue. */
export function knownTreasuryBondIssue(code: string): KnownTreasuryBondIssue | null {
  return KNOWN_ISSUES[normalizeCode(code)] ?? null;
}

/** Formula parameters for both newly imported and legacy parameterless assets. */
export function knownTreasuryBondValuationParams(code: string): BondParamsInput | null {
  const known = knownTreasuryBondIssue(code);
  if (!known) return null;

  return {
    issueDate: new Date(known.issueDate),
    maturityDate: new Date(known.maturityDate),
    nominalValue: known.nominalValue,
    firstPeriodRate: known.firstPeriodRate,
    subsequentBase: known.subsequentBase,
    marginOverBase: known.marginOverBase,
    capitalization: known.capitalization,
    interestPayment: known.interestPayment,
  };
}

export function normalizeTreasuryBondParams(
  code: string,
  params: BondParamsInput,
): BondParamsInput {
  return knownTreasuryBondValuationParams(code) ?? params;
}

function inflationBond(
  issueDate: string,
  maturityDate: string,
  firstPeriodRate: number,
  marginOverBase: number,
): KnownTreasuryBondIssue {
  return {
    issueDate,
    maturityDate,
    nominalValue: 100,
    firstPeriodRate,
    subsequentBase: "inflacja",
    marginOverBase,
    capitalization: "roczna",
    interestPayment: "przy wykupie",
  };
}

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}
