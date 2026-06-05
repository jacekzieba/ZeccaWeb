"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { sampleSnapshot, SAMPLE_HISTORY } from "@/features/dashboard/sample-data";
import { TYPOGRAPHY } from "@/lib/design-tokens";
import { useSyncStore } from "@/sync/store/sync-store";

const SERIF = TYPOGRAPHY.serif;
const UI = TYPOGRAPHY.system;
const MONO = TYPOGRAPHY.mono;

const C = {
  page: "#E4E6E2",
  card: "#F7F8F4",
  card2: "#ECEEE7",
  ink: "#161D18",
  muted: "#4A544E",
  subtle: "#717870",
  line: "rgba(22,29,24,0.13)",
  line2: "rgba(22,29,24,0.07)",
  brand: "#214A35",
  gold: "#A2772E",
  profit: "#23814F",
  loss: "#A84432",
  equity: "#34699A",
  bonds: "#8C6F30",
  deposit: "#5C6A60",
  cash: "#8C8E82",
  spec: "rgba(255,255,255,0.75)",
} as const;

type GrowthSeries = {
  labels: string[];
  growth: number[];
  returns: number[];
};

type Benchmark = {
  id: string;
  name: string;
  author: string;
  color: string;
  cagr: number;
  vol: number;
  seed: number;
  desc: string;
  alloc: { label: string; value: number; key: "eq" | "lt" | "it" | "gold" | "comm" | "cash" }[];
};

const BENCHMARKS: Benchmark[] = [
  {
    id: "allweather",
    name: "All Weather",
    author: "Ray Dalio",
    color: "#2F6E86",
    cagr: 0.07,
    vol: 0.075,
    seed: 71,
    desc: "Zbalansowany na różne fazy cyklu: akcje, obligacje, złoto i surowce.",
    alloc: [
      { label: "Akcje", value: 30, key: "eq" },
      { label: "Obligacje długoterm.", value: 40, key: "lt" },
      { label: "Obligacje średnioterm.", value: 15, key: "it" },
      { label: "Złoto", value: 7.5, key: "gold" },
      { label: "Surowce", value: 7.5, key: "comm" },
    ],
  },
  {
    id: "6040",
    name: "60 / 40",
    author: "Klasyczny",
    color: C.profit,
    cagr: 0.088,
    vol: 0.11,
    seed: 33,
    desc: "Klasyczny punkt odniesienia: 60% akcji i 40% obligacji.",
    alloc: [
      { label: "Akcje", value: 60, key: "eq" },
      { label: "Obligacje", value: 40, key: "lt" },
    ],
  },
  {
    id: "permanent",
    name: "Permanent",
    author: "Harry Browne",
    color: C.bonds,
    cagr: 0.062,
    vol: 0.065,
    seed: 52,
    desc: "Cztery równe filary na wzrost, recesję, inflację i deflację.",
    alloc: [
      { label: "Akcje", value: 25, key: "eq" },
      { label: "Obligacje długoterm.", value: 25, key: "lt" },
      { label: "Złoto", value: 25, key: "gold" },
      { label: "Gotówka", value: 25, key: "cash" },
    ],
  },
  {
    id: "sp500",
    name: "S&P 500",
    author: "100% akcje",
    color: C.loss,
    cagr: 0.135,
    vol: 0.17,
    seed: 19,
    desc: "Czysta ekspozycja na akcje USA: wysoki potencjał i wysokie obsunięcia.",
    alloc: [{ label: "Akcje USA", value: 100, key: "eq" }],
  },
];

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

function fmtPct(n: number, d = 1) {
  return `${n >= 0 ? "+" : ""}${(n * 100).toLocaleString("pl-PL", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })}%`;
}

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(random: () => number) {
  return (random() + random() + random() + random() - 2) / 0.577;
}

function buildBenchmarkSeries(benchmark: Benchmark, length: number): GrowthSeries {
  const n = Math.max(2, length);
  const years = (n - 1) / 12;
  const target = Math.pow(1 + benchmark.cagr, years) - 1;
  const monthlyVol = benchmark.vol / Math.sqrt(12);
  const random = rng(benchmark.seed);
  let noise = Array.from({ length: n - 1 }, () => gauss(random));
  const mean = noise.reduce((sum, value) => sum + value, 0) / noise.length;
  noise = noise.map((value) => (value - mean) * monthlyVol);
  const drift = (Math.log(1 + target) - noise.reduce((sum, value) => sum + value, 0)) / noise.length;
  const growth = [100];
  const returns: number[] = [];

  for (const item of noise) {
    const previous = growth.at(-1) ?? 100;
    const next = previous * Math.exp(drift + item);
    returns.push(next / previous - 1);
    growth.push(next);
  }

  return { labels: [], growth, returns };
}

// Collapse a (possibly daily) series to one point per calendar month, keeping
// the last value of each month — so the portfolio aligns with the monthly
// benchmark models below.
function toMonthly(series: { label: string; value: number; date: string }[]) {
  const byMonth = new Map<string, { label: string; value: number; date: string }>();
  for (const point of series) {
    const d = new Date(point.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    byMonth.set(key, point); // later points overwrite → keeps month's last value
  }
  return [...byMonth.values()].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}

// Build the deposit-neutral growth-of-100 line from the time-weighted
// performance index (NOT raw value, which would include contributions).
function portfolioGrowth(
  series: { label: string; value: number; date: string }[],
): GrowthSeries {
  const monthly = toMonthly(series).slice(-24);
  if (monthly.length < 2) {
    return { labels: ["Start", "Teraz"], growth: [100, 100], returns: [0] };
  }

  const first = monthly[0].value || 100;
  const growth = monthly.map((point) => (point.value / first) * 100);
  const returns = growth.slice(1).map((value, index) => value / growth[index] - 1);
  return {
    labels: monthly.map((point) =>
      new Date(point.date).toLocaleString("pl-PL", { month: "short", year: "2-digit" }),
    ),
    growth,
    returns,
  };
}

function stats(series: GrowthSeries) {
  const growth = series.growth;
  const returns = series.returns;
  const years = Math.max((growth.length - 1) / 12, 1 / 12);
  const totalRet = (growth.at(-1) ?? 100) / growth[0] - 1;
  const cagr = Math.pow((growth.at(-1) ?? 100) / growth[0], 1 / years) - 1;
  let peak = growth[0];
  let maxDrawdown = 0;

  for (const value of growth) {
    peak = Math.max(peak, value);
    maxDrawdown = Math.min(maxDrawdown, value / peak - 1);
  }

  const mean = returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : 0;
  const variance = returns.length
    ? returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length
    : 0;
  const vol = Math.sqrt(variance) * Math.sqrt(12);
  const sharpe = vol ? (cagr - 0.025) / vol : 0;

  return {
    totalRet,
    cagr,
    maxDrawdown,
    vol,
    sharpe,
    best: returns.length ? Math.max(...returns) : 0,
    worst: returns.length ? Math.min(...returns) : 0,
  };
}

function allocColor(key: Benchmark["alloc"][number]["key"]) {
  return {
    eq: C.equity,
    lt: C.bonds,
    it: mix(C.bonds, 0.65),
    gold: C.gold,
    comm: C.brand,
    cash: C.cash,
  }[key];
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
  pad = 22,
  style,
}: {
  children: React.ReactNode;
  pad?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: C.card,
        border: `0.5px solid ${C.line}`,
        borderRadius: 16,
        padding: pad,
        boxShadow: `0 1px 0 ${mix(C.ink, 0.03)}, 0 6px 20px ${mix(C.ink, 0.05)}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: UI, fontSize: 10.5, fontWeight: 700, letterSpacing: ".13em", textTransform: "uppercase", color: C.subtle }}>
      {children}
    </div>
  );
}

function MultiLineChart({
  labels,
  series,
  height = 300,
}: {
  labels: string[];
  series: { label: string; color: string; data: number[]; dash?: string; width?: number }[];
  height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(680);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(Math.max(280, entry.contentRect.width));
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const allValues = series.flatMap((item) => item.data);
  const minRaw = Math.min(...allValues);
  const maxRaw = Math.max(...allValues);
  const pad = (maxRaw - minRaw) * 0.08 || 1;
  const min = minRaw - pad;
  const max = maxRaw + pad;
  const range = max - min || 1;
  const count = series[0]?.data.length ?? 0;
  const pl = 48;
  const pr = 14;
  const pt = 14;
  const pb = 28;
  const innerWidth = width - pl - pr;
  const innerHeight = height - pt - pb;
  const tx = (index: number) => pl + (index / Math.max(count - 1, 1)) * innerWidth;
  const ty = (value: number) => pt + innerHeight - ((value - min) / range) * innerHeight;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((factor) => min + factor * range);
  const xStep = Math.max(1, Math.ceil(count / Math.min(7, Math.max(3, Math.floor(width / 130)))));

  function handleMove(event: React.MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const index = Math.round(((event.clientX - rect.left - pl) / innerWidth) * (count - 1));
    if (index >= 0 && index < count) setHover(index);
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
        {yTicks.map((value, index) => (
          <g key={index}>
            <line x1={pl} x2={pl + innerWidth} y1={ty(value)} y2={ty(value)} stroke={C.line} strokeDasharray="2 5" />
            <text x={pl - 8} y={ty(value) + 4} textAnchor="end" fontSize="10" fill={C.subtle} fontFamily={MONO}>
              {Math.round(value)}
            </text>
          </g>
        ))}
        {series.map((item) => (
          <polyline
            key={item.label}
            points={item.data.map((value, index) => `${tx(index).toFixed(1)},${ty(value).toFixed(1)}`).join(" ")}
            fill="none"
            stroke={item.color}
            strokeWidth={item.width ?? 2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={item.dash ?? "none"}
          />
        ))}
        {labels.map((label, index) =>
          index % xStep === 0 || index === labels.length - 1 ? (
            <text key={`${label}-${index}`} x={tx(index)} y={pt + innerHeight + 19} textAnchor="middle" fontSize="9.5" fill={C.subtle} fontFamily={MONO}>
              {label}
            </text>
          ) : null,
        )}
        {hover != null && <line x1={tx(hover)} x2={tx(hover)} y1={pt} y2={pt + innerHeight} stroke={C.ink} strokeWidth="1" strokeDasharray="3 3" opacity=".3" />}
        {hover != null &&
          series.map((item) => (
            <circle key={item.label} cx={tx(hover)} cy={ty(item.data[hover])} r="4" fill={C.card} stroke={item.color} strokeWidth="2" />
          ))}
      </svg>
      {hover != null && (
        <div
          style={{
            position: "absolute",
            left: Math.min(Math.max(tx(hover) - 70, 4), width - 160),
            top: 4,
            background: C.ink,
            color: C.card,
            padding: "8px 11px",
            borderRadius: 10,
            pointerEvents: "none",
            boxShadow: "0 8px 22px rgba(0,0,0,.22)",
            minWidth: 140,
          }}
        >
          <div style={{ opacity: 0.6, fontSize: 9.5, fontFamily: MONO, marginBottom: 4 }}>{labels[hover]}</div>
          {series.map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: item.color }} />
              <span style={{ fontSize: 11, opacity: 0.8, flex: 1 }}>{item.label}</span>
              <span style={{ fontFamily: SERIF, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{fmt(item.data[hover], 1)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Donut({
  data,
  size = 148,
  thickness = 26,
}: {
  data: { value: number; color: string }[];
  size?: number;
  thickness?: number;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  let acc = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      {data.map((item, index) => {
        const fraction = item.value / total;
        const dash = fraction * circumference;
        const offset = circumference - acc * circumference;
        acc += fraction;
        return (
          <circle
            key={index}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={item.color}
            strokeWidth={thickness}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${center} ${center})`}
          />
        );
      })}
      <text x={center} y={center - 2} textAnchor="middle" fontFamily={SERIF} fontSize={size * 0.18} fontWeight="500" fill={C.ink}>
        {data.length}
      </text>
      <text x={center} y={center + size * 0.14} textAnchor="middle" fontFamily={UI} fontSize={size * 0.075} fill={C.subtle} letterSpacing=".05em">
        klas
      </text>
    </svg>
  );
}

export function BenchmarkPage() {
  const snapshot = useSyncStore((state) => state.snapshot) ?? sampleSnapshot;
  const [selectedId, setSelectedId] = useState("allweather");
  const isMobile = useMedia("(max-width: 720px)");
  const isTablet = useMedia("(max-width: 1140px)");

  const perf = snapshot.performanceSeries?.length >= 2 ? snapshot.performanceSeries : null;
  const history = perf
    ?? (sampleSnapshot.performanceSeries.length >= 2 ? sampleSnapshot.performanceSeries : SAMPLE_HISTORY);
  const portfolio = useMemo(() => portfolioGrowth(history), [history]);
  const selected = BENCHMARKS.find((benchmark) => benchmark.id === selectedId) ?? BENCHMARKS[0];
  const benchmark = useMemo(() => buildBenchmarkSeries(selected, portfolio.growth.length), [selected, portfolio.growth.length]);
  const portfolioStats = useMemo(() => stats(portfolio), [portfolio]);
  const benchmarkStats = useMemo(() => stats(benchmark), [benchmark]);
  const diff = portfolioStats.cagr - benchmarkStats.cagr;
  const labels = portfolio.labels.length ? portfolio.labels : history.map((point) => point.label).slice(-portfolio.growth.length);

  const comparison = [
    { label: "Całkowity zwrot", portfolio: fmtPct(portfolioStats.totalRet), benchmark: fmtPct(benchmarkStats.totalRet), better: portfolioStats.totalRet >= benchmarkStats.totalRet },
    { label: "CAGR", portfolio: fmtPct(portfolioStats.cagr, 2), benchmark: fmtPct(benchmarkStats.cagr, 2), better: portfolioStats.cagr >= benchmarkStats.cagr },
    { label: "Maks. obsunięcie", portfolio: fmtPct(portfolioStats.maxDrawdown), benchmark: fmtPct(benchmarkStats.maxDrawdown), better: portfolioStats.maxDrawdown >= benchmarkStats.maxDrawdown },
    { label: "Zmienność roczna", portfolio: fmtPct(portfolioStats.vol), benchmark: fmtPct(benchmarkStats.vol), better: portfolioStats.vol <= benchmarkStats.vol },
    { label: "Sharpe", portfolio: fmt(portfolioStats.sharpe, 2), benchmark: fmt(benchmarkStats.sharpe, 2), better: portfolioStats.sharpe >= benchmarkStats.sharpe },
    { label: "Najlepszy miesiąc", portfolio: fmtPct(portfolioStats.best), benchmark: fmtPct(benchmarkStats.best), better: portfolioStats.best >= benchmarkStats.best },
    { label: "Najgorszy miesiąc", portfolio: fmtPct(portfolioStats.worst), benchmark: fmtPct(benchmarkStats.worst), better: portfolioStats.worst >= benchmarkStats.worst },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: UI, color: C.ink }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10, padding: "2px 2px 0" }}>
        <div>
          <div style={{ fontFamily: SERIF, fontSize: isMobile ? 26 : 31, fontWeight: 500, color: C.ink, letterSpacing: "-.01em" }}>
            Porównanie <span style={{ fontStyle: "italic", color: C.brand }}>portfolio</span>
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>
            Wzrost 100 (TWR, bez wpłat) · {labels[0]} → {labels.at(-1)}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 10 }}>
        {BENCHMARKS.map((item) => {
          const active = selected.id === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              style={{
                textAlign: "left",
                padding: "14px 16px",
                borderRadius: 14,
                cursor: "pointer",
                border: `1px solid ${active ? item.color : C.line}`,
                background: active ? mix(item.color, 0.08) : C.card,
                boxShadow: active ? `0 2px 10px ${mix(item.color, 0.18)}` : "none",
                transition: "all .15s",
                minWidth: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: item.color, flexShrink: 0 }} />
                <span style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 500, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {item.name}
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.subtle, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {item.author}
              </div>
            </button>
          );
        })}
      </div>

      <Card pad={0}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, padding: "18px 24px 8px" }}>
          <div>
            <Eyebrow>Wzrost 100 PLN · {portfolio.growth.length - 1} mies.</Eyebrow>
            <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 500, color: C.ink, marginTop: 2 }}>Twój portfel vs {selected.name}</div>
          </div>
          <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: C.muted }}>
              <span style={{ width: 14, height: 3, borderRadius: 2, background: C.brand }} />
              Twój portfel
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: C.muted }}>
              <span style={{ width: 14, height: 0, borderTop: `2.5px dashed ${selected.color}` }} />
              {selected.name}
            </span>
          </div>
        </div>
        <div style={{ padding: "4px 12px 16px" }}>
          <MultiLineChart
            labels={labels}
            height={isMobile ? 230 : 300}
            series={[
              { label: "Twój portfel", color: C.brand, data: portfolio.growth, width: 2.8 },
              { label: selected.name, color: selected.color, data: benchmark.growth, width: 2.2, dash: "6 4" },
            ]}
          />
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "1fr 1.1fr", gap: 14 }}>
        <Card>
          <Eyebrow>Werdykt</Eyebrow>
          <div style={{ fontFamily: SERIF, fontSize: isMobile ? 22 : 26, fontWeight: 500, color: diff >= 0 ? C.profit : C.loss, marginTop: 6, lineHeight: 1.15 }}>
            {diff >= 0 ? "Wyprzedzasz" : "Pozostajesz za"} {selected.name}
            <br />o {fmtPct(Math.abs(diff), 2)} <span style={{ fontSize: 14, color: C.subtle, fontStyle: "italic" }}>rocznie</span>
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>{selected.desc}</div>

          <div style={{ height: "0.5px", background: C.line, margin: "18px 0" }} />
          <Eyebrow>Skład modelu {selected.name}</Eyebrow>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", marginTop: 12 }}>
            <Donut data={selected.alloc.map((item) => ({ value: item.value, color: allocColor(item.key) }))} size={isMobile ? 130 : 148} />
            <div style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 9 }}>
              {selected.alloc.map((item) => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: allocColor(item.key) }} />
                  <span style={{ fontSize: 12.5, color: C.muted, flex: 1 }}>{item.label}</span>
                  <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: C.ink }}>{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card pad={0}>
          <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr 1fr", padding: "15px 22px", borderBottom: `0.5px solid ${C.line}`, background: mix(C.ink, 0.022) }}>
            {["Miara", "Twój portfel", selected.name].map((label, index) => (
              <span
                key={label}
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  color: index === 1 ? C.brand : index === 2 ? selected.color : C.subtle,
                  textTransform: "uppercase",
                  letterSpacing: ".07em",
                  textAlign: index === 0 ? "left" : "right",
                }}
              >
                {label}
              </span>
            ))}
          </div>
          {comparison.map((row, index) => (
            <div
              key={row.label}
              style={{
                display: "grid",
                gridTemplateColumns: "1.35fr 1fr 1fr",
                padding: "12px 22px",
                borderTop: index === 0 ? "none" : `0.5px solid ${C.line2}`,
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 12.5, color: C.muted }}>{row.label}</span>
              <span style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 500, color: C.ink, textAlign: "right", fontVariantNumeric: "tabular-nums", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
                {row.better && <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.profit }} />}
                {row.portfolio}
              </span>
              <span style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 500, color: C.muted, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {row.benchmark}
              </span>
            </div>
          ))}
          <div style={{ padding: "11px 22px", borderTop: `0.5px solid ${C.line}`, background: mix(C.ink, 0.022), display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.profit }} />
            <span style={{ fontSize: 11, color: C.subtle }}>kropka = przewaga Twojego portfela w danej mierze</span>
          </div>
        </Card>
      </div>

      <div style={{ fontSize: 11, color: C.subtle, padding: "0 4px", lineHeight: 1.5 }}>
        Benchmarki są deterministycznymi modelami referencyjnymi. Werdykt bazuje na normalizowanej ścieżce wzrostu portfela, aby porównywać strategię zamiast nominalnej wartości majątku.
      </div>
    </div>
  );
}
