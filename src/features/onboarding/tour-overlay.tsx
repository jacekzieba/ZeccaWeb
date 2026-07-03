"use client";

import { useCallback, useEffect, useState } from "react";
import { V2, V2_TYPE } from "@/lib/v2-design";
import { nextPresentStep, type TourStep } from "./steps";

const DIM = "rgba(20,26,21,.52)";
const ANCHOR_TIMEOUT_MS = 2000;
const ANCHOR_POLL_MS = 50;
const SPOT_PAD = 6;
const TIP_W = 320;

function anchorEl(anchor: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tour="${anchor}"]`);
}

type Rect = { top: number; left: number; width: number; height: number };

/**
 * Spotlight coach-mark layer. Waits for the current step's `[data-tour]`
 * anchor (the controller navigates between routes), highlights it with a
 * dim cut-out and renders the step card next to it. Steps whose anchor never
 * mounts are skipped after a short timeout so the tour can never get stuck.
 */
export function TourOverlay({
  steps,
  stepIndex,
  onStepChange,
  onFinish,
  onSkip,
}: {
  steps: TourStep[];
  stepIndex: number;
  onStepChange: (next: number) => void;
  onFinish: () => void;
  onSkip: () => void;
}) {
  const step = steps[stepIndex];
  const [rect, setRect] = useState<Rect | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    setIsMobile(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const goTo = useCallback(
    (dir: 1 | -1) => {
      const next = stepIndex + dir;
      if (next < 0) return;
      if (next >= steps.length) {
        onFinish();
        return;
      }
      // Anchors on other routes don't exist yet — the controller navigates
      // and the waiting effect below picks the step up (or skips it).
      onStepChange(next);
    },
    [stepIndex, steps.length, onFinish, onStepChange],
  );

  // Wait for the anchor, measure it, keep the measurement fresh.
  useEffect(() => {
    if (!step) return;
    setRect(null);
    let cancelled = false;
    let timer = 0;
    let waited = 0;
    let unsubscribe: (() => void) | null = null;

    const measure = () => {
      const el = anchorEl(step.anchor);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    const tick = () => {
      if (cancelled) return;
      const el = anchorEl(step.anchor);
      if (el) {
        el.scrollIntoView({ block: "center" });
        measure();
        window.addEventListener("scroll", measure, { passive: true, capture: true });
        window.addEventListener("resize", measure);
        unsubscribe = () => {
          window.removeEventListener("scroll", measure, { capture: true });
          window.removeEventListener("resize", measure);
        };
        return;
      }
      waited += ANCHOR_POLL_MS;
      if (waited >= ANCHOR_TIMEOUT_MS) {
        // Anchor never appeared (hidden section, changed UI) → skip forward.
        // Steps on other routes count as present: the controller navigates
        // there first and this effect re-checks after the route change.
        const next = nextPresentStep(steps, stepIndex, 1, (a) => {
          const candidate = steps.find((s) => s.anchor === a);
          if (candidate && candidate.route !== window.location.pathname) return true;
          return anchorEl(a) != null;
        });
        if (next === -1) onFinish();
        else onStepChange(next);
        return;
      }
      timer = window.setTimeout(tick, ANCHOR_POLL_MS);
    };

    tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      unsubscribe?.();
    };
  }, [step, stepIndex, steps, onFinish, onStepChange]);

  // Keyboard navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onSkip();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        goTo(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goTo(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, onSkip]);

  if (!step) return null;

  const isLast = stepIndex === steps.length - 1;
  const spot = rect
    ? {
        top: rect.top - SPOT_PAD,
        left: rect.left - SPOT_PAD,
        width: rect.width + SPOT_PAD * 2,
        height: rect.height + SPOT_PAD * 2,
      }
    : null;

  let tipStyle: React.CSSProperties;
  if (isMobile || !spot) {
    tipStyle = { position: "fixed", left: 12, right: 12, bottom: 12 };
  } else if (step.placement === "right") {
    tipStyle = {
      position: "fixed",
      left: Math.min(spot.left + spot.width + 14, window.innerWidth - TIP_W - 12),
      top: Math.max(12, Math.min(spot.top, window.innerHeight - 280)),
      width: TIP_W,
    };
  } else {
    tipStyle = {
      position: "fixed",
      left: Math.max(12, Math.min(spot.left + 20, window.innerWidth - TIP_W - 12)),
      top: Math.min(spot.top + spot.height + 14, window.innerHeight - 260),
      width: TIP_W,
    };
  }

  const btn = (primary: boolean): React.CSSProperties => ({
    fontFamily: V2_TYPE.ui, fontWeight: 600, fontSize: 12.5, borderRadius: 9,
    padding: "9px 15px", cursor: "pointer",
    border: primary ? "none" : `1px solid ${V2.line}`,
    background: primary ? V2.brand : "transparent",
    color: primary ? V2.onBrand : V2.ink,
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 900 }}>
      {/* Blocks interaction with the app while the tour runs. */}
      <div style={{ position: "fixed", inset: 0 }} aria-hidden="true" />

      {spot ? (
        <div
          style={{
            position: "fixed",
            top: spot.top, left: spot.left, width: spot.width, height: spot.height,
            borderRadius: 14,
            boxShadow: `0 0 0 9999px ${DIM}`,
            pointerEvents: "none",
          }}
        />
      ) : (
        <div style={{ position: "fixed", inset: 0, background: DIM, pointerEvents: "none" }} />
      )}

      <div
        role="dialog"
        aria-label={step.title}
        style={{
          ...tipStyle,
          zIndex: 901,
          background: V2.card,
          borderRadius: 14,
          border: `0.5px solid ${V2.line}`,
          boxShadow: "0 12px 40px rgba(30,26,22,.28)",
          padding: "18px 20px",
          fontFamily: V2_TYPE.ui,
          color: V2.ink,
        }}
      >
        <div style={{ fontFamily: V2_TYPE.mono, fontSize: 10, letterSpacing: ".08em", color: V2.gold }}>
          TOUR · KROK {stepIndex + 1} / {steps.length}
        </div>
        <div style={{ fontFamily: V2_TYPE.serif, fontWeight: 500, fontSize: 19, marginTop: 7, lineHeight: 1.2 }}>
          {step.title}
        </div>
        <p style={{ fontSize: 12.5, lineHeight: 1.6, color: V2.muted, marginTop: 8 }}>{step.body}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
          {stepIndex > 0 && (
            <button style={btn(false)} onClick={() => goTo(-1)}>
              ← Wstecz
            </button>
          )}
          <button style={btn(true)} onClick={() => goTo(1)} data-testid="tour-next">
            {isLast ? "Zakończ tour →" : "Dalej →"}
          </button>
          <button
            onClick={onSkip}
            data-testid="tour-skip"
            style={{ marginLeft: "auto", border: "none", background: "none", cursor: "pointer", fontSize: 11, color: V2.subtle, fontFamily: V2_TYPE.ui }}
          >
            Pomiń tour (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
