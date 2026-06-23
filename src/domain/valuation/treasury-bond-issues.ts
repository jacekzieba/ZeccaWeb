import type { BondParamsInput } from "@/domain/valuation/position-valuator";

type KnownTreasuryBondIssue = Omit<BondParamsInput, "maturityDate"> & {
  maturityDate: string;
};

const KNOWN_ISSUES: Record<string, KnownTreasuryBondIssue> = {
  ROS1228: inflationBond("2028-12-22T00:00:00.000Z", 7.2, 1.5),
  ROS0229: inflationBond("2029-02-27T00:00:00.000Z", 7.2, 1.5),
  ROS1129: inflationBond("2029-11-30T00:00:00.000Z", 6.95, 1.75),
  ROD0338: inflationBond("2038-03-27T00:00:00.000Z", 5.85, 2.5),
};

export function normalizeTreasuryBondParams(
  code: string,
  params: BondParamsInput,
): BondParamsInput {
  const known = KNOWN_ISSUES[normalizeCode(code)];
  if (!known) return params;

  return {
    maturityDate: new Date(known.maturityDate),
    nominalValue: known.nominalValue,
    firstPeriodRate: known.firstPeriodRate,
    subsequentBase: known.subsequentBase,
    marginOverBase: known.marginOverBase,
    capitalization: known.capitalization,
    interestPayment: known.interestPayment,
  };
}

function inflationBond(
  maturityDate: string,
  firstPeriodRate: number,
  marginOverBase: number,
): KnownTreasuryBondIssue {
  return {
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
