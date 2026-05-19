"use client";

import { useMemo, type CSSProperties } from "react";
import { useSyncStore } from "@/sync/store/sync-store";
import { AllocationDonut } from "@/components/charts/allocation-donut";
import { AreaChart } from "@/components/charts/area-chart";

const INK = "#1C3144";
const MUTED = "rgba(28,49,68,0.58)";
const SUBTLE = "rgba(28,49,68,0.38)";
const LINE_SOFT = "rgba(28,49,68,0.06)";
const PROFIT = "#2D9C6B";
const LOSS = "#B85042";

const glassCard: CSSProperties = {
  background: "rgba(255,253,249,0.82)",
  backdropFilter: "blur(30px) saturate(160%)",
  WebkitBackdropFilter: "blur(30px) saturate(160%)",
  borderRadius: 16,
  border: "0.5px solid rgba(255,255,255,0.7)",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 0 rgba(28,49,68,0.04), 0 4px 16px rgba(28,49,68,0.05)",
};

function fmt(n: number, d = 0) {
  return n.toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtPct(n: number, d = 2) {
  return `${n >= 0 ? "+" : ""}${n.toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d })}%`;
}

// ── Year-over-year returns from valuation series ─────────────────
type YearlyReturn = {
  year: number;
  startValue: number;
  endValue: number;
  returnPct: number;
  absoluteGain: number;
};

function calcYearlyReturns(
  series: { date: string; value: number }[],
): YearlyReturn[] {
  if (series.length < 2) return [];

  // Group by year — take last data point of each year
  const byYear = new Map<number, { date: string; value: number }[]>();
  for (const pt of series) {
    const y = new Date(pt.date).getUTCFullYear();
    const arr = byYear.get(y) ?? [];
    arr.push(pt);
    byYear.set(y, arr);
  }

  const years = [...byYear.keys()].sort();
  const results: YearlyReturn[] = [];

  for (let i = 0; i < years.length; i++) {
    const year = years[i];
    const pts = byYear.get(year)!;
    const endValue = pts.at(-1)!.value;

    // Start value: last point of previous year, or first point of this year
    const prevPts = i > 0 ? byYear.get(years[i - 1])! : null;
    const startValue = prevPts ? prevPts.at(-1)!.value : pts[0].value;

    if (startValue <= 0) continue;

    const returnPct = ((endValue - startValue) / startValue) * 100;
    results.push({ year, startValue, endValue, returnPct, absoluteGain: endValue - startValue });
  }

  // Only show years with actual change (skip first if same as start)
  return results.filter((r) => r.startValue !== r.endValue || results.length === 1);
}

// ── Best / worst month ───────────────────────────────────────────
type MonthlyStats = {
  bestMonth: { label: string; pct: number } | null;
  worstMonth: { label: string; pct: number } | null;
  positiveMonths: number;
  negativeMonths: number;
  totalMonths: number;
};

function calcMonthlyStats(series: { label: string; date: string; value: number }[]): MonthlyStats {
  if (series.length < 2) {
    return { bestMonth: null, worstMonth: null, positiveMonths: 0, negativeMonths: 0, totalMonths: 0 };
  }

  const changes = series.slice(1).map((pt, i) => {
    const prev = series[i].value;
    const pct = prev > 0 ? ((pt.value - prev) / prev) * 100 : 0;
    return { label: pt.label, pct };
  });

  const best = changes.reduce((a, b) => (b.pct > a.pct ? b : a));
  const worst = changes.reduce((a, b) => (b.pct < a.pct ? b : a));

  return {
    bestMonth: best,
    worstMonth: worst,
    positiveMonths: changes.filter((c) => c.pct > 0).length,
    negativeMonths: changes.filter((c) => c.pct < 0).length,
    totalMonths: changes.length,
  };
}

export function ReportsPage() {
  const snapshot = useSyncStore((s) => s.snapshot);

  const yearlyReturns = useMemo(
    () => (snapshot ? calcYearlyReturns(snapshot.valuationSeries) : []),
    [snapshot],
  );

  const monthlyStats = useMemo(
    () => (snapshot ? calcMonthlyStats(snapshot.valuationSeries) : null),
    [snapshot],
  );

  // Total return since first data point
  const totalReturn = useMemo(() => {
    if (!snapshot || snapshot.valuationSeries.length < 2) return null;
    const first = snapshot.valuationSeries[0].value;
    const last = snapshot.valuationSeries.at(-1)!.value;
    if (first <= 0) return null;
    return { pct: ((last - first) / first) * 100, abs: last - first };
  }, [snapshot]);

  const asOfLabel = snapshot
    ? new Date(snapshot.asOf).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header */}
      <div style={{ padding: "0 2px 4px" }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: INK, letterSpacing: "-0.01em" }}>
          Raporty
        </div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
          {asOfLabel ? `Dane na ${asOfLabel}` : "Odblokuj dane w panelu synchronizacji"}
        </div>
      </div>

      {!snapshot && (
        <div style={{ ...glassCard, padding: "48px 22px", textAlign: "center" }}>
          <div style={{ fontSize: 32, opacity: 0.12, marginBottom: 12 }}>≋</div>
          <div style={{ fontSize: 14, color: SUBTLE }}>
            Odblokuj dane w panelu synchronizacji
          </div>
        </div>
      )}

      {snapshot && (
        <>
          {/* KPI summary */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div style={{ ...glassCard, padding: "18px 20px" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: ".10em", marginBottom: 6 }}>
                Łączny zwrot
              </div>
              {totalReturn ? (
                <>
                  <div style={{ fontSize: 24, fontWeight: 700, color: totalReturn.pct >= 0 ? PROFIT : LOSS }}>
                    {fmtPct(totalReturn.pct)}
                  </div>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>
                    {totalReturn.abs >= 0 ? "+" : ""}{fmt(totalReturn.abs)} PLN
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 18, color: SUBTLE }}>—</div>
              )}
            </div>

            <div style={{ ...glassCard, padding: "18px 20px" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: ".10em", marginBottom: 6 }}>
                Zmiana miesięczna
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: snapshot.monthlyChange >= 0 ? PROFIT : LOSS }}>
                {fmtPct(snapshot.monthlyChange)}
              </div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>Ostatnie 30 dni</div>
            </div>

            {monthlyStats && (
              <div style={{ ...glassCard, padding: "18px 20px" }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: ".10em", marginBottom: 6 }}>
                  Miesięcy dodatnich
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: INK }}>
                  {monthlyStats.positiveMonths}
                  <span style={{ fontSize: 14, color: SUBTLE, fontWeight: 500 }}>
                    {" "}/ {monthlyStats.totalMonths}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>
                  {monthlyStats.totalMonths > 0
                    ? `${fmt((monthlyStats.positiveMonths / monthlyStats.totalMonths) * 100)}% skuteczności`
                    : "—"}
                </div>
              </div>
            )}

            <div style={{ ...glassCard, padding: "18px 20px" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: ".10em", marginBottom: 6 }}>
                Wartość portfela
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>
                {fmt(snapshot.totalValue)}
              </div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>PLN</div>
            </div>
          </div>

          {/* Full history chart */}
          <div style={{ ...glassCard, padding: "22px 22px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: ".10em" }}>
                  Historia wartości portfela
                </div>
                <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
                  {snapshot.valuationSeries.length} punktów ·{" "}
                  {snapshot.valuationSeries.length > 0 &&
                    new Date(snapshot.valuationSeries[0].date).toLocaleDateString("pl-PL", { month: "long", year: "numeric" })}
                  {" → "}
                  {asOfLabel}
                </div>
              </div>
            </div>
            <AreaChart data={snapshot.valuationSeries} height={220} />
          </div>

          {/* Yearly returns */}
          {yearlyReturns.length > 0 && (
            <div style={{ ...glassCard, padding: 0 }}>
              <div style={{ padding: "16px 22px 12px", borderBottom: `0.5px solid ${LINE_SOFT}` }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: ".10em" }}>
                  Zwrot rok do roku
                </div>
              </div>

              {/* Header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px minmax(0,1fr) minmax(0,1fr) 120px 100px",
                  padding: "10px 22px",
                  background: "rgba(28,49,68,0.025)",
                }}
              >
                {["Rok", "Wartość startowa", "Wartość końcowa", "Zysk / Strata", "Zwrot"].map((h, i) => (
                  <div key={h} style={{ fontSize: 10, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: ".08em", textAlign: i === 0 ? "left" : "right" }}>
                    {h}
                  </div>
                ))}
              </div>

              {yearlyReturns.map((yr) => {
                const isPos = yr.returnPct >= 0;
                const barWidth = Math.min(Math.abs(yr.returnPct) * 2, 100);

                return (
                  <div
                    key={yr.year}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "80px minmax(0,1fr) minmax(0,1fr) 120px 100px",
                      padding: "14px 22px",
                      borderTop: `0.5px solid ${LINE_SOFT}`,
                      alignItems: "center",
                      transition: "background .12s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(28,49,68,0.025)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ fontSize: 15, fontWeight: 800, color: INK }}>{yr.year}</div>
                    <div style={{ textAlign: "right", fontSize: 13, color: MUTED, fontVariantNumeric: "tabular-nums" }}>
                      {fmt(yr.startValue)} PLN
                    </div>
                    <div style={{ textAlign: "right", fontSize: 13, color: INK, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                      {fmt(yr.endValue)} PLN
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isPos ? PROFIT : LOSS, fontVariantNumeric: "tabular-nums" }}>
                        {isPos ? "+" : ""}{fmt(yr.absoluteGain)} PLN
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: isPos ? PROFIT : LOSS }}>
                        {fmtPct(yr.returnPct)}
                      </div>
                      <div style={{ width: "100%", height: 3, borderRadius: 2, background: "rgba(28,49,68,0.08)", marginTop: 4 }}>
                        <div
                          style={{
                            width: `${barWidth}%`,
                            height: "100%",
                            borderRadius: 2,
                            background: isPos ? PROFIT : LOSS,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Best / Worst month + Win rate */}
          {monthlyStats && monthlyStats.bestMonth && monthlyStats.worstMonth && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <div style={{ ...glassCard, padding: "18px 20px" }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: ".10em", marginBottom: 8 }}>
                  Najlepszy miesiąc
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: PROFIT }}>
                  {fmtPct(monthlyStats.bestMonth.pct)}
                </div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>{monthlyStats.bestMonth.label}</div>
              </div>

              <div style={{ ...glassCard, padding: "18px 20px" }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: ".10em", marginBottom: 8 }}>
                  Najgorszy miesiąc
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: LOSS }}>
                  {fmtPct(monthlyStats.worstMonth.pct)}
                </div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>{monthlyStats.worstMonth.label}</div>
              </div>

              <div style={{ ...glassCard, padding: "18px 20px" }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: ".10em", marginBottom: 8 }}>
                  Miesiące z zyskiem
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: PROFIT }}>{monthlyStats.positiveMonths}</span>
                  <span style={{ fontSize: 14, color: SUBTLE }}>/ {monthlyStats.totalMonths}</span>
                </div>
                {/* Win rate bar */}
                <div style={{ display: "flex", gap: 0, borderRadius: 4, overflow: "hidden", marginTop: 8, height: 6 }}>
                  <div
                    style={{
                      flex: monthlyStats.positiveMonths,
                      background: PROFIT,
                      minWidth: monthlyStats.positiveMonths > 0 ? 4 : 0,
                    }}
                  />
                  <div
                    style={{
                      flex: monthlyStats.negativeMonths,
                      background: LOSS,
                      minWidth: monthlyStats.negativeMonths > 0 ? 4 : 0,
                    }}
                  />
                  <div
                    style={{
                      flex: monthlyStats.totalMonths - monthlyStats.positiveMonths - monthlyStats.negativeMonths,
                      background: "rgba(28,49,68,0.08)",
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Allocation */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
            <div style={{ ...glassCard, padding: "22px 22px 18px" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: ".10em", marginBottom: 14 }}>
                Alokacja aktywów
              </div>
              <AllocationDonut slices={snapshot.allocation} />
            </div>

            {/* Allocation table */}
            <div style={{ ...glassCard, padding: 0 }}>
              <div style={{ padding: "16px 22px 10px", borderBottom: `0.5px solid ${LINE_SOFT}` }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: ".10em" }}>
                  Podział alokacji
                </div>
              </div>
              {snapshot.allocation.map((slice, i) => {
                const COLORS = ["#34699A", "#8A7A3C", "#9B6BC4", "#C97B30", "#2D9C6B", "#5E6C84"];
                const color = COLORS[i % COLORS.length];
                return (
                  <div
                    key={slice.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "13px 22px",
                      borderTop: `0.5px solid ${LINE_SOFT}`,
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0, display: "block" }} />
                      <span style={{ fontSize: 13, color: INK, fontWeight: 500 }}>{slice.label}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 80, height: 4, borderRadius: 2, background: "rgba(28,49,68,0.08)" }}>
                        <div style={{ width: `${slice.percent}%`, height: "100%", borderRadius: 2, background: color }} />
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums", minWidth: 48, textAlign: "right" }}>
                        {slice.percent.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                      </span>
                    </div>
                  </div>
                );
              })}
              {snapshot.allocation.length === 0 && (
                <div style={{ padding: "24px 22px", textAlign: "center", fontSize: 13, color: SUBTLE }}>
                  Brak danych alokacji
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
