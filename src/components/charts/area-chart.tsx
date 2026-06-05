"use client";

import { useRef, useState, useEffect } from "react";
import { COLORS, SHADOWS, TYPOGRAPHY } from "@/lib/design-tokens";
import { formatAxisValue } from "@/lib/money";

type Point = { label: string; value: number };

export function AreaChart({
  data,
  height = 220,
  color = COLORS.accent,
  dotColor = COLORS.gold,
}: {
  data: Point[];
  height?: number;
  color?: string;
  dotColor?: string;
}) {
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

  if (data.length < 2) return null;

  const vals = data.map((d) => d.value);
  const mn = Math.min(...vals) * 0.985;
  const mx = Math.max(...vals) * 1.015;
  const rng = mx - mn || 1;
  const pl = 58, pr = 16, pt = 18, pb = 36;
  const W = width - pl - pr;
  const H = height - pt - pb;

  const tx = (i: number) => pl + (i / (data.length - 1)) * W;
  const ty = (v: number) => pt + H - ((v - mn) / rng) * H;
  const pts = data.map((d, i) => `${tx(i)},${ty(d.value)}`).join(" ");
  const gradId = `ag-${color.replace(/[^a-z0-9]/gi, "")}`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => mn + f * rng);
  const xStep = Math.max(
    1,
    Math.ceil(data.length / Math.min(8, Math.max(3, Math.floor(width / 120))))
  );

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = Math.round(((x - pl) / W) * (data.length - 1));
    if (idx >= 0 && idx < data.length) setHover(idx);
  };

  const tooltipX = hover != null ? Math.min(Math.max(tx(hover) - 60, 8), width - 128) : 0;

  return (
    <div ref={wrapRef} style={{ width: "100%", position: "relative" }} onMouseLeave={() => setHover(null)}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        onMouseMove={handleMove}
        style={{ display: "block" }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y-axis grid lines + labels */}
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

        {/* Area fill */}
        <path
          d={`M${pl},${pt + H} L${pts} L${pl + W},${pt + H} Z`}
          fill={`url(#${gradId})`}
        />

        {/* Line */}
        <polyline
          points={pts}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* X-axis labels */}
        {data
          .filter((_, i) => i % xStep === 0 || i === data.length - 1)
          .map((d) => {
            const idx = data.indexOf(d);
            return (
              <text
                key={idx}
                x={tx(idx)}
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

        {/* End dot */}
        <circle
          cx={tx(data.length - 1)}
          cy={ty(vals[vals.length - 1])}
          r="4.5"
          fill={dotColor}
          stroke={COLORS.surface}
          strokeWidth="2"
        />

        {/* Hover crosshair */}
        {hover != null && (
          <g>
            <line
              x1={tx(hover)} x2={tx(hover)}
              y1={pt} y2={pt + H}
              stroke={COLORS.text} strokeWidth="0.5" strokeDasharray="3 3" opacity="0.32"
            />
            <circle
              cx={tx(hover)} cy={ty(data[hover].value)}
              r="5"
              fill={COLORS.surface}
              stroke={dotColor}
              strokeWidth="2"
            />
          </g>
        )}
      </svg>

      {/* Hover tooltip */}
      {hover != null && (
        <div
          style={{
            position: "absolute",
            left: tooltipX,
            top: 8,
            background: COLORS.surface,
            color: COLORS.text,
            padding: "6px 10px",
            borderRadius: 8,
            fontSize: 11,
            pointerEvents: "none",
            border: `0.5px solid ${COLORS.border}`,
            boxShadow: SHADOWS.tooltip,
            minWidth: 110,
          }}
        >
          <div style={{ color: COLORS.textMuted, fontSize: 10, letterSpacing: ".04em" }}>
            {data[hover].label}
          </div>
          <div style={{ fontWeight: 700 }}>
            {data[hover].value.toLocaleString("pl-PL", { maximumFractionDigits: 0 })} PLN
          </div>
        </div>
      )}
    </div>
  );
}
