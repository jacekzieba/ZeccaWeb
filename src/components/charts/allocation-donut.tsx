"use client";

import { useState } from "react";
import { COLORS, TYPOGRAPHY } from "@/lib/design-tokens";

type Slice = { label: string; percent: number };

const PALETTE = [
  COLORS.equity,
  COLORS.crypto,
  COLORS.cash,
  COLORS.bonds,
  COLORS.profit,
  COLORS.other,
  COLORS.plum,
  COLORS.green,
];

/** Truncate a label so it fits inside the donut hole. */
function clampLabel(label: string, max = 16) {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

export function AllocationDonut({ slices }: { slices: Slice[] }) {
  // The slice currently hovered (segment or legend row). `null` → default summary.
  const [active, setActive] = useState<number | null>(null);

  if (!slices || slices.length === 0) return null;

  const SIZE = 168;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const THICK = 24;
  const r = (SIZE - THICK) / 2;
  const circ = 2 * Math.PI * r;
  const total = slices.reduce((s, g) => s + g.percent, 0) || 100;

  const activeSlice = active != null ? slices[active] : null;

  let offset = 0;

  return (
    <div data-testid="allocation-donut">
      <div style={{ display: "flex", justifyContent: "center", padding: "6px 0 14px" }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {slices.map((slice, i) => {
            const frac = slice.percent / total;
            const dash = frac * circ - 3;
            const sp = circ - dash;
            const rot = (offset / total) * 360 - 90;
            offset += slice.percent;
            const color = PALETTE[i % PALETTE.length];
            const isActive = active === i;
            const dimmed = active != null && !isActive;
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={color}
                strokeWidth={isActive ? THICK + 4 : THICK}
                strokeDasharray={`${Math.max(0, dash)} ${sp}`}
                strokeLinecap="butt"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive((prev) => (prev === i ? null : prev))}
                style={{
                  transform: `rotate(${rot}deg)`,
                  transformOrigin: `${cx}px ${cy}px`,
                  opacity: dimmed ? 0.35 : 1,
                  cursor: "pointer",
                  transition: "opacity 0.2s ease, stroke-width 0.2s ease",
                }}
              />
            );
          })}

          {/* Default summary — fades out when a slice is active */}
          <g
            style={{
              opacity: activeSlice ? 0 : 1,
              transition: "opacity 0.22s ease",
              pointerEvents: "none",
            }}
          >
            <text x={cx} y={cy - 6} textAnchor="middle" fontSize="10" fill={COLORS.subtle} fontWeight="600" letterSpacing="0.06em" fontFamily={TYPOGRAPHY.system}>
              ALOKACJA
            </text>
            <text x={cx} y={cy + 12} textAnchor="middle" fontSize="18" fill={COLORS.text} fontWeight="700" fontFamily={TYPOGRAPHY.system}>
              {slices.length}
            </text>
            <text x={cx} y={cy + 26} textAnchor="middle" fontSize="9.5" fill={COLORS.subtle} fontFamily={TYPOGRAPHY.system}>
              klas
            </text>
          </g>

          {/* Active slice — share % + name, fades in on hover/selection */}
          <g
            style={{
              opacity: activeSlice ? 1 : 0,
              transition: "opacity 0.22s ease",
              pointerEvents: "none",
            }}
          >
            <text data-testid="allocation-donut-active-percent" x={cx} y={cy - 2} textAnchor="middle" fontSize="22" fill={COLORS.text} fontWeight="700" style={{ fontVariantNumeric: "tabular-nums" }} fontFamily={TYPOGRAPHY.system}>
              {activeSlice ? `${activeSlice.percent.toFixed(1)}%` : ""}
            </text>
            <text data-testid="allocation-donut-active-label" x={cx} y={cy + 18} textAnchor="middle" fontSize="11" fill={COLORS.subtle} fontWeight="600" fontFamily={TYPOGRAPHY.system}>
              {activeSlice ? clampLabel(activeSlice.label) : ""}
            </text>
          </g>
        </svg>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {slices.map((slice, i) => {
          const color = PALETTE[i % PALETTE.length];
          const isActive = active === i;
          return (
          <button
            key={i}
            data-testid="allocation-donut-legend"
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive((prev) => (prev === i ? null : prev))}
            onFocus={() => setActive(i)}
            onBlur={() => setActive((prev) => (prev === i ? null : prev))}
            style={{
              width: "100%",
              border: "none",
              padding: 0,
              background: "transparent",
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "default",
              textAlign: "left",
              opacity: active != null && !isActive ? 0.5 : 1,
              transition: "opacity 0.2s ease",
            }}
            >
              <div
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 2,
                  background: color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  flex: 1,
                  fontSize: 12.5,
                  color: COLORS.text,
                  fontWeight: isActive ? 600 : 400,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {slice.label}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: COLORS.text,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {slice.percent.toFixed(1)}%
              </span>
          </button>
          );
        })}
      </div>
    </div>
  );
}
