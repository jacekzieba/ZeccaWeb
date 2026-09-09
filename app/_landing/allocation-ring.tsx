"use client";

import { useState } from "react";

type Slice = { label: string; percent: number };

// Ciepła podziałka od bursztynu do miedzi, zamknięta chłodnym tonem szyny.
// Sama tonalna szyna była zbyt monochromatyczna — pierścień przestawał być
// wykresem, a stawał się szarą obwódką. Trzy pełne barwy (bursztyn, zieleń,
// łupek) z kolei dokładały do palety trzy wartości chromatyczne i kłóciły się
// znaczeniem z zielenią wzrostu. To jest środek: dwie barwy, trzy wyraźnie
// rozsunięte jasności, zero zieleni w roli kategorii.
const COLORS = [
  { fill: "#F0A43C", text: "#F0A43C" },
  { fill: "#B9723A", text: "#D08F58" },
  { fill: "rgba(198, 232, 222, 0.46)", text: "var(--ink-2)" },
];

const R = 112;
const SW = 34;
/* Przerwa między wycinkami mierzona po obwodzie. Przy 5 jednostkach na obwodzie
   ~704 wychodziło 2,5 stopnia — kreska cieńsza niż grubość samego pierścienia,
   więc segmenty czytały się jak jeden łuk w trzech kolorach. */
const GAP = 20;
const C = 2 * Math.PI * R;

/** Pierścień alokacji. Najechanie na segment albo wiersz legendy podświetla
    jedno i to samo — środek pokazuje wtedy, na co patrzysz. */
/* Polska liczba mnoga: 1 klasa, 2–4 klasy, 5+ oraz 12–14 klas. */
function klasy(n: number) {
  const ostatnia = n % 10;
  const dwieOstatnie = n % 100;
  if (n === 1) return "klasa aktywów";
  if (ostatnia >= 2 && ostatnia <= 4 && (dwieOstatnie < 12 || dwieOstatnie > 14)) return "klasy aktywów";
  return "klas aktywów";
}
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
            <>
              {/* Środek pierścienia mówi o pierścieniu, nie o portfelu. Wcześniej
                  stała tu wartość portfela — ta sama liczba, co w hero, w rejestrze
                  i w karcie portfeli, czyli czwarty jej wydruk na jednej stronie. */}
              <text y="-1" textAnchor="middle" className="alloc-center-value">{slices.length}</text>
              <text y="24" textAnchor="middle" className="alloc-center-label">{klasy(slices.length)}</text>
            </>
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
