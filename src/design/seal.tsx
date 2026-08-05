"use client";

import { useId, type CSSProperties } from "react";

/**
 * Gilosz — sygnatura kierunku „Certyfikat".
 *
 * Rozeta jest hipotrochoidą. Liczba płatków = R/r + 1, więc dla N płatków
 * r = R/(N-1), a d MUSI być proporcjonalne do r — przy stałej absolutnej
 * krzywa robi pętle wewnętrzne i liczba płatków przestaje się zgadzać.
 * Zweryfikowane pomiarem na 18 kombinacjach.
 *
 * REGUŁA UMIEJSCOWIENIA: rozeta leży pod treścią, więc konkuruje z nią
 * o czytelność. Wolno ją kłaść wyłącznie na powierzchniach o niskiej
 * gęstości — hero z jedną wielką liczbą, pusty stan, OG-image. Nigdy pod
 * tabelą ani listą pozycji.
 */

const R = 210;

function rosettePoints(petals: number): string {
  const r = R / (petals - 1);
  const d = r * 1.1;
  const pts: string[] = [];
  for (let i = 0; i <= 1440; i++) {
    const t = (i * Math.PI) / 720;
    const x = (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
    const y = (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.join(" ");
}

export type SealProps = {
  /** Liczba płatków. Policzalna wzrokiem w zakresie 4–9. */
  petals?: number;
  /** Liczba warstw rozety. */
  layers?: number;
  /** Obrót w stopniach — stały dla danego portfela, nie zmienny w czasie. */
  phase?: number;
  size?: number | string;
  style?: CSSProperties;
  className?: string;
};

export function Seal({
  petals = 6,
  layers = 7,
  phase = 0,
  size = 320,
  style,
  className,
}: SealProps) {
  const id = useId();
  const clamped = Math.min(9, Math.max(4, Math.round(petals)));
  const points = rosettePoints(clamped);

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="-260 -260 520 520"
      width={size}
      height={size}
      className={className}
      style={{ pointerEvents: "none", ...style }}
    >
      <g
        transform={`rotate(${phase})`}
        fill="none"
        stroke="var(--guilloche)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      >
        {Array.from({ length: layers }, (_, k) => (
          <polyline
            key={`${id}-${k}`}
            points={points}
            transform={`rotate(${(k * 28) / layers}) scale(${1 - k * (0.55 / layers)})`}
          />
        ))}
      </g>
    </svg>
  );
}

/**
 * Parametry rozety wyprowadzone z portfela. Czysta funkcja — bez Reacta,
 * bez DOM, testowalna osobno.
 *
 * Faza idzie z daty założenia portfela, NIE z dzisiejszej — inaczej rysunek
 * zmieniałby się codziennie i przestałby być tożsamością.
 */
export function rosetteParams(input: {
  accounts: number;
  assetClasses: number;
  inceptionDate?: string | null;
}): { petals: number; layers: number; phase: number } {
  const petals = Math.min(9, Math.max(4, 3 + input.accounts));
  const layers = Math.min(11, Math.max(5, 3 + input.assetClasses));
  let phase = 0;
  if (input.inceptionDate) {
    const t = Date.parse(input.inceptionDate);
    if (!Number.isNaN(t)) {
      const day = Math.floor(t / 86_400_000);
      phase = ((day % 360) + 360) % 360;
    }
  }
  return { petals, layers, phase };
}
