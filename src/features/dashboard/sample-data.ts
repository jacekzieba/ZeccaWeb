import type { InvestorDataSnapshot } from "@/domain/models/investor-data";

// 24 months of history for the period selector
export const SAMPLE_HISTORY = (() => {
  const anchors = [
    312_000, 315_800, 319_200, 317_500, 321_000, 324_400, 327_800,
    325_100, 330_000, 334_500, 340_200, 345_600, 352_000, 358_900,
    365_400, 371_000, 379_500, 384_200, 391_700, 398_500, 414_900,
    421_300, 425_600, 428_940,
  ];
  return anchors.map((v, i) => {
    const d = new Date(2026, 4, 15);
    d.setMonth(d.getMonth() - (23 - i));
    return {
      value: v,
      date: d.toISOString(),
      label: d.toLocaleString("pl-PL", { month: "short", year: "2-digit" }),
    };
  });
})();

export const sampleSnapshot: InvestorDataSnapshot = {
  asOf: "2026-05-15T10:00:00.000Z",
  totalValue: 428_940,
  monthlyChange: 3.38,
  cash: 2,
  income: {
    earningCount: 0,
    burdenCount: 0,
    earningsPLN: 0,
    burdensPLN: 0,
    netPLN: 0,
  },
  portfolios: [
    {
      id: "ike",
      name: "IKE",
      baseCurrency: "PLN",
      value: 31_200,
      dailyChange: 0.7,
      positions: 3,
    },
    {
      id: "bond",
      name: "Obligacje",
      baseCurrency: "PLN",
      value: 18_760,
      dailyChange: 0.1,
      positions: 2,
    },
  ],
  valuationSeries: SAMPLE_HISTORY,
  allocation: [
    { label: "Akcje zagraniczne", percent: 61.47 },
    { label: "Obligacje skarbowe PL", percent: 38.53 },
  ],
};
