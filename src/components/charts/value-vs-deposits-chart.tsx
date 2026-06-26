"use client";

import { useEffect, useRef, useState } from "react";
import { COLORS, SHADOWS, TYPOGRAPHY } from "@/lib/design-tokens";
import { formatAxisValue } from "@/lib/money";
import type { ValuationPoint } from "@/domain/models/investor-data";

const VALUE_COLOR = COLORS.accent;
const DEPOSIT_COLOR = COLORS.bonds;

const PERIOD_OPTIONS = ["1M", "3M", "6M", "1Y", "2Y", "MAX"] as const;
type Period = (typeof PERIOD_OPTIONS)[number];
const PERIOD_MONTHS: Record<Period, number> = { "1M": 1, "3M": 3, "6M": 6, "1Y": 12, "2Y": 24, MAX: 0 };

// Crops to the selected horizon using the latest date across both series as the
// anchor, so value[i] and deposits[i] stay index-aligned after filtering.
// Both series come from the same snapshot builder and share a date grid, so
// cropping each by the same cutoff keeps them index-aligned; n = Math.min(...)
// below clamps defensively in case lengths ever diverge.
function cropByPeriod(value: ValuationPoint[], deposits: ValuationPoint[], period: Period) {
  if (period === "MAX") return { value, deposits };
  const lastDate = [value.at(-1)?.date, deposits.at(-1)?.date].filter(Boolean).sort().at(-1);
  if (!lastDate) return { value, deposits };
  const cutoff = new Date(lastDate);
  cutoff.setMonth(cutoff.getMonth() - PERIOD_MONTHS[period]);
  const crop = (series: ValuationPoint[]) => {
    if (series.length <= 2) return series;
    const filtered = series.filter((p) => new Date(p.date).getTime() >= cutoff.getTime());
    return filtered.length >= 2 ? filtered : series.slice(-2);
  };
  return { value: crop(value), deposits: crop(deposits) };
}

/** Overlays portfolio value against cumulative contributions. The gap between
 * the two lines is the cumulative gain/loss — the headline parity chart ported
 * from the macOS/iOS app ("Wartość konta vs wpłaty"). */
export function ValueVsDepositsChart({
  value: valueProp,
  deposits: depositsProp,
  height = 220,
  currency = "PLN",
  showPeriodControl = true,
  periodLabels,
}: {
  value: ValuationPoint[];
  deposits: ValuationPoint[];
  height?: number;
  currency?: string;
  showPeriodControl?: boolean;
  periodLabels?: Partial<Record<Period, string>>;
}) {
  const [period, setPeriod] = useState<Period>("MAX");
  const { value, deposits } = cropByPeriod(valueProp, depositsProp, period);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(Math.max(280, e.contentRect.width));
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const n = Math.min(value.length, deposits.length);
  if (n < 2) return null;

  const valueVals = value.slice(0, n).map((d) => d.value);
  const depositVals = deposits.slice(0, n).map((d) => d.value);
  const all = [...valueVals, ...depositVals];
  const mn = Math.min(...all) * 0.985;
  const mx = Math.max(...all) * 1.015;
  const rng = mx - mn || 1;
  const pl = 58, pr = 16, pt = 18, pb = 36;
  const W = width - pl - pr;
  const H = height - pt - pb;

  const tx = (i: number) => pl + (i / (n - 1)) * W;
  const ty = (v: number) => pt + H - ((v - mn) / rng) * H;
  const valuePts = valueVals.map((v, i) => `${tx(i)},${ty(v)}`).join(" ");
  const depositPts = depositVals.map((v, i) => `${tx(i)},${ty(v)}`).join(" ");

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => mn + f * rng);
  const xStep = Math.max(
    1,
    Math.ceil(n / Math.min(8, Math.max(3, Math.floor(width / 120)))),
  );

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = Math.round(((x - pl) / W) * (n - 1));
    if (idx >= 0 && idx < n) setHover(idx);
  };

  const fmt = (v: number) => v.toLocaleString("pl-PL", { maximumFractionDigits: 0 });
  const tooltipX = hover != null ? Math.min(Math.max(tx(hover) - 70, 8), width - 156) : 0;
  const gain = hover != null ? valueVals[hover] - depositVals[hover] : 0;

  return (
    <div ref={wrapRef} style={{ width: "100%", position: "relative" }} onMouseLeave={() => setHover(null)}>
      <div style={{ display: "flex", gap: 16, marginBottom: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Legend color={VALUE_COLOR} label="Wartość konta" />
          <Legend color={DEPOSIT_COLOR} label="Wpłaty (skumulowane)" dashed />
        </div>
        {showPeriodControl && (
          <div role="radiogroup" aria-label="Zakres wykresu wartość vs wpłaty" style={{ display: "inline-flex", background: "rgba(22,29,24,0.06)", borderRadius: 10, padding: 3 }}>
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={period === option}
                onClick={() => setPeriod(option)}
                style={{
                  padding: "4px 9px",
                  borderRadius: 7,
                  border: "none",
                  cursor: "pointer",
                  fontFamily: TYPOGRAPHY.system,
                  fontSize: 11,
                  fontWeight: period === option ? 700 : 500,
                  background: period === option ? COLORS.surface : "transparent",
                  color: period === option ? COLORS.text : COLORS.muted,
                }}
              >
                {periodLabels?.[option] ?? option}
              </button>
            ))}
          </div>
        )}
      </div>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        onMouseMove={handleMove}
        style={{ display: "block" }}
      >
        <defs>
          <linearGradient id="vvd-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={VALUE_COLOR} stopOpacity="0.16" />
            <stop offset="100%" stopColor={VALUE_COLOR} stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((v, i) => (
          <g key={i}>
            <line
              x1={pl} x2={pl + W}
              y1={ty(v)} y2={ty(v)}
              stroke={COLORS.lineSoft} strokeWidth="1" strokeDasharray="3 4"
            />
            <text
              x={pl - 8} y={ty(v) + 4}
              textAnchor="end" fontSize="10.5"
              fill={COLORS.subtle}
              fontFamily={TYPOGRAPHY.mono}
            >
              {formatAxisValue(v, rng)}
            </text>
          </g>
        ))}

        {/* Value area + line */}
        <path d={`M${pl},${pt + H} L${valuePts} L${pl + W},${pt + H} Z`} fill="url(#vvd-fill)" />
        <polyline points={valuePts} fill="none" stroke={VALUE_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Deposits line (dashed) */}
        <polyline points={depositPts} fill="none" stroke={DEPOSIT_COLOR} strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" />

        {value
          .slice(0, n)
          .filter((_, i) => i % xStep === 0 || i === n - 1)
          .map((d, _, arr) => {
            const idx = value.indexOf(d);
            const safeIdx = idx >= 0 && idx < n ? idx : arr.length - 1;
            return (
              <text
                key={d.date}
                x={tx(safeIdx)}
                y={pt + H + 22}
                textAnchor="middle"
                fontSize="10.5"
                fill={COLORS.subtle}
                fontFamily={TYPOGRAPHY.system}
              >
                {d.label}
              </text>
            );
          })}

        {hover != null && (
          <g>
            <line x1={tx(hover)} x2={tx(hover)} y1={pt} y2={pt + H} stroke={COLORS.text} strokeWidth="0.5" strokeDasharray="3 3" opacity="0.32" />
            <circle cx={tx(hover)} cy={ty(valueVals[hover])} r="4.5" fill={COLORS.surface} stroke={VALUE_COLOR} strokeWidth="2" />
            <circle cx={tx(hover)} cy={ty(depositVals[hover])} r="4.5" fill={COLORS.surface} stroke={DEPOSIT_COLOR} strokeWidth="2" />
          </g>
        )}
      </svg>

      {hover != null && (
        <div
          style={{
            position: "absolute",
            left: tooltipX,
            top: 28,
            background: COLORS.surface,
            color: COLORS.text,
            padding: "7px 11px",
            borderRadius: 8,
            fontSize: 11,
            pointerEvents: "none",
            border: `0.5px solid ${COLORS.border}`,
            boxShadow: SHADOWS.tooltip,
            minWidth: 138,
          }}
        >
          <div style={{ color: COLORS.textMuted, fontSize: 10, letterSpacing: ".04em", marginBottom: 2 }}>
            {value[hover].label}
          </div>
          <Row color={VALUE_COLOR} label="Wartość" value={`${fmt(valueVals[hover])} ${currency}`} />
          <Row color={DEPOSIT_COLOR} label="Wpłaty" value={`${fmt(depositVals[hover])} ${currency}`} />
          <div style={{ marginTop: 3, paddingTop: 3, borderTop: `0.5px solid ${COLORS.border}`, fontWeight: 700, color: gain >= 0 ? COLORS.profit : COLORS.loss }}>
            {gain >= 0 ? "+" : ""}{fmt(gain)} {currency}
          </div>
        </div>
      )}
    </div>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: TYPOGRAPHY.system, fontSize: 11.5, color: COLORS.muted }}>
      <span
        style={{
          width: 16,
          height: 0,
          borderTop: `2px ${dashed ? "dashed" : "solid"} ${color}`,
          display: "inline-block",
        }}
      />
      {label}
    </span>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: COLORS.textMuted }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
        {label}
      </span>
      <span style={{ fontFamily: TYPOGRAPHY.mono, fontWeight: 600 }}>{value}</span>
    </div>
  );
}
