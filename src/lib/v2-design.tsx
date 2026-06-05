import type { CSSProperties, ReactNode } from "react";
import { TYPOGRAPHY } from "@/lib/design-tokens";

export const V2 = {
  page: "#E4E6E2",
  card: "#F7F8F4",
  card2: "#ECEEE7",
  ink: "#161D18",
  muted: "#4A544E",
  subtle: "#717870",
  line: "rgba(22,29,24,0.13)",
  line2: "rgba(22,29,24,0.07)",
  brand: "#214A35",
  brandDeep: "#163022",
  onBrand: "#F4F2E6",
  gold: "#A2772E",
  profit: "#23814F",
  loss: "#A84432",
  equity: "#34699A",
  bonds: "#8C6F30",
  deposit: "#5C6A60",
  cash: "#8C8E82",
  spec: "rgba(255,255,255,0.75)",
} as const;

export const V2_TYPE = {
  serif: TYPOGRAPHY.serif,
  ui: TYPOGRAPHY.system,
  mono: TYPOGRAPHY.mono,
} as const;

export function v2Mix(hex: string, pct: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${pct})`;
}

export const v2Glass: CSSProperties = {
  background: v2Mix(V2.card, 0.7),
  backdropFilter: "blur(38px) saturate(175%)",
  WebkitBackdropFilter: "blur(38px) saturate(175%)",
  border: `0.5px solid ${V2.spec}`,
  boxShadow: `inset 0 1px 0 ${V2.spec}, 0 14px 36px ${v2Mix(V2.ink, 0.08)}`,
};

export function V2Card({
  children,
  glass = false,
  pad = 22,
  style,
}: {
  children: ReactNode;
  glass?: boolean;
  pad?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: glass ? v2Mix(V2.card, 0.72) : V2.card,
        backdropFilter: glass ? "blur(30px) saturate(170%)" : "none",
        WebkitBackdropFilter: glass ? "blur(30px) saturate(170%)" : "none",
        border: `0.5px solid ${glass ? V2.spec : V2.line}`,
        borderRadius: 16,
        padding: pad,
        boxShadow: glass
          ? `inset 0 1px 0 ${V2.spec}, 0 8px 28px ${v2Mix(V2.ink, 0.07)}`
          : `0 1px 0 ${v2Mix(V2.ink, 0.03)}, 0 6px 20px ${v2Mix(V2.ink, 0.05)}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function V2Eyebrow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        fontFamily: V2_TYPE.ui,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: ".13em",
        textTransform: "uppercase",
        color: V2.subtle,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function V2Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: V2_TYPE.ui,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: ".04em",
        padding: "3px 7px",
        borderRadius: 5,
        color,
        background: v2Mix(color, 0.13),
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

export function V2ScreenHead({
  eyebrow,
  title,
  sub,
  action,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, padding: "2px 2px 0" }}>
      <div>
        <V2Eyebrow>{eyebrow}</V2Eyebrow>
        <div style={{ fontFamily: V2_TYPE.serif, fontSize: 31, fontWeight: 500, color: V2.ink, letterSpacing: "-.01em", marginTop: 3 }}>
          {title}
        </div>
        {sub && <div style={{ fontFamily: V2_TYPE.ui, fontSize: 13, color: V2.muted, marginTop: 4 }}>{sub}</div>}
      </div>
      {action}
    </div>
  );
}

export function V2Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "soft" | "ghost" | "danger";
  style?: CSSProperties;
}) {
  const palette: Record<typeof variant, CSSProperties> = {
    primary: {
      border: "none",
      background: V2.ink,
      color: V2.card,
      boxShadow: `0 3px 10px ${v2Mix(V2.ink, 0.22)}, inset 0 0.5px 0 ${v2Mix("#ffffff", 0.16)}`,
    },
    soft: {
      border: `0.5px solid ${V2.line}`,
      background: v2Mix(V2.brand, 0.1),
      color: V2.brand,
    },
    ghost: {
      border: `0.5px solid ${V2.line}`,
      background: "transparent",
      color: V2.muted,
    },
    danger: {
      border: `0.5px solid ${v2Mix(V2.loss, 0.2)}`,
      background: "transparent",
      color: V2.loss,
    },
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        padding: "10px 16px",
        borderRadius: 10,
        fontFamily: V2_TYPE.ui,
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.48 : 1,
        whiteSpace: "nowrap",
        ...palette[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function V2Kpi({
  label,
  value,
  accent = V2.ink,
  sub,
}: {
  label: string;
  value: string;
  accent?: string;
  sub?: string;
}) {
  return (
    <div style={{ flex: 1, minWidth: 140 }}>
      <div style={{ fontFamily: V2_TYPE.ui, fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: V2.subtle }}>
        {label}
      </div>
      <div style={{ fontFamily: V2_TYPE.serif, fontSize: 25, fontWeight: 500, color: accent, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      {sub && <div style={{ fontFamily: V2_TYPE.ui, fontSize: 11.5, color: V2.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export const v2InputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 12px 8px 31px",
  borderRadius: 9,
  border: `0.5px solid ${V2.line}`,
  background: v2Mix(V2.card, 0.72),
  color: V2.ink,
  fontSize: 12.5,
  fontFamily: V2_TYPE.ui,
  outline: "none",
  boxSizing: "border-box",
};

export const v2SelectStyle: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 9,
  border: `0.5px solid ${V2.line}`,
  background: v2Mix(V2.card, 0.72),
  color: V2.ink,
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: V2_TYPE.ui,
  appearance: "none",
};
