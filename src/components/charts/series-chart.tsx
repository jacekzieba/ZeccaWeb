"use client";

import { useEffect, useRef, useState } from "react";
import { COLORS, TYPOGRAPHY } from "@/lib/design-tokens";
import { formatAxisValue } from "@/lib/money";

const MIN_CHART_WIDTH = 240;
const PAD = { left: 58, right: 16, top: 14, bottom: 30 };

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(MIN_CHART_WIDTH);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(Math.max(MIN_CHART_WIDTH, e.contentRect.width));
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

function niceRange(values: number[], includeZero: boolean) {
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (includeZero) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.06;
  return { lo: includeZero && lo === 0 ? 0 : lo - pad, hi: includeZero && hi === 0 ? 0 : hi + pad };
}

export type ChartSeries = {
  label: string;
  color: string;
  dashed?: boolean;
  points: { label: string; value: number }[];
};

/** Multi-series line chart; handles negative values and draws a zero baseline. */
export function SeriesLineChart({
  series,
  height = 200,
  format,
  ariaLabel,
}: {
  series: ChartSeries[];
  height?: number;
  format: (value: number) => string;
  ariaLabel: string;
}) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const n = Math.max(0, ...series.map((s) => s.points.length));
  if (n < 2) return null;

  const all = series.flatMap((s) => s.points.map((p) => p.value));
  const { lo, hi } = niceRange(all, true);
  const W = width - PAD.left - PAD.right;
  const H = height - PAD.top - PAD.bottom;
  const tx = (i: number, len: number) => PAD.left + (i / Math.max(1, len - 1)) * W;
  const ty = (v: number) => PAD.top + H - ((v - lo) / (hi - lo)) * H;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => lo + f * (hi - lo));
  const first = series[0].points;
  const hoverIdx = hover != null ? Math.min(hover, first.length - 1) : null;

  return (
    <div ref={ref} style={{ width: "100%", minWidth: 0, position: "relative" }} onMouseLeave={() => setHover(null)}>
      <svg
        role="img"
        aria-label={ariaLabel}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: "block", maxWidth: "100%" }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const idx = Math.round(((e.clientX - rect.left - PAD.left) / W) * (first.length - 1));
          if (idx >= 0 && idx < first.length) setHover(idx);
        }}
      >
        {ticks.map((v, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={PAD.left + W} y1={ty(v)} y2={ty(v)} stroke={COLORS.lineSoft} strokeWidth="1" strokeDasharray="3 4" />
            <text x={PAD.left - 8} y={ty(v) + 4} textAnchor="end" fontSize="11" fill={COLORS.subtle} fontFamily={TYPOGRAPHY.mono}>
              {formatAxisValue(v, hi - lo)}
            </text>
          </g>
        ))}
        <line x1={PAD.left} x2={PAD.left + W} y1={ty(0)} y2={ty(0)} stroke={COLORS.textMuted} strokeWidth="1" opacity="0.5" />
        {series.map((s) => (
          <polyline
            key={s.label}
            points={s.points.map((p, i) => `${tx(i, s.points.length)},${ty(p.value)}`).join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={s.dashed ? "5 4" : undefined}
          />
        ))}
        {first
          .map((p, i) => ({ p, i }))
          .filter(({ i }) => i % Math.max(1, Math.ceil(first.length / 6)) === 0)
          .map(({ p, i }) => (
            <text key={i} x={tx(i, first.length)} y={height - 10} textAnchor="middle" fontSize="11" fill={COLORS.subtle} fontFamily={TYPOGRAPHY.mono}>
              {p.label}
            </text>
          ))}
        {hoverIdx != null && (
          <line x1={tx(hoverIdx, first.length)} x2={tx(hoverIdx, first.length)} y1={PAD.top} y2={PAD.top + H} stroke={COLORS.textMuted} strokeWidth="1" opacity="0.4" />
        )}
      </svg>
      {hoverIdx != null && (
        <div
          style={{
            position: "absolute",
            top: 4,
            left: Math.min(Math.max(tx(hoverIdx, first.length) - 70, 8), width - 160),
            background: COLORS.surface,
            border: `0.5px solid ${COLORS.border}`,
            borderRadius: "var(--r-md)",
            padding: "6px 9px",
            fontFamily: TYPOGRAPHY.mono,
            fontSize: 11,
            color: COLORS.text,
            pointerEvents: "none",
          }}
        >
          <div style={{ color: COLORS.subtle }}>{first[hoverIdx].label}</div>
          {series.map((s) => {
            const point = s.points[Math.min(hoverIdx, s.points.length - 1)];
            return (
              <div key={s.label} style={{ color: s.color }}>
                {s.label}: {format(point.value)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Per-period bar chart; values below zero hang under the baseline in `negativeColor`. */
export function BarSeriesChart({
  data,
  color,
  negativeColor = color,
  height = 180,
  format,
  ariaLabel,
}: {
  data: { label: string; value: number }[];
  color: string;
  negativeColor?: string;
  height?: number;
  format: (value: number) => string;
  ariaLabel: string;
}) {
  const { ref, width } = useWidth();
  if (data.length === 0) return null;
  const { lo, hi } = niceRange(data.map((d) => d.value), true);
  const W = width - PAD.left - PAD.right;
  const H = height - PAD.top - PAD.bottom;
  const slot = W / data.length;
  const barW = Math.max(3, Math.min(32, slot * 0.64));
  const ty = (v: number) => PAD.top + H - ((v - lo) / (hi - lo)) * H;
  const ticks = [0, 0.5, 1].map((f) => lo + f * (hi - lo));

  return (
    <div ref={ref} style={{ width: "100%", minWidth: 0 }}>
      <svg role="img" aria-label={ariaLabel} width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", maxWidth: "100%" }}>
        {ticks.map((v, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={PAD.left + W} y1={ty(v)} y2={ty(v)} stroke={COLORS.lineSoft} strokeWidth="1" strokeDasharray="3 4" />
            <text x={PAD.left - 8} y={ty(v) + 4} textAnchor="end" fontSize="11" fill={COLORS.subtle} fontFamily={TYPOGRAPHY.mono}>
              {formatAxisValue(v, hi - lo)}
            </text>
          </g>
        ))}
        <line x1={PAD.left} x2={PAD.left + W} y1={ty(0)} y2={ty(0)} stroke={COLORS.textMuted} strokeWidth="1" opacity="0.5" />
        {data.map((d, i) => {
          const x = PAD.left + slot * i + (slot - barW) / 2;
          const top = ty(Math.max(d.value, 0));
          const bottom = ty(Math.min(d.value, 0));
          return (
            <g key={`${d.label}-${i}`}>
              <rect
                x={x}
                y={top}
                width={barW}
                height={Math.max(bottom - top, d.value !== 0 ? 1 : 0)}
                rx={2}
                fill={d.value < 0 ? negativeColor : color}
              >
                <title>{`${d.label}: ${format(d.value)}`}</title>
              </rect>
              {data.length === 1 && (
                <text x={x + barW / 2} y={(d.value < 0 ? bottom + 14 : top - 6)} textAnchor="middle" fontSize="11" fill={COLORS.text} fontFamily={TYPOGRAPHY.mono}>
                  {format(d.value)}
                </text>
              )}
              {(data.length <= 12 || i % Math.ceil(data.length / 12) === 0) && (
                <text x={x + barW / 2} y={height - 10} textAnchor="middle" fontSize="11" fill={COLORS.subtle} fontFamily={TYPOGRAPHY.mono}>
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export type ShareSegment = { label: string; color: string; percent: number };

/** One 100% stacked column per period; `segments` of a column sum to ~100. */
export function StackedShareChart({
  data,
  height = 200,
  ariaLabel,
}: {
  data: { label: string; segments: ShareSegment[] }[];
  height?: number;
  ariaLabel: string;
}) {
  const { ref, width } = useWidth();
  if (data.length === 0) return null;
  const W = width - PAD.left - PAD.right;
  const H = height - PAD.top - PAD.bottom;
  const slot = W / data.length;
  const barW = Math.max(4, Math.min(36, slot * 0.72));
  const ty = (pct: number) => PAD.top + H - (pct / 100) * H;

  return (
    <div ref={ref} style={{ width: "100%", minWidth: 0 }}>
      <svg role="img" aria-label={ariaLabel} width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", maxWidth: "100%" }}>
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={PAD.left + W} y1={ty(v)} y2={ty(v)} stroke={COLORS.lineSoft} strokeWidth="1" strokeDasharray="3 4" />
            <text x={PAD.left - 8} y={ty(v) + 4} textAnchor="end" fontSize="11" fill={COLORS.subtle} fontFamily={TYPOGRAPHY.mono}>
              {v}%
            </text>
          </g>
        ))}
        {data.map((column, i) => {
          const x = PAD.left + slot * i + (slot - barW) / 2;
          let acc = 0;
          return (
            <g key={`${column.label}-${i}`}>
              {column.segments.map((segment) => {
                const y = ty(acc + segment.percent);
                const h = ty(acc) - y;
                acc += segment.percent;
                return (
                  <rect key={segment.label} x={x} y={y} width={barW} height={Math.max(h, 0)} fill={segment.color}>
                    <title>{`${column.label} · ${segment.label}: ${segment.percent.toFixed(1)}%`}</title>
                  </rect>
                );
              })}
              {(data.length <= 12 || i % Math.ceil(data.length / 12) === 0) && (
                <text x={x + barW / 2} y={height - 10} textAnchor="middle" fontSize="11" fill={COLORS.subtle} fontFamily={TYPOGRAPHY.mono}>
                  {column.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
