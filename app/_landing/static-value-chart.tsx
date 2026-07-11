"use client";

import { useMemo, useState } from "react";
import type { ValuationPoint } from "@/domain/models/investor-data";

const PERIOD_OPTIONS = ["1M", "3M", "6M", "1Y", "2Y", "MAX"] as const;
const PERIOD_LABELS: Partial<Record<(typeof PERIOD_OPTIONS)[number], string>> = {
  "1Y": "1R",
  "2Y": "2L",
};
const RANGE_DAYS: Partial<Record<(typeof PERIOD_OPTIONS)[number], number>> = {
  "1M": 31,
  "3M": 92,
  "6M": 183,
  "1Y": 365,
  "2Y": 731,
};

const VALUE_COLOR = "#214A35";
const DEPOSIT_COLOR = "#8C6F30";

function compactAxis(value: number) {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("pl-PL", { maximumFractionDigits: 1 })} mln`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${Math.round(value / 1_000).toLocaleString("pl-PL")} tys.`;
  }
  return value.toLocaleString("pl-PL", { maximumFractionDigits: 0 });
}

function selectRange(
  value: ValuationPoint[],
  deposits: ValuationPoint[],
  period: (typeof PERIOD_OPTIONS)[number],
) {
  const length = Math.min(value.length, deposits.length);
  const pairs = Array.from({ length }, (_, index) => ({ value: value[index], deposits: deposits[index] }));
  const days = RANGE_DAYS[period];
  if (!days || pairs.length < 3) return pairs;

  const end = Date.parse(pairs.at(-1)!.value.date);
  const start = end - days * 24 * 60 * 60 * 1_000;
  const ranged = pairs.filter((pair) => Date.parse(pair.value.date) >= start);
  return ranged.length >= 2 ? ranged : pairs.slice(-2);
}

function downsamplePair(pairs: Array<{ value: ValuationPoint; deposits: ValuationPoint }>, maxPoints = 72) {
  if (pairs.length <= maxPoints) return pairs;

  const indexes = new Set<number>([0, pairs.length - 1]);
  const step = (pairs.length - 1) / (maxPoints - 1);
  for (let index = 1; index < maxPoints - 1; index += 1) {
    indexes.add(Math.round(index * step));
  }
  return [...indexes].sort((left, right) => left - right).map((index) => pairs[index]);
}

export function StaticValueChart({
  value,
  deposits,
}: {
  value: ValuationPoint[];
  deposits: ValuationPoint[];
}) {
  const [period, setPeriod] = useState<(typeof PERIOD_OPTIONS)[number]>("MAX");
  const sampled = useMemo(
    () => downsamplePair(selectRange(value, deposits, period)),
    [deposits, period, value],
  );
  if (sampled.length < 2) return null;

  const chartWidth = 640;
  const chartHeight = 168;
  const pl = 76;
  const pr = 16;
  const pt = 18;
  const pb = 32;
  const innerWidth = chartWidth - pl - pr;
  const innerHeight = chartHeight - pt - pb;
  const valueSeries = sampled.map((pair) => pair.value.value);
  const depositsSeries = sampled.map((pair) => pair.deposits.value);
  const all = [...valueSeries, ...depositsSeries];
  const min = Math.min(...all) * 0.985;
  const max = Math.max(...all) * 1.015;
  const range = max - min || 1;
  const y = (entry: number) => pt + innerHeight - ((entry - min) / range) * innerHeight;
  const pointString = (series: number[]) =>
    series
      .map((entry, index) => {
        const x = pl + (index / (series.length - 1)) * innerWidth;
        return `${x.toFixed(1)},${y(entry).toFixed(1)}`;
      })
      .join(" ");
  const valuePoints = pointString(valueSeries);
  const depositPoints = pointString(depositsSeries);
  const yTicks = [0, 0.33, 0.66, 1].map((factor) => min + factor * range);

  return (
    <div className="static-vvd-chart">
      <div className="static-chart-head">
        <div className="static-chart-legend">
          <span><i style={{ background: VALUE_COLOR }} />Wartość konta</span>
          <span><i style={{ background: DEPOSIT_COLOR }} />Wpłaty</span>
        </div>
        <div role="radiogroup" aria-label="Zakres wykresu wartość vs wpłaty" className="static-chart-ranges">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={option === period}
              data-chart-range={option}
              onClick={() => setPeriod(option)}
            >
              {PERIOD_LABELS[option] ?? option}
            </button>
          ))}
        </div>
      </div>
      <svg
        data-chart-range={period}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        role="img"
        aria-label="Wykres wartości konta i wpłat"
      >
        <defs>
          <linearGradient id="landing-vvd-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={VALUE_COLOR} stopOpacity="0.16" />
            <stop offset="100%" stopColor={VALUE_COLOR} stopOpacity="0" />
          </linearGradient>
        </defs>
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={pl} x2={pl + innerWidth} y1={y(tick)} y2={y(tick)} />
            <text x={pl - 10} y={y(tick) + 4} textAnchor="end">{compactAxis(tick)}</text>
          </g>
        ))}
        <path d={`M${pl},${pt + innerHeight} L${valuePoints} L${pl + innerWidth},${pt + innerHeight} Z`} />
        <polyline className="deposit-line" points={depositPoints} />
        <polyline className="value-line" points={valuePoints} />
      </svg>
    </div>
  );
}
