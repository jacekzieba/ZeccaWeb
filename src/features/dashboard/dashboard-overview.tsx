"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import type {
  AllocationSlice,
  InstrumentRow,
  PortfolioSummary,
  TransactionRow,
  ValuationPoint,
} from "@/domain/models/investor-data";
import { TYPOGRAPHY } from "@/lib/design-tokens";
import { formatAxisValue } from "@/lib/money";
import {
  buildInstrumentList,
  buildInvestorDataSnapshot,
  buildTransactionList,
} from "@/sync/records/investor-snapshot";
import { summarizeDecryptedRecords } from "@/sync/records/sync-summary";
import { useSyncStore } from "@/sync/store/sync-store";
import { firstName, useProfile } from "@/features/profile/profile-store";

const SERIF = TYPOGRAPHY.serif;
const UI = TYPOGRAPHY.system;
const MONO = TYPOGRAPHY.mono;

const PALETTE = {
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

const PERIOD_OPTIONS = ["1M", "3M", "6M", "1Y", "2Y", "MAX"] as const;
type Period = (typeof PERIOD_OPTIONS)[number];

const PERIOD_MONTHS: Record<Period, number> = {
  "1M": 1,
  "3M": 3,
  "6M": 6,
  "1Y": 12,
  "2Y": 24,
  MAX: 24,
};

type HoldingView = {
  id: string;
  symbol: string;
  name: string;
  kind: string;
  quantity: number;
  price: number;
  currency: string;
  valuePLN: number;
  pnl: number | null;
  pnlPct: number | null;
  d30Pct: number | null;
  source?: string;
};

type TransactionView = {
  id: string;
  date: string;
  portfolioName: string;
  type: string;
  symbol: string;
  quantity: number | null;
  amount: number;
  currency: string;
};

const TX_LABELS: Record<string, string> = {
  buy: "Zakup",
  sell: "Sprzedaż",
  dividend: "Dywidenda",
  interest: "Odsetki",
  bondCoupon: "Kupon",
  depositOpen: "Lokata",
  depositClose: "Zamknięcie",
  cashDeposit: "Wpłata",
  cashWithdrawal: "Wypłata",
  fee: "Prowizja",
  tax: "Podatek",
  fxConversion: "FX",
  transferIn: "Transfer IN",
  transferOut: "Transfer OUT",
};

const KIND_LABELS: Record<string, string> = {
  stock: "AKC",
  etf: "ETF",
  treasuryBond: "OBL",
  listedBond: "OBL",
  deposit: "LOK",
  cash: "GOT",
  crypto: "KRY",
};

function computeMonthlyBars(series: ValuationPoint[]): { labels: string[]; profit: number[]; loss: number[] } {
  if (series.length < 2) return { labels: [], profit: [], loss: [] };

  // Group daily points by YYYY-MM key
  const byMonth = new Map<string, number[]>();
  for (const point of series) {
    const key = point.date.slice(0, 7);
    const arr = byMonth.get(key) ?? [];
    arr.push(point.value);
    byMonth.set(key, arr);
  }

  const months = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
  const PL_MONTHS = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

  const labels: string[] = [];
  const profit: number[] = [];
  const loss: number[] = [];

  for (const [key, values] of months) {
    const monthIdx = parseInt(key.slice(5, 7), 10) - 1;
    labels.push(PL_MONTHS[monthIdx] ?? key.slice(5, 7));
    const change = values[values.length - 1] - values[0];
    profit.push(change > 0 ? change : 0);
    loss.push(change < 0 ? -change : 0);
  }

  return { labels, profit, loss };
}
const DASHBOARD_HEAD_PADDING = "22px 2px 0";

function mix(hex: string, pct: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${pct})`;
}

function fmt(n: number, d = 0) {
  return n.toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtQty(n: number) {
  if (Number.isInteger(n)) return fmt(n);
  return n.toLocaleString("pl-PL", { minimumFractionDigits: n < 1 ? 4 : 2, maximumFractionDigits: 6 });
}

function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${fmt(n, 2)}%`;
}

function fmtSigned(n: number, d = 0) {
  return `${n >= 0 ? "+" : ""}${fmt(n, d)}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function useMedia(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

function Card({
  children,
  glass = false,
  pad = 22,
  style,
}: {
  children: React.ReactNode;
  glass?: boolean;
  pad?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: glass ? mix(PALETTE.card, 0.72) : PALETTE.card,
        backdropFilter: glass ? "blur(30px) saturate(170%)" : "none",
        WebkitBackdropFilter: glass ? "blur(30px) saturate(170%)" : "none",
        border: `0.5px solid ${glass ? PALETTE.spec : PALETTE.line}`,
        borderRadius: 16,
        padding: pad,
        boxShadow: glass
          ? `inset 0 1px 0 ${PALETTE.spec}, 0 8px 28px ${mix(PALETTE.ink, 0.07)}`
          : `0 1px 0 ${mix(PALETTE.ink, 0.03)}, 0 6px 20px ${mix(PALETTE.ink, 0.05)}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children, style }: { children: React.ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        fontFamily: UI,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: ".13em",
        textTransform: "uppercase",
        color: PALETTE.subtle,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Pnl({ value, pct, size = 13 }: { value: number; pct?: number | null; size?: number }) {
  const color = value >= 0 ? PALETTE.profit : PALETTE.loss;

  return (
    <span
      style={{
        color,
        fontSize: size,
        fontWeight: 600,
        fontFamily: UI,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {fmtSigned(value)} PLN
      {pct != null && <span style={{ opacity: 0.72, marginLeft: 4 }}>({fmtPct(pct)})</span>}
    </span>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: UI,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: ".04em",
        padding: "3px 7px",
        borderRadius: 5,
        color,
        background: mix(color, 0.13),
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function PeriodBar({ value, onChange }: { value: Period; onChange: (period: Period) => void }) {
  return (
    <div style={{ display: "inline-flex", background: mix(PALETTE.ink, 0.06), borderRadius: 11, padding: 3 }}>
      {PERIOD_OPTIONS.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          style={{
            padding: "5px 12px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            fontFamily: UI,
            fontSize: 11.5,
            fontWeight: value === option ? 700 : 500,
            background: value === option ? PALETTE.card : "transparent",
            color: value === option ? PALETTE.ink : PALETTE.muted,
            boxShadow: value === option ? `0 1px 4px ${mix(PALETTE.ink, 0.1)}` : "none",
            transition: "all .15s",
          }}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function V2Area({ data, height = 240 }: { data: ValuationPoint[]; height?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(820);
  const [hover, setHover] = useState<number | null>(null);
  const gradId = useId().replace(/:/g, "");

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(Math.max(320, entry.contentRect.width));
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  if (data.length < 2) return null;

  const values = data.map((point) => point.value);
  const min = Math.min(...values) * 0.985;
  const max = Math.max(...values) * 1.012;
  const range = max - min || 1;
  const pl = 52;
  const pr = 14;
  const pt = 16;
  const pb = 30;
  const innerWidth = width - pl - pr;
  const innerHeight = height - pt - pb;
  const tx = (index: number) => pl + (index / (data.length - 1)) * innerWidth;
  const ty = (value: number) => pt + innerHeight - ((value - min) / range) * innerHeight;
  const points = data.map((point, index) => `${tx(index).toFixed(1)},${ty(point.value).toFixed(1)}`).join(" ");
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((factor) => min + factor * range);
  const xStep = Math.max(1, Math.ceil(data.length / Math.min(8, Math.max(3, Math.floor(width / 130)))));

  function handleMove(event: React.MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const index = Math.round(((event.clientX - rect.left - pl) / innerWidth) * (data.length - 1));
    if (index >= 0 && index < data.length) setHover(index);
  }

  return (
    <div ref={wrapRef} style={{ width: "100%", position: "relative" }} onMouseLeave={() => setHover(null)}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        onMouseMove={handleMove}
        style={{ display: "block", width: "100%", maxWidth: "100%", height }}
      >
        <defs>
          <linearGradient id={`v2area-${gradId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PALETTE.brand} stopOpacity="0.42" />
            <stop offset="55%" stopColor={PALETTE.brand} stopOpacity="0.16" />
            <stop offset="100%" stopColor={PALETTE.brand} stopOpacity="0.03" />
          </linearGradient>
        </defs>
        {yTicks.map((value, index) => (
          <g key={index}>
            <line x1={pl} x2={pl + innerWidth} y1={ty(value)} y2={ty(value)} stroke={PALETTE.line} strokeDasharray="2 5" />
            <text x={pl - 9} y={ty(value) + 4} textAnchor="end" fontSize="10.5" fill={PALETTE.subtle} fontFamily={MONO}>
              {formatAxisValue(value, range)}
            </text>
          </g>
        ))}
        <path d={`M${pl},${pt + innerHeight} L${points.split(" ").join(" L")} L${pl + innerWidth},${pt + innerHeight} Z`} fill={`url(#v2area-${gradId})`} />
        <polyline points={points} fill="none" stroke={PALETTE.brand} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((point, index) =>
          index % xStep === 0 || index === data.length - 1 ? (
            <text key={point.date} x={tx(index)} y={pt + innerHeight + 20} textAnchor="middle" fontSize="10.5" fill={PALETTE.subtle} fontFamily={MONO}>
              {point.label}
            </text>
          ) : null,
        )}
        <circle cx={tx(data.length - 1)} cy={ty(values.at(-1) ?? 0)} r="4.5" fill={PALETTE.gold} stroke={PALETTE.card} strokeWidth="2" />
        {hover != null && (
          <g>
            <line x1={tx(hover)} x2={tx(hover)} y1={pt} y2={pt + innerHeight} stroke={PALETTE.ink} strokeWidth="1" strokeDasharray="3 3" opacity=".35" />
            <circle cx={tx(hover)} cy={ty(data[hover].value)} r="5" fill={PALETTE.card} stroke={PALETTE.brand} strokeWidth="2.2" />
          </g>
        )}
      </svg>
      {hover != null && (
        <div
          style={{
            position: "absolute",
            left: Math.min(Math.max(tx(hover) - 64, 4), width - 140),
            top: 6,
            background: PALETTE.ink,
            color: PALETTE.card,
            padding: "7px 11px",
            borderRadius: 9,
            pointerEvents: "none",
            boxShadow: "0 8px 22px rgba(0,0,0,.22)",
            minWidth: 116,
          }}
        >
          <div style={{ opacity: 0.6, fontSize: 10, fontFamily: MONO, letterSpacing: ".03em" }}>{data[hover].label}</div>
          <div style={{ fontWeight: 500, fontFamily: SERIF, fontSize: 17, marginTop: 1, fontVariantNumeric: "tabular-nums" }}>
            {fmt(data[hover].value)} <span style={{ fontSize: 11, opacity: 0.65 }}>PLN</span>
          </div>
        </div>
      )}
    </div>
  );
}

function V2Alloc({ data, height = 18 }: { data: { id: string; label: string; value: number; color: string }[]; height?: number }) {
  return (
    <div style={{ display: "flex", width: "100%", height, borderRadius: height / 2, overflow: "hidden", gap: 2 }}>
      {data.map((segment) => (
        <div
          key={segment.id}
          title={`${segment.label}: ${segment.value.toFixed(1)}%`}
          style={{ flex: segment.value, background: segment.color, transition: "flex .25s" }}
        />
      ))}
    </div>
  );
}

function V2Spark({ data, color, width = 92, height = 30 }: { data: number[]; color: string; width?: number; height?: number }) {
  const gradId = useId().replace(/:/g, "");
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((value, index) => `${(index / (data.length - 1)) * width},${height - ((value - min) / range) * height}`).join(" ");

  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={`v2sp-${gradId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`M0,${height} L${points} L${width},${height} Z`} fill={`url(#v2sp-${gradId})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function V2HatchBars({ solid = true, height = 150, labels, profit, loss }: { solid?: boolean; height?: number; labels: string[]; profit: number[]; loss: number[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(380);
  const profitPattern = useId().replace(/:/g, "");
  const lossPattern = useId().replace(/:/g, "");

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(Math.max(240, entry.contentRect.width));
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const pl = 26;
  const pr = 6;
  const pt = 10;
  const pb = 22;
  const innerWidth = width - pl - pr;
  const innerHeight = height - pt - pb;
  const max = Math.max(...profit, ...loss) * 1.12 || 1;
  const slot = labels.length > 0 ? innerWidth / labels.length : innerWidth;
  const barWidth = Math.min(13, slot / 2.6);
  const gap = 3;

  if (labels.length === 0) {
    return <div ref={wrapRef} style={{ width: "100%", height, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: UI, fontSize: 12, color: PALETTE.subtle }}>Brak danych historycznych</span>
    </div>;
  }

  return (
    <div ref={wrapRef} style={{ width: "100%" }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", width: "100%", maxWidth: "100%", height }}>
        <defs>
          <pattern id={`v2hp-${profitPattern}`} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <rect width="6" height="6" fill={PALETTE.profit} opacity="0.16" />
            <line x1="0" y1="0" x2="0" y2="6" stroke={PALETTE.profit} strokeWidth="2.4" />
          </pattern>
          <pattern id={`v2hl-${lossPattern}`} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <rect width="6" height="6" fill={PALETTE.ink} opacity="0.05" />
            <line x1="0" y1="0" x2="0" y2="6" stroke={PALETTE.ink} strokeWidth="2.4" opacity="0.5" />
          </pattern>
        </defs>
        {[0, 0.5, 1].map((factor, index) => {
          const y = pt + innerHeight - factor * innerHeight;
          return <line key={index} x1={pl} x2={innerWidth + pl} y1={y} y2={y} stroke={PALETTE.line} strokeDasharray="2 5" />;
        })}
        {labels.map((month, index) => {
          const centerX = pl + slot * index + slot / 2;
          const profitHeight = (profit[index] / max) * innerHeight;
          const lossHeight = (loss[index] / max) * innerHeight;
          const profitX = centerX - barWidth - gap / 2;
          const lossX = centerX + gap / 2;

          return (
            <g key={month}>
              <rect
                x={profitX}
                y={pt + innerHeight - profitHeight}
                width={barWidth}
                height={profitHeight}
                rx="2.5"
                fill={solid ? PALETTE.profit : `url(#v2hp-${profitPattern})`}
                stroke={PALETTE.profit}
                strokeWidth="1"
              />
              <rect
                x={lossX}
                y={pt + innerHeight - lossHeight}
                width={barWidth}
                height={lossHeight}
                rx="2.5"
                fill={solid ? mix(PALETTE.ink, 0.32) : `url(#v2hl-${lossPattern})`}
                stroke={PALETTE.ink}
                strokeOpacity={solid ? 0.18 : 0.4}
                strokeWidth="1"
              />
              <text x={centerX} y={height - 7} textAnchor="middle" fontSize="9.5" fill={PALETTE.subtle} fontFamily={MONO}>
                {month}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function toHoldingViews(instruments: InstrumentRow[]): HoldingView[] {
  return instruments
    .filter((instrument) => instrument.totalQuantity > 0)
    .slice(0, 6)
    .map((instrument) => ({
      id: instrument.id,
      symbol: instrument.symbol,
      name: instrument.name,
      kind: instrument.kind,
      quantity: instrument.totalQuantity,
      price: instrument.lastPrice,
      currency: instrument.currency,
      valuePLN: instrument.marketValue,
      pnl: null,
      pnlPct: null,
      d30Pct: null,
      source: instrument.valuationSourceLabel,
    }));
}

function toTransactionViews(transactions: TransactionRow[]): TransactionView[] {
  return transactions.slice(0, 5).map((transaction) => ({
    id: transaction.id,
    date: transaction.date,
    portfolioName: transaction.portfolioName,
    type: transaction.transactionType,
    symbol: transaction.instrumentSymbol ?? transaction.instrumentName ?? transaction.transactionType,
    quantity: transaction.quantity,
    amount: transaction.grossAmount,
    currency: transaction.currency,
  }));
}

function kindColor(kind: string) {
  if (kind === "etf" || kind === "stock") return PALETTE.equity;
  if (kind === "treasuryBond" || kind === "listedBond") return PALETTE.bonds;
  if (kind === "deposit") return PALETTE.deposit;
  if (kind === "cash") return PALETTE.cash;
  return PALETTE.subtle;
}

function txColor(type: string) {
  if (["dividend", "interest", "bondCoupon", "depositClose", "cashDeposit"].includes(type)) return PALETTE.profit;
  if (["sell", "fee", "tax", "cashWithdrawal"].includes(type)) return PALETTE.loss;
  if (["buy"].includes(type)) return PALETTE.equity;
  return PALETTE.deposit;
}

// Change over the trailing ~30 days, matching the "vs 30 dni temu" label.
function calculateDeltaPLN(history: ValuationPoint[]) {
  if (history.length === 0) return 0;
  const last = history[history.length - 1];
  const cutoff = new Date(last.date);
  cutoff.setMonth(cutoff.getMonth() - 1);
  let previous = history[0];
  for (const point of history) {
    if (new Date(point.date).getTime() <= cutoff.getTime()) previous = point;
    else break;
  }
  return last.value - previous.value;
}

// Restrict the series to the selected period by DATE (the series is daily, so
// slicing by element count would be wrong). Falls back to the last two points
// so short periods on a sparse series still render instead of disappearing.
function filterByPeriod(history: ValuationPoint[], period: Period) {
  if (period === "MAX" || history.length <= 2) return history;
  const last = history[history.length - 1];
  const cutoff = new Date(last.date);
  cutoff.setMonth(cutoff.getMonth() - PERIOD_MONTHS[period]);
  const filtered = history.filter(
    (point) => new Date(point.date).getTime() >= cutoff.getTime(),
  );
  return filtered.length >= 2 ? filtered : history.slice(-2);
}

function normalizeAllocation(snapshotAllocation: AllocationSlice[]) {
  if (snapshotAllocation.length === 0) {
    return [{ id: "cash", label: "Gotówka", value: 100, color: PALETTE.cash }];
  }

  const colors = [PALETTE.equity, PALETTE.gold, PALETTE.bonds, PALETTE.deposit, PALETTE.cash, PALETTE.brand];
  return snapshotAllocation.map((item, index) => ({
    id: `${item.label}-${index}`,
    label: item.label,
    value: item.percent,
    color: colors[index % colors.length],
  }));
}

function DashboardLoading({
  profileName,
  dateText,
}: {
  profileName: string;
  dateText: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: UI, color: PALETTE.ink }}>
      <div style={{ padding: DASHBOARD_HEAD_PADDING }}>
        <div style={{ fontFamily: SERIF, fontSize: 31, fontWeight: 500, color: PALETTE.ink, letterSpacing: "-.01em" }}>
          Dzień dobry, <span style={{ fontStyle: "italic", color: PALETTE.brand }}>{firstName(profileName)}</span>
        </div>
        <div style={{ fontFamily: UI, fontSize: 13, color: PALETTE.muted, marginTop: 3 }}>
          {dateText} · synchronizuję dane.
        </div>
      </div>

      <Card glass pad={0} style={{ overflow: "hidden" }}>
        <div style={{ padding: "30px", minHeight: 260, display: "flex", flexDirection: "column", justifyContent: "center", gap: 16 }}>
          <Eyebrow>Wartość portfela</Eyebrow>
          <div style={{ fontFamily: SERIF, fontSize: 48, color: PALETTE.subtle }}>Ładowanie danych</div>
          <div style={{ width: "min(520px, 100%)", height: 10, borderRadius: 99, background: mix(PALETTE.ink, 0.07), overflow: "hidden" }}>
            <div style={{ width: "42%", height: "100%", borderRadius: 99, background: mix(PALETTE.brand, 0.25) }} />
          </div>
          <div style={{ fontSize: 13, color: PALETTE.muted }}>
            Czekam na odszyfrowany snapshot. Nie pokazuję danych przykładowych.
          </div>
        </div>
      </Card>
    </div>
  );
}

export function DashboardOverview() {
  const storeSnapshot = useSyncStore((state) => state.snapshot);
  const records = useSyncStore((state) => state.records);
  const marketFxRates = useSyncStore((state) => state.marketFxRates);
  const profile = useProfile();
  const [period, setPeriod] = useState<Period>("1Y");
  const isMobile = useMedia("(max-width: 720px)");
  const isTablet = useMedia("(max-width: 1140px)");

  const snapshot = useMemo(
    () =>
      records
        ? buildInvestorDataSnapshot(records, {
            asOf: new Date(),
            fxRates: marketFxRates,
            historyGranularity: "daily",
            useLatestTransactionFxRate: true,
            useMarketQuotes: true,
          })
        : storeSnapshot,
    [marketFxRates, records, storeSnapshot],
  );
  const syncSummary = records ? summarizeDecryptedRecords(records) : null;
  const dateText = new Date(snapshot?.asOf ?? Date.now()).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  });

  const instruments = useMemo(
    () =>
      records
        ? buildInstrumentList(records, {
            asOf: new Date(),
            fxRates: marketFxRates,
            useLatestTransactionFxRate: true,
            useMarketQuotes: true,
          })
        : [],
    [marketFxRates, records],
  );
  const transactions = useMemo(
    () => (records ? buildTransactionList(records) : []),
    [records],
  );

  if (!snapshot) {
    return <DashboardLoading profileName={profile.name} dateText={dateText} />;
  }

  const historySource = snapshot.valuationSeries;
  const chartData = filterByPeriod(historySource, period);
  const holdings = records ? toHoldingViews(instruments) : [];
  const txRows = records ? toTransactionViews(transactions) : [];
  const allocation = normalizeAllocation(snapshot.allocation);
  const totalValue = snapshot.totalValue;
  const deltaPLN = calculateDeltaPLN(historySource);
  const monthlyChange = snapshot.monthlyChange;
  const metrics = snapshot.metrics;
  const cashflows = snapshot.cashflows;
  const invested = metrics.netInvested;
  const unrealized = totalValue - metrics.netInvested;
  const stat = (label: string, value: string, color: string = PALETTE.ink) => (
    <div style={{ flex: 1, minWidth: 86 }}>
      <div style={{ fontFamily: UI, fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: PALETTE.subtle }}>
        {label}
      </div>
      <div
        style={{
          fontFamily: SERIF,
          fontSize: isMobile ? 21 : 25,
          fontWeight: 500,
          color,
          marginTop: 3,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: UI, color: PALETTE.ink }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10, padding: DASHBOARD_HEAD_PADDING }}>
        <div>
          <div style={{ fontFamily: SERIF, fontSize: isMobile ? 26 : 31, fontWeight: 500, color: PALETTE.ink, letterSpacing: "-.01em" }}>
            Dzień dobry, <span style={{ fontStyle: "italic", color: PALETTE.brand }}>{firstName(profile.name)}</span>
          </div>
          <div style={{ fontFamily: UI, fontSize: 13, color: PALETTE.muted, marginTop: 3 }}>
            {dateText} · {syncSummary ? "wszystkie dane zsynchronizowane" : "dane z lokalnego snapshotu"}.
          </div>
        </div>
      </div>

      <Card glass pad={0} style={{ overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "minmax(280px, 360px) 1fr" }}>
          <div
            style={{
              padding: isMobile ? "22px 22px 6px" : "30px 30px 26px",
              borderRight: isTablet ? "none" : `0.5px solid ${PALETTE.line}`,
              position: "relative",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <Eyebrow>Wartość portfela</Eyebrow>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: UI,
                  fontSize: 11,
                  fontWeight: 600,
                  color: PALETTE.brand,
                  background: mix(PALETTE.brand, 0.1),
                  padding: "5px 10px",
                  borderRadius: 99,
                }}
              >
                <span
                  className="v2pulse"
                  style={{ width: 6, height: 6, borderRadius: "50%", background: PALETTE.profit }}
                />
                Live
              </span>
            </div>
            <div
              style={{
                fontFamily: SERIF,
                fontWeight: 400,
                fontSize: isMobile ? 52 : 66,
                lineHeight: 0.98,
                letterSpacing: "-.015em",
                color: PALETTE.ink,
                fontVariantNumeric: "tabular-nums lining-nums",
              }}
            >
              {fmt(totalValue)}
              <span style={{ fontFamily: SERIF, fontSize: isMobile ? 22 : 26, fontStyle: "italic", color: PALETTE.subtle, fontWeight: 400, marginLeft: 8 }}>
                PLN
              </span>
            </div>
            <div style={{ marginTop: 12, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <Pnl value={deltaPLN} pct={monthlyChange} size={14.5} />
              <span style={{ fontSize: 12, color: PALETTE.subtle }}>vs 30 dni temu</span>
            </div>
            <div style={{ height: "0.5px", background: PALETTE.line, margin: isMobile ? "20px 0" : "24px 0" }} />
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              {stat(
                "MWR · XIRR",
                metrics.xirrPct == null ? "—" : fmtPct(metrics.xirrPct),
                metrics.xirrPct != null && metrics.xirrPct < 0 ? PALETTE.loss : PALETTE.brand,
              )}
              {stat(
                "Wynik realny",
                fmtPct(metrics.realReturnPct),
                metrics.realReturnPct >= 0 ? PALETTE.profit : PALETTE.loss,
              )}
              {stat("Max DD", `${fmt(metrics.maxDrawdownPct, 2)}%`, PALETTE.loss)}
            </div>
          </div>

          <div style={{ padding: isMobile ? "12px 16px 18px" : "22px 26px 18px", background: mix(PALETTE.card2, 0.4) }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 6 }}>
              <Eyebrow>Historia · {period === "MAX" ? "maksimum" : period}</Eyebrow>
              <PeriodBar value={period} onChange={setPeriod} />
            </div>
            <V2Area data={chartData} height={isMobile ? 190 : 232} />
            <div
              style={{
                display: "flex",
                gap: 22,
                flexWrap: "wrap",
                marginTop: 10,
                paddingTop: 12,
                borderTop: `0.5px solid ${PALETTE.line2}`,
                fontFamily: UI,
                fontSize: 12,
              }}
            >
              <span style={{ color: PALETTE.muted }}>
                Zainwestowano <b style={{ color: PALETTE.ink, fontVariantNumeric: "tabular-nums" }}>{fmt(invested)} PLN</b>
              </span>
              <span style={{ color: PALETTE.muted }}>
                Wynik{" "}
                <b style={{ color: unrealized >= 0 ? PALETTE.profit : PALETTE.loss }}>
                  {fmtSigned(unrealized)} PLN
                </b>
              </span>
              <span style={{ color: PALETTE.muted }}>
                Inflacja YOY <b style={{ color: PALETTE.ink }}>{fmt(metrics.inflationPct, 2)}%</b>
              </span>
            </div>
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: isMobile || isTablet ? "1fr" : "1.9fr 1fr", gap: 14 }}>
        <HoldingsCard holdings={holdings} isMobile={isMobile} />
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <AllocationCard allocation={allocation} />
          <MonthlyCard valuationSeries={historySource} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile || isTablet ? "1fr" : "1.4fr 1fr", gap: 14 }}>
        <TransactionsCard transactions={txRows} />
        <PortfoliosCard
          portfolios={snapshot.portfolios}
          asOf={snapshot.asOf}
          dividends={cashflows.dividends}
          interest={cashflows.interest}
          fees={cashflows.fees}
        />
      </div>
    </div>
  );
}

function HoldingsCard({ holdings, isMobile }: { holdings: HoldingView[]; isMobile: boolean }) {
  return (
    <Card pad={0}>
      <div style={{ padding: "18px 22px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `0.5px solid ${PALETTE.line}` }}>
        <div>
          <Eyebrow>Instrumenty</Eyebrow>
          <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 500, color: PALETTE.ink, marginTop: 2, whiteSpace: "nowrap" }}>
            {holdings.length} pozycji w portfelu
          </div>
        </div>
        <Link href="/instruments" style={{ fontFamily: UI, fontSize: 12, color: PALETTE.brand, fontWeight: 600, textDecoration: "none" }}>
          Wszystkie →
        </Link>
      </div>
      {!isMobile && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2.4fr) minmax(0,1fr) minmax(0,1.1fr) minmax(0,1.1fr) minmax(0,.7fr)", padding: "9px 22px", background: mix(PALETTE.ink, 0.022) }}>
          {["Instrument", "Liczba / Kurs", "Wartość", "Zysk / Strata", "30D"].map((header, index) => (
            <div key={header} style={{ fontFamily: UI, fontSize: 9.5, fontWeight: 700, color: PALETTE.subtle, textTransform: "uppercase", letterSpacing: ".07em", textAlign: index === 0 ? "left" : "right" }}>
              {header}
            </div>
          ))}
        </div>
      )}
      {holdings.length === 0 ? (
        <div style={{ padding: "32px 22px", color: PALETTE.subtle, fontSize: 13 }}>Brak aktywnych instrumentów w zsynchronizowanych danych.</div>
      ) : (
        holdings.map((holding, index) => {
          const tagColor = kindColor(holding.kind);
          const tag = KIND_LABELS[holding.kind] ?? "INNE";

          if (isMobile) {
            return (
              <div key={holding.id} style={{ borderTop: index === 0 ? "none" : `0.5px solid ${PALETTE.line2}`, padding: "14px 22px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <Badge label={tag} color={tagColor} />
                  <div style={{ fontFamily: UI, fontSize: 14, fontWeight: 700, color: PALETTE.ink }}>{holding.symbol}</div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                  <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 500, color: PALETTE.ink, fontVariantNumeric: "tabular-nums" }}>
                    {fmt(holding.valuePLN)} PLN
                  </div>
                  {holding.pnl != null ? (
                    <Pnl value={holding.pnl} pct={holding.pnlPct} />
                  ) : (
                    <span style={{ fontFamily: MONO, fontSize: 11, color: PALETTE.subtle }}>{holding.source ?? "wycena"}</span>
                  )}
                </div>
              </div>
            );
          }

          return (
            <div
              key={holding.id}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,2.4fr) minmax(0,1fr) minmax(0,1.1fr) minmax(0,1.1fr) minmax(0,.7fr)",
                padding: "13px 22px",
                borderTop: `0.5px solid ${PALETTE.line2}`,
                alignItems: "center",
                cursor: "pointer",
                transition: "background .12s",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = mix(PALETTE.ink, 0.022);
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = "transparent";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <Badge label={tag} color={tagColor} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: UI, fontSize: 13.5, fontWeight: 700, color: PALETTE.ink }}>{holding.symbol}</div>
                  <div style={{ fontFamily: UI, fontSize: 11, color: PALETTE.subtle, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{holding.name}</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: MONO, fontSize: 12.5, color: PALETTE.ink, fontVariantNumeric: "tabular-nums" }}>{fmtQty(holding.quantity)}</div>
                <div style={{ fontFamily: MONO, fontSize: 10.5, color: PALETTE.subtle }}>
                  {holding.currency} {fmt(holding.price, 2)}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 500, color: PALETTE.ink, fontVariantNumeric: "tabular-nums" }}>{fmt(holding.valuePLN)}</div>
                <div style={{ fontFamily: MONO, fontSize: 10.5, color: PALETTE.subtle }}>PLN</div>
              </div>
              <div style={{ textAlign: "right" }}>
                {holding.pnl != null ? (
                  <>
                    <div style={{ fontFamily: UI, fontSize: 13, fontWeight: 700, color: holding.pnl >= 0 ? PALETTE.profit : PALETTE.loss, fontVariantNumeric: "tabular-nums" }}>{fmtSigned(holding.pnl)}</div>
                    <div style={{ fontFamily: UI, fontSize: 11, color: holding.pnl >= 0 ? PALETTE.profit : PALETTE.loss, opacity: 0.82 }}>{holding.pnlPct != null ? fmtPct(holding.pnlPct) : "—"}</div>
                  </>
                ) : (
                  <span style={{ fontFamily: MONO, fontSize: 11, color: PALETTE.subtle }}>{holding.source ?? "wycena"}</span>
                )}
              </div>
              <div style={{ textAlign: "right", fontFamily: UI, fontSize: 12.5, fontWeight: 700, color: holding.d30Pct == null ? PALETTE.subtle : holding.d30Pct >= 0 ? PALETTE.profit : PALETTE.loss }}>
                {holding.d30Pct == null ? "—" : fmtPct(holding.d30Pct)}
              </div>
            </div>
          );
        })
      )}
    </Card>
  );
}

function AllocationCard({ allocation }: { allocation: { id: string; label: string; value: number; color: string }[] }) {
  return (
    <Card>
      <Eyebrow>Alokacja</Eyebrow>
      <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 500, color: PALETTE.ink, margin: "4px 0 16px" }}>Struktura aktywów</div>
      <V2Alloc data={allocation} />
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 16 }}>
        {allocation.map((item) => (
          <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: item.color }} />
            <span style={{ flex: 1, fontFamily: UI, fontSize: 12.5, color: PALETTE.ink }}>{item.label}</span>
            <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: PALETTE.ink, fontVariantNumeric: "tabular-nums" }}>
              {item.value.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function MonthlyCard({ valuationSeries }: { valuationSeries: ValuationPoint[] }) {
  const bars = useMemo(() => computeMonthlyBars(valuationSeries), [valuationSeries]);
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <Eyebrow>Zysk / strata</Eyebrow>
          <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 500, color: PALETTE.ink, marginTop: 4 }}>Miesięcznie</div>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: UI, fontSize: 11, color: PALETTE.muted }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: PALETTE.profit }} />
            Zysk
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: UI, fontSize: 11, color: PALETTE.muted }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: PALETTE.ink, opacity: 0.5 }} />
            Strata
          </span>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <V2HatchBars labels={bars.labels} profit={bars.profit} loss={bars.loss} />
      </div>
    </Card>
  );
}

function TransactionsCard({ transactions }: { transactions: TransactionView[] }) {
  return (
    <Card pad={0}>
      <div style={{ padding: "18px 22px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Eyebrow>Ostatnie transakcje</Eyebrow>
          <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 500, color: PALETTE.ink, marginTop: 2 }}>Aktywność konta</div>
        </div>
        <Link href="/transactions" style={{ fontFamily: UI, fontSize: 12, color: PALETTE.brand, fontWeight: 600, textDecoration: "none" }}>
          Wszystkie →
        </Link>
      </div>
      {transactions.length === 0 ? (
        <div style={{ padding: "28px 22px", color: PALETTE.subtle, fontSize: 13 }}>Brak transakcji do pokazania.</div>
      ) : (
        transactions.map((transaction) => {
          const income = ["sell", "dividend", "interest", "bondCoupon", "depositClose"].includes(transaction.type);
          const color = txColor(transaction.type);
          return (
            <div
              key={transaction.id}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 22px", borderTop: `0.5px solid ${PALETTE.line2}`, cursor: "pointer", transition: "background .12s" }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = mix(PALETTE.ink, 0.022);
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = "transparent";
              }}
            >
              <Badge label={TX_LABELS[transaction.type] ?? transaction.type} color={color} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: UI, fontSize: 13, fontWeight: 600, color: PALETTE.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {transaction.symbol}
                  {transaction.quantity ? <span style={{ color: PALETTE.subtle, fontWeight: 400, marginLeft: 6 }}>· {fmtQty(transaction.quantity)} szt.</span> : null}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 10.5, color: PALETTE.subtle, marginTop: 2 }}>
                  {fmtDate(transaction.date)} · {transaction.portfolioName}
                </div>
              </div>
              <div style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 500, color: income ? PALETTE.profit : PALETTE.ink, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                {income ? "+" : ""}
                {fmt(transaction.amount)} {transaction.currency}
              </div>
            </div>
          );
        })
      )}
    </Card>
  );
}

function PortfoliosCard({
  portfolios,
  asOf,
  dividends,
  interest,
  fees,
}: {
  portfolios: PortfolioSummary[];
  asOf: string;
  dividends: number;
  interest: number;
  fees: number;
}) {
  const asOfLabel = fmtDate(asOf);
  const cashflowPeriod = `Narastająco do ${asOfLabel}`;
  const cashflowRows = [
    ["Dywidendy", cashflowPeriod, `+${fmt(dividends)} zł`, PALETTE.profit],
    ["Odsetki", cashflowPeriod, `+${fmt(interest)} zł`, PALETTE.bonds],
    ["Prowizje", cashflowPeriod, `-${fmt(fees)} zł`, PALETTE.loss],
  ] as const;

  return (
    <Card>
      <Eyebrow>Portfele</Eyebrow>
      <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 500, color: PALETTE.ink, margin: "4px 0 16px" }}>Podział na konta</div>
      <div style={{ fontFamily: UI, fontSize: 11.5, color: PALETTE.subtle, margin: "-10px 0 16px" }}>
        Wycena na {asOfLabel} · miniwykresy: ostatnie 30 dni · zmiana: 1D
      </div>
      {portfolios.length === 0 ? (
        <div style={{ padding: "20px 0", color: PALETTE.subtle, fontSize: 13 }}>Brak portfeli do pokazania.</div>
      ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {portfolios.map((portfolio, index) => {
          const color = index === 0 ? PALETTE.brand : PALETTE.bonds;
          const series = portfolio.sparkline.length >= 2 ? portfolio.sparkline : [portfolio.value, portfolio.value];

          return (
            <div key={portfolio.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 12, background: mix(PALETTE.ink, 0.025), border: `0.5px solid ${PALETTE.line2}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                  <span style={{ fontFamily: UI, fontSize: 13.5, fontWeight: 700, color: PALETTE.ink }}>{portfolio.name}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: PALETTE.subtle, textTransform: "uppercase", letterSpacing: ".06em" }}>{portfolio.baseCurrency}</span>
                </div>
                <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 500, color: PALETTE.ink, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                  {fmt(portfolio.value)}
                  <span style={{ fontSize: 12, fontStyle: "italic", color: PALETTE.subtle, marginLeft: 4 }}>PLN</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: UI, fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: PALETTE.subtle, marginBottom: 3 }}>
                  30 dni
                </div>
                <V2Spark data={series} color={color} />
                <div style={{ display: "inline-flex", alignItems: "baseline", gap: 5, fontFamily: UI, fontSize: 12, fontWeight: 700, color: portfolio.dailyChange >= 0 ? PALETTE.profit : PALETTE.loss, marginTop: 4 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: PALETTE.subtle, letterSpacing: ".06em" }}>1D</span>
                  <span>{fmtPct(portfolio.dailyChange)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}
      <div style={{ display: "flex", gap: 10, marginTop: 14, paddingTop: 14, borderTop: `0.5px solid ${PALETTE.line2}` }}>
        {cashflowRows.map(([label, period, value, color]) => (
          <div key={label} style={{ flex: 1 }}>
            <div style={{ fontFamily: UI, fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: PALETTE.subtle }}>
              {label}
            </div>
            <div style={{ fontFamily: UI, fontSize: 9.5, color: PALETTE.subtle, marginTop: 2 }}>
              {period}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 600, color, marginTop: 3 }}>{value}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
