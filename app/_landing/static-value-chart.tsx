"use client";

import { token } from "@/design/tokens";
import { useMemo, useState } from "react";
import type { ValuationPoint } from "@/domain/models/investor-data";

const PERIOD_OPTIONS = ["1M", "3M", "6M", "1Y", "2Y", "MAX"] as const;
const PERIOD_LABELS: Partial<Record<(typeof PERIOD_OPTIONS)[number], string>> = {
  "1Y": "1R",
  "2Y": "2R",
};
const RANGE_DAYS: Partial<Record<(typeof PERIOD_OPTIONS)[number], number>> = {
  "1M": 31,
  "3M": 92,
  "6M": 183,
  "1Y": 365,
  "2Y": 731,
};

const VALUE_COLOR = "#F0A43C";      // bursztyn landingu
const DEPOSIT_COLOR = "#7F948C";    // stalowa zieleń — wpłaty schodzą w tło

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
  compact = false,
}: {
  /** Wariant do panelu w hero: niższy, bez legendy, z zakresami po prawej. */
  compact?: boolean;
  value: ValuationPoint[];
  deposits: ValuationPoint[];
}) {
  const [period, setPeriod] = useState<(typeof PERIOD_OPTIONS)[number]>("MAX");
  const sampled = useMemo(
    () => downsamplePair(selectRange(value, deposits, period)),
    [deposits, period, value],
  );
  if (sampled.length < 2) return null;

  // viewBox trzyma się szerokości renderu (~345 px), inaczej SVG skaluje się
  // w dół razem z opisami osi i 10 px zamienia się w 5 px.
  const chartWidth = 352;
  const chartHeight = 184;
  const pl = 46;
  const pr = 10;
  const pt = 14;
  const pb = 26;
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
  // Oś czasu: podziałka na granicach lat, nie na ułamkach szerokości. Wcześniej
  // znaczniki stały na 0/0.33/0.66/1 szerokości, a etykietą był rok punktu z tego
  // samego ułamka tablicy — przez co „2025" lądowało tam, gdzie akurat wypadło
  // 66% serii, i równe odstępy roczne rysowały się jako 190px i 97px.
  const xTicks = (() => {
    if (!sampled.length) return [] as Array<{ x: number; label: string }>;
    // Zakres bierzemy z serii RYSOWANEJ, nie z pełnego propa — inaczej po
    // wybraniu „1M" linia pokazuje miesiąc, a etykiety lat dalej rozciągają
    // całą historię na szerokość wykresu.
    const first = new Date(sampled[0].value.date);
    const last = new Date(sampled[sampled.length - 1].value.date);
    if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime())) return [];
    const span = last.getTime() - first.getTime();
    if (span <= 0) return [{ x: pl, label: String(first.getUTCFullYear()) }];

    const ticks = [{ x: pl, label: String(first.getUTCFullYear()) }];
    for (let year = first.getUTCFullYear() + 1; year <= last.getUTCFullYear(); year += 1) {
      const boundary = Date.UTC(year, 0, 1);
      if (boundary > last.getTime()) break;
      ticks.push({
        x: pl + ((boundary - first.getTime()) / span) * innerWidth,
        label: String(year),
      });
    }
    return ticks;
  })();

  const yTicks = (() => {
    // Okrągła podziałka: krok 1/2/5 × 10^n, żeby etykiety brzmiały jak liczby,
    // a nie jak zakres podzielony na cztery.
    const raw = (max - min) / 3;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 5, 10].map((m2) => m2 * mag).find((c) => c >= raw) ?? mag * 10;
    const first = Math.ceil(min / step) * step;
    const out: number[] = [];
    for (let v = first; v <= max; v += step) out.push(v);
    return out.length >= 2 ? out : [min, max];
  })();

  return (
    <div className={`static-vvd-chart${compact ? " is-compact" : ""}`}>
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
        key={period}
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
        {xTicks.map((tick) => (
          <text key={`x-${tick.x}`} x={tick.x} y={pt + innerHeight + 17} textAnchor="middle" className="x-axis">{tick.label}</text>
        ))}
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={pl} x2={pl + innerWidth} y1={y(tick)} y2={y(tick)} />
            <text x={pl - 9} y={y(tick) + 3.5} textAnchor="end">{compactAxis(tick)}</text>
          </g>
        ))}
        <path className="value-area" fill="url(#landing-vvd-fill)" d={`M${pl},${pt + innerHeight} L${valuePoints} L${pl + innerWidth},${pt + innerHeight} Z`} />
        <polyline className="deposit-line" pathLength="1" points={depositPoints} />
        <polyline className="value-line" pathLength="1" points={valuePoints} />
      </svg>
    </div>
  );
}
