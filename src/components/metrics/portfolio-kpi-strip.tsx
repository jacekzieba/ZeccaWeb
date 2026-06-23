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
  height: "100%",
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

export type KpiTileId =
  | "kpiUnrealized"
  | "kpiXirr"
  | "kpiTwr"
  | "kpiCagr"
  | "kpiRealReturn"
  | "kpiMaxDd"
  | "kpiRealized"
  | "kpiInvested"
  | "kpiDividends"
  | "kpiOpenPositions";

/** Metadata for each KPI tile — used to register them as individually
 * toggleable dashboard sections. */
export const KPI_TILE_META: { id: KpiTileId; label: string; desc: string }[] = [
  { id: "kpiUnrealized", label: "Zysk niezrealizowany", desc: "Wartość ponad zainwestowany kapitał." },
  { id: "kpiXirr", label: "MWR · XIRR", desc: "Roczny zwrot ważony kapitałem." },
  { id: "kpiTwr", label: "Zwrot (TWR)", desc: "Zwrot całkowity, bez wpłat." },
  { id: "kpiCagr", label: "CAGR", desc: "Annualizowany zwrot ważony czasem." },
  { id: "kpiRealReturn", label: "Wynik realny", desc: "Zwrot po inflacji." },
  { id: "kpiMaxDd", label: "Maks. obsunięcie", desc: "Największy spadek od szczytu." },
  { id: "kpiRealized", label: "Zysk zrealizowany", desc: "Wynik z zamkniętych pozycji." },
  { id: "kpiInvested", label: "Zainwestowany kapitał", desc: "Wpłaty netto." },
  { id: "kpiDividends", label: "Dywidendy", desc: "Suma otrzymanych dywidend." },
  { id: "kpiOpenPositions", label: "Otwarte pozycje", desc: "Liczba aktywnych pozycji." },
];

export type KpiTile = { id: KpiTileId; label: string; value: string; sub?: string; color: string };

export type PortfolioKpiInput = {
  metrics: PortfolioMetrics;
  cashflows: CashflowSummary;
  totalValue: number;
  openPositions: number;
  currency: string;
};

/** Computes every KPI tile from values the snapshot already produces. Single
 * source of truth for the Portfel strip and the per-tile Dashboard sections. */
export function getKpiTiles(input: PortfolioKpiInput): KpiTile[] {
  const { metrics, cashflows, totalValue, openPositions, currency } = input;
  const unrealized = totalValue - metrics.netInvested;
  const xirr = metrics.xirrPct;
  return [
    { id: "kpiUnrealized", label: "Zysk niezrealizowany", value: `${fmtSigned(unrealized)} ${currency}`, color: unrealized >= 0 ? V2.profit : V2.loss },
    { id: "kpiXirr", label: "MWR · XIRR", value: xirr == null ? "—" : fmtPct(xirr), sub: "rocznie", color: (xirr ?? 0) >= 0 ? V2.profit : V2.loss },
    { id: "kpiTwr", label: "Zwrot (TWR)", value: fmtPct(metrics.totalReturnPct), sub: "bez wpłat", color: metrics.totalReturnPct >= 0 ? V2.profit : V2.loss },
    { id: "kpiCagr", label: "CAGR", value: fmtPct(metrics.cagrPct), sub: "rocznie, TWR", color: metrics.cagrPct >= 0 ? V2.profit : V2.loss },
    { id: "kpiRealReturn", label: "Wynik realny", value: fmtPct(metrics.realReturnPct), sub: "po inflacji", color: metrics.realReturnPct >= 0 ? V2.profit : V2.loss },
    { id: "kpiMaxDd", label: "Maks. obsunięcie", value: `${fmt(metrics.maxDrawdownPct, 2)}%`, sub: "od szczytu", color: V2.loss },
    { id: "kpiRealized", label: "Zysk zrealizowany", value: `${fmtSigned(metrics.realizedPnl)} ${currency}`, sub: "zamknięte pozycje", color: metrics.realizedPnl >= 0 ? V2.profit : V2.loss },
    { id: "kpiInvested", label: "Zainwestowany kapitał", value: `${fmt(metrics.netInvested)} ${currency}`, color: V2.ink },
    { id: "kpiDividends", label: "Dywidendy", value: `+${fmt(cashflows.dividends)} ${currency}`, color: V2.profit },
    { id: "kpiOpenPositions", label: "Otwarte pozycje", value: String(openPositions), color: V2.ink },
  ];
}

