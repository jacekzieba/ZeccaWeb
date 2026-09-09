"use client";

import type { ReactNode } from "react";
import { Sparkline } from "@/components/charts/sparkline";
import { COLORS, SURFACES } from "@/lib/design-tokens";

type StatCardProps = {
  label: string;
  value: string | ReactNode;
  sub?: string | ReactNode;
  spark?: number[];
  accent?: string;
};

export function StatCard({ label, value, sub, spark, accent }: StatCardProps) {
  return (
    <div
      style={{
        ...SURFACES.glassCard,
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        position: "relative",
        overflow: "hidden",
        minHeight: 130,
      }}
    >
      {accent && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 24,
            bottom: 24,
            width: 3,
            borderRadius: "0 3px 3px 0",
            background: accent,
          }}
        />
      )}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: COLORS.subtle,
          textTransform: "uppercase",
          letterSpacing: ".10em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: COLORS.text,
          lineHeight: 1.1,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.01em",
          marginTop: 2,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.45 }}>{sub}</div>
      )}
      {spark && (
        <div style={{ marginTop: "auto", paddingTop: 6 }}>
          <Sparkline data={spark} width={180} height={24} color={COLORS.profit} strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}
