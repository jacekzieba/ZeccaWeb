export type IncomeEntryKind = "earning" | "burden";
export type EmploymentType = "employment" | "business";
export type EarningBurdenCategory = "incomeTax" | "vat" | "zus" | "accounting";
export type EarningsTableFilter = "all" | "earnings" | "burdens";

export type EarningRow = {
  id: string;
  kind: "earning";
  year: number;
  month: number;
  employmentType: EmploymentType;
  enteredAmount: number;
  currency: string;
  fxRateToPLN: number;
  plnAmount: number;
  source: string;
  note: string | null;
  sourceUpdatedAt: string | null;
};

export type EarningBurdenRow = {
  id: string;
  kind: "burden";
  year: number;
  month: number;
  category: EarningBurdenCategory;
  amountPLN: number;
  note: string | null;
  sourceUpdatedAt: string | null;
};

export type EarningsTableRow = EarningRow | EarningBurdenRow;

export type EarningsMonthSummary = {
  id: string;
  year: number;
  month: number;
  periodStart: string;
  employmentPLN: number;
  businessRevenuePLN: number;
  burdenPLN: number;
  totalPLN: number;
  earningsCount: number;
  sourcePLN: number;
};

export type EarningsTotals = {
  totalPLN: number;
  averagePLN: number;
  averageBeforeBurdensPLN: number;
  highestMonthPLN: number;
};

export type YearlyEarningsAverage = {
  year: number;
  avgResult: number;
  avgSource: number;
  totalResult: number;
  months: number;
};

export type IncomeLists = {
  earnings: EarningRow[];
  burdens: EarningBurdenRow[];
  rows: EarningsTableRow[];
  summaries: EarningsMonthSummary[];
  yearlyAverages: YearlyEarningsAverage[];
  totals: EarningsTotals;
  years: number[];
  currencies: string[];
};

export const MONTH_LABELS_SHORT = [
  "sty",
  "lut",
  "mar",
  "kwi",
  "maj",
  "cze",
  "lip",
  "sie",
  "wrz",
  "paź",
  "lis",
  "gru",
];

export const MONTH_LABELS_LONG = [
  "styczeń",
  "luty",
  "marzec",
  "kwiecień",
  "maj",
  "czerwiec",
  "lipiec",
  "sierpień",
  "wrzesień",
  "październik",
  "listopad",
  "grudzień",
];

export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  employment: "Zatrudnienie",
  business: "Działalność gospodarcza",
};

export const EMPLOYMENT_TYPE_AMOUNT_LABEL: Record<EmploymentType, string> = {
  employment: "Dochód",
  business: "Przychód",
};

export const BURDEN_CATEGORY_LABEL: Record<EarningBurdenCategory, string> = {
  incomeTax: "Podatek dochodowy",
  vat: "VAT",
  zus: "ZUS",
  accounting: "Księgowość",
};

export function periodStartIso(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1)).toISOString();
}

export function normalizeEarningsSearchText(text: string) {
  return text
    .trim()
    .toLocaleLowerCase("pl-PL")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function earningsRowSearchIndex(row: EarningsTableRow) {
  if (row.kind === "earning") {
    return normalizeEarningsSearchText(
      [
        row.source,
        row.note ?? "",
        row.currency,
        EMPLOYMENT_TYPE_LABEL[row.employmentType],
        EMPLOYMENT_TYPE_AMOUNT_LABEL[row.employmentType],
      ].join(" "),
    );
  }

  return normalizeEarningsSearchText(
    [BURDEN_CATEGORY_LABEL[row.category], row.note ?? ""].join(" "),
  );
}

export function compareEarningsTableRows(
  left: EarningsTableRow,
  right: EarningsTableRow,
) {
  const leftPeriod = left.year * 100 + left.month;
  const rightPeriod = right.year * 100 + right.month;
  if (leftPeriod !== rightPeriod) return rightPeriod - leftPeriod;

  if (left.kind === "earning" && right.kind === "earning") {
    if (left.employmentType !== right.employmentType) {
      return left.employmentType.localeCompare(right.employmentType);
    }
    return left.source.localeCompare(right.source, "pl-PL");
  }

  if (left.kind === "burden" && right.kind === "burden") {
    return left.category.localeCompare(right.category);
  }

  return left.kind === "earning" ? -1 : 1;
}

export function buildEarningsMonthSummary(
  year: number,
  month: number,
  earnings: EarningRow[],
  burdens: EarningBurdenRow[],
): EarningsMonthSummary {
  const monthEarnings = earnings.filter((item) => item.year === year && item.month === month);
  const employmentPLN = monthEarnings
    .filter((item) => item.employmentType === "employment")
    .reduce((sum, item) => sum + item.plnAmount, 0);
  const businessRevenuePLN = monthEarnings
    .filter((item) => item.employmentType === "business")
    .reduce((sum, item) => sum + item.plnAmount, 0);
  const burdenPLN = burdens
    .filter((item) => item.year === year && item.month === month)
    .reduce((sum, item) => sum + item.amountPLN, 0);
  const sourcePLN = employmentPLN + businessRevenuePLN;

  return {
    id: `${year}-${month}`,
    year,
    month,
    periodStart: periodStartIso(year, month),
    employmentPLN,
    businessRevenuePLN,
    burdenPLN,
    totalPLN: sourcePLN - burdenPLN,
    earningsCount: monthEarnings.length,
    sourcePLN,
  };
}

export function buildEarningsMonthSummaries(
  earnings: EarningRow[],
  burdens: EarningBurdenRow[],
) {
  const keys = new Set<string>();
  for (const item of earnings) keys.add(`${item.year}-${item.month}`);
  for (const item of burdens) keys.add(`${item.year}-${item.month}`);

  return [...keys]
    .map((key) => {
      const [year, month] = key.split("-").map(Number);
      return buildEarningsMonthSummary(year, month, earnings, burdens);
    })
    .sort((left, right) => {
      if (left.year !== right.year) return right.year - left.year;
      return right.month - left.month;
    });
}

export function buildYearlyEarningsAverages(
  summaries: EarningsMonthSummary[],
): YearlyEarningsAverage[] {
  const grouped = new Map<number, EarningsMonthSummary[]>();
  for (const summary of summaries) {
    grouped.set(summary.year, [...(grouped.get(summary.year) ?? []), summary]);
  }

  return [...grouped.entries()]
    .map(([year, items]) => {
      const months = Math.max(items.length, 1);
      const totalResult = items.reduce((sum, item) => sum + item.totalPLN, 0);
      const totalSource = items.reduce((sum, item) => sum + item.sourcePLN, 0);
      return {
        year,
        avgResult: totalResult / months,
        avgSource: totalSource / months,
        totalResult,
        months: items.length,
      };
    })
    .sort((left, right) => right.year - left.year);
}

export function buildEarningsTotals(
  summaries: EarningsMonthSummary[],
): EarningsTotals {
  const months = summaries.length;
  const totalPLN = summaries.reduce((sum, item) => sum + item.totalPLN, 0);
  const sourcePLN = summaries.reduce((sum, item) => sum + item.sourcePLN, 0);

  return {
    totalPLN,
    averagePLN: months === 0 ? 0 : totalPLN / months,
    averageBeforeBurdensPLN: months === 0 ? 0 : sourcePLN / months,
    highestMonthPLN: Math.max(...summaries.map((item) => item.totalPLN), 0),
  };
}

export function buildIncomeListsFromRows(
  earnings: EarningRow[],
  burdens: EarningBurdenRow[],
): IncomeLists {
  const sortedEarnings = [...earnings].sort(compareEarningsTableRows);
  const sortedBurdens = [...burdens].sort(compareEarningsTableRows);
  const rows = [...sortedEarnings, ...sortedBurdens].sort(compareEarningsTableRows);
  const summaries = buildEarningsMonthSummaries(sortedEarnings, sortedBurdens);

  return {
    earnings: sortedEarnings,
    burdens: sortedBurdens,
    rows,
    summaries,
    yearlyAverages: buildYearlyEarningsAverages(summaries),
    totals: buildEarningsTotals(summaries),
    years: Array.from(new Set([...sortedEarnings, ...sortedBurdens].map((item) => item.year))).sort(
      (left, right) => right - left,
    ),
    currencies: Array.from(new Set(sortedEarnings.map((item) => item.currency))).sort(),
  };
}
