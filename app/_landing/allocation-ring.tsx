"use client";

import { useState } from "react";

type Slice = { label: string; percent: number };

const COLORS = [
  { fill: "#F0A43C", text: "#F0A43C" },
  { fill: "#6E9C92", text: "#8FC0B6" },
  { fill: "#2A3D4E", text: "#8FA6BA" },
];

const R = 112;
const SW = 26;
const GAP = 5;
const C = 2 * Math.PI * R;

/** Pierścień alokacji. Najechanie na segment albo wiersz legendy podświetla
    jedno i to samo — środek pokazuje wtedy, na co patrzysz. */
export function AllocationRing({ slices }: { slices: Slice[] }) {
  const [active, setActive] = useState<number | null>(null);

  let acc = 0;
  const arcs = slices.slice(0, 3).map((slice, index) => {
    const len = (slice.percent / 100) * C;
    const arc = { ...slice, ...COLORS[index], dash: Math.max(0, len - GAP), offset: -acc, index };
    acc += len;
    return arc;
  });

  const fmt = (n: number) => n.toFixed(1).replace(".", ",");
  const shown = active === null ? null : arcs[active];

  const ring = (radius: number, width: number, baseOpacity: number) =>
    arcs.map((arc) => (
      <circle
        key={`${radius}-${arc.label}`}
        r={radius}
        fill="none"
        stroke={arc.fill}
        strokeWidth={width}
        opacity={active === null || active === arc.index ? baseOpacity : baseOpacity * 0.32}
        strokeDasharray={`${(arc.dash * radius / R).toFixed(1)} ${(C * radius / R).toFixed(1)}`}
        strokeDashoffset={(arc.offset * radius / R).toFixed(1)}
        transform="rotate(-90)"
        style={{ transition: "opacity .18s ease" }}
      />
    ));

  return (
    <div className="alloc-ring">
      <svg viewBox="0 0 284 284" role="img" aria-label="Skład portfela demonstracyjnego">
        <g transform="translate(142,142)">
          <circle r={R} fill="none" stroke="rgba(198,232,222,.055)" strokeWidth={SW} />
          {ring(R, SW, 0.42)}
          {ring(R + SW / 2 - 0.75, 1.5, 0.85)}
          {ring(R - SW / 2 + 0.75, 1, 0.45)}
          {arcs.map((arc) => (
            <circle
              key={`hit-${arc.label}`}
              r={R}
              fill="none"
              stroke="transparent"
              strokeWidth={SW + 8}
              strokeDasharray={`${arc.dash.toFixed(1)} ${C.toFixed(1)}`}
              strokeDashoffset={arc.offset.toFixed(1)}
              transform="rotate(-90)"
              style={{ cursor: "pointer", pointerEvents: "stroke" }}
              onMouseEnter={() => setActive(arc.index)}
              onMouseLeave={() => setActive(null)}
            />
          ))}
          {shown ? (
            <>
              <text y="-2" textAnchor="middle" className="alloc-center-value" fill={shown.text}>{fmt(shown.percent)}%</text>
              <text y="20" textAnchor="middle" className="alloc-center-label">{shown.label}</text>
            </>
          ) : (
            <text y="6" textAnchor="middle" className="alloc-center-label">portfel demo</text>
          )}
        </g>
      </svg>

      <ul className="alloc-legend">
        {arcs.map((arc) => (
          <li
            key={arc.label}
            className={active === arc.index ? "is-active" : active === null ? "" : "is-dim"}
            onMouseEnter={() => setActive(arc.index)}
            onMouseLeave={() => setActive(null)}
          >
            <span className="alloc-swatch" style={{ background: arc.fill, boxShadow: `inset 0 0 0 1px ${arc.text}` }} />
            <span className="alloc-name">{arc.label}</span>
            <span className="num" style={{ color: arc.text }}>{fmt(arc.percent)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
