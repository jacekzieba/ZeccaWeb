"use client";

import type { CSSProperties } from "react";
import type { CashflowSummary, PortfolioMetrics } from "@/domain/models/investor-data";
import { V2, V2_TYPE, v2Mix } from "@/lib/v2-design";

const cardStyle: CSSProperties = {
  background: V2.card,
  borderRadius: 14,
  border: `0.5px solid ${V2.line}`,
  boxShadow: `0 1px 0 ${v2Mix(V2.ink, 0.03)}, 0 6px 20px ${v2Mix(V2.ink, 0.05)}`,
  padding: "15px 17px",
};

function fmt(n: number, d = 0) {
  return n.toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtSigned(n: number, d = 0) {
  return `${n >= 0 ? "+" : ""}${fmt(n, d)}`;
}
function fmtPct(n: number, d = 2) {
  return `${n >= 0 ? "+" : ""}${n.toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d })}%`;
}

/** A single KPI tile. Shared so Dashboard, Portfel and Raporty render identical
 * cards (parity with the macOS/iOS KPI tiles). */
export function KpiCard({
  label,
  value,
  sub,
  color = V2.ink,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div style={cardStyle}>
      <div
        style={{
          fontFamily: V2_TYPE.ui,
          fontSize: 10.5,
          fontWeight: 700,
          color: V2.subtle,
          textTransform: "uppercase",
          letterSpacing: ".10em",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: V2_TYPE.serif,
          fontSize: 22,
          fontWeight: 500,
          color,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: V2_TYPE.ui, fontSize: 11.5, color: V2.muted, marginTop: 3 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export type PortfolioKpiStripInput = {
  metrics: PortfolioMetrics;
  cashflows: CashflowSummary;
  totalValue: number;
  openPositions: number;
  currency: string;
  /** When set, prepends portfolio value + cash tiles (used on the Portfel view,
   * where there is no large summary card to carry them). */
  cashValue?: number;
};

/** Phase 1a parity strip: the KPI tiles the macOS/iOS app shows by default,
 * built entirely from values the web snapshot already computes. */
export function PortfolioKpiStrip({
  metrics,
  cashflows,
  totalValue,
  openPositions,
  currency,
  cashValue,
}: PortfolioKpiStripInput) {
  const unrealized = totalValue - metrics.netInvested;
  const xirr = metrics.xirrPct;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(158px, 1fr))",
        gap: 12,
      }}
    >
      {cashValue != null && (
        <>
          <KpiCard label="Wartość portfela" value={`${fmt(totalValue)} ${currency}`} />
          <KpiCard label="Gotówka" value={`${fmt(cashValue)} ${currency}`} />
        </>
      )}
      <KpiCard
        label="Zysk niezrealizowany"
        value={`${fmtSigned(unrealized)} ${currency}`}
        color={unrealized >= 0 ? V2.profit : V2.loss}
      />
      <KpiCard
        label="MWR · XIRR"
        value={xirr == null ? "—" : fmtPct(xirr)}
        sub="rocznie"
        color={(xirr ?? 0) >= 0 ? V2.profit : V2.loss}
      />
      <KpiCard
        label="Zwrot (TWR)"
        value={fmtPct(metrics.totalReturnPct)}
        sub="bez wpłat"
        color={metrics.totalReturnPct >= 0 ? V2.profit : V2.loss}
      />
      <KpiCard
        label="CAGR"
        value={fmtPct(metrics.cagrPct)}
        sub="rocznie, TWR"
        color={metrics.cagrPct >= 0 ? V2.profit : V2.loss}
      />
      <KpiCard
        label="Wynik realny"
        value={fmtPct(metrics.realReturnPct)}
        sub="po inflacji"
        color={metrics.realReturnPct >= 0 ? V2.profit : V2.loss}
      />
      <KpiCard
        label="Maks. obsunięcie"
        value={`${fmt(metrics.maxDrawdownPct, 2)}%`}
        sub="od szczytu"
        color={V2.loss}
      />
      <KpiCard
        label="Zysk zrealizowany"
        value={`${fmtSigned(metrics.realizedPnl)} ${currency}`}
        sub="zamknięte pozycje"
        color={metrics.realizedPnl >= 0 ? V2.profit : V2.loss}
      />
      <KpiCard label="Zainwestowany kapitał" value={`${fmt(metrics.netInvested)} ${currency}`} />
      <KpiCard label="Dywidendy" value={`+${fmt(cashflows.dividends)} ${currency}`} color={V2.profit} />
      <KpiCard label="Otwarte pozycje" value={String(openPositions)} />
    </div>
  );
}
