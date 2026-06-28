"use client";

import { useEffect, useRef, useState } from "react";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Decelerating ease — the number rushes in, then settles, like a counter coming
// to rest rather than crawling linearly to the target.
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Animates a number up from zero once, on mount. Honours reduced-motion by
 * jumping straight to the target. Returns the current (possibly fractional)
 * value — format it at the call site. */
export function useCountUp(target: number, durationMs = 1150) {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }

    let raf = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
      const t = Math.min(1, (now - start) / durationMs);
      setValue(target * easeOutCubic(t));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setValue(target);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}
