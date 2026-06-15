"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useDisplaySnapshot } from "@/features/sync/use-display-snapshot";
import { useProfile } from "@/features/profile/profile-store";
import { useSampleDataSignal } from "@/features/telemetry/use-sample-data-signal";
import { sampleSnapshot } from "@/features/dashboard/sample-data";
import { AllocationDonut } from "@/components/charts/allocation-donut";
import { AreaChart } from "@/components/charts/area-chart";
import type { ValuationPoint } from "@/domain/models/investor-data";
import { V2, V2_TYPE, v2Mix } from "@/lib/v2-design";

const INK = V2.ink;
const MUTED = V2.muted;
const SUBTLE = V2.subtle;
const LINE = V2.line;
const LINE_SOFT = V2.line2;
const PROFIT = V2.profit;
const LOSS = V2.loss;
const UI = V2_TYPE.ui;
const SERIF = V2_TYPE.serif;
const MONO = V2_TYPE.mono;

const card: CSSProperties = {
  background: V2.card,
  borderRadius: 16,
  border: `0.5px solid ${LINE}`,
  boxShadow: `0 1px 0 ${v2Mix(V2.ink, 0.03)}, 0 6px 20px ${v2Mix(V2.ink, 0.05)}`,
};

function fmt(n: number, d = 0) {
  return n.toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtPct(n: number, d = 2) {
  return `${n >= 0 ? "+" : ""}${n.toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d })}%`;
}

// Collapse a daily series to one point per month (last value of each month).
function toMonthly(series: ValuationPoint[]): ValuationPoint[] {
  const byMonth = new Map<string, ValuationPoint>();
  for (const point of series) {
    const d = new Date(point.date);
    byMonth.set(`${d.getFullYear()}-${d.getMonth()}`, point);
  }
  return [...byMonth.values()].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

type MonthlyStats = {
  best: { label: string; pct: number } | null;
  worst: { label: string; pct: number } | null;
  positive: number;
  negative: number;
  total: number;
};

// Month-over-month change of the time-weighted index (deposit-neutral).
function calcMonthlyStats(perf: ValuationPoint[]): MonthlyStats {
  const monthly = toMonthly(perf);
  if (monthly.length < 2) return { best: null, worst: null, positive: 0, negative: 0, total: 0 };
  const changes = monthly.slice(1).map((point, i) => {
    const prev = monthly[i].value;
    const pct = prev > 0 ? ((point.value - prev) / prev) * 100 : 0;
    const label = new Date(point.date).toLocaleString("pl-PL", { month: "short", year: "2-digit" });
    return { label, pct };
  });
  return {
    best: changes.reduce((a, b) => (b.pct > a.pct ? b : a)),
    worst: changes.reduce((a, b) => (b.pct < a.pct ? b : a)),
    positive: changes.filter((c) => c.pct > 0).length,
    negative: changes.filter((c) => c.pct < 0).length,
    total: changes.length,
  };
}

type YearlyReturn = { year: number; returnPct: number };

// Year-over-year return from the time-weighted index (deposit-neutral).
function calcYearlyReturns(perf: ValuationPoint[]): YearlyReturn[] {
  if (perf.length < 2) return [];
  const lastByYear = new Map<number, number>();
  for (const point of perf) lastByYear.set(new Date(point.date).getFullYear(), point.value);
  const years = [...lastByYear.keys()].sort();
  const results: YearlyReturn[] = [];
  let prevEnd = perf[0].value;
  for (const year of years) {
    const end = lastByYear.get(year)!;
    if (prevEnd > 0) results.push({ year, returnPct: ((end - prevEnd) / prevEnd) * 100 });
    prevEnd = end;
  }
  return results;
}

const REPORTS = [
  { id: "performance", label: "Wyniki" },
  { id: "yearly", label: "Roczne zwroty" },
  { id: "income", label: "Dochód pasywny" },
  { id: "personalIncome", label: "Zarobki" },
  { id: "allocation", label: "Alokacja" },
] as const;
type ReportId = (typeof REPORTS)[number]["id"];

function Kpi({ label, value, sub, color = INK }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ ...card, padding: "18px 20px" }}>
      <div style={{ fontFamily: UI, fontSize: 10.5, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: ".10em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 500, color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub && <div style={{ fontFamily: UI, fontSize: 12, color: MUTED, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: UI, fontSize: 10.5, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: ".10em" }}>{children}</div>
  );
}

export function ReportsPage() {
  const storeSnapshot = useDisplaySnapshot();
  const isDemo = !storeSnapshot;
  const snapshot = storeSnapshot ?? sampleSnapshot;
  const { displayCurrency } = useProfile();
  // Demo/sample numbers are illustrative PLN, so only label real data in the
  // chosen currency.
  const ccy = isDemo ? "PLN" : displayCurrency;
  useSampleDataSignal(isDemo);
  const [report, setReport] = useState<ReportId>("performance");

  const perf = snapshot.performanceSeries.length >= 2 ? snapshot.performanceSeries : snapshot.valuationSeries;
  const metrics = snapshot.metrics;
  const cashflows = snapshot.cashflows;
  const personalIncome = snapshot.income;
  const monthlyStats = useMemo(() => calcMonthlyStats(perf), [perf]);
  const yearlyReturns = useMemo(() => calcYearlyReturns(perf), [perf]);

  const asOfLabel = new Date(snapshot.asOf).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
  const absGain = snapshot.totalValue - metrics.netInvested;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: UI, color: INK }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, padding: "2px 2px 0" }}>
        <div>
          <div style={{ fontFamily: UI, fontSize: 10.5, fontWeight: 700, letterSpacing: ".13em", textTransform: "uppercase", color: SUBTLE }}>Analiza</div>
          <div style={{ fontFamily: SERIF, fontSize: 31, fontWeight: 500, color: INK, letterSpacing: "-.01em", marginTop: 3 }}>Raporty</div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
            {isDemo ? "Tryb demo · " : ""}Dane na {asOfLabel} · zwroty liczone metodą ważoną czasem (bez wpłat)
          </div>
        </div>
      </div>

      {/* Report-type selector */}
      <div style={{ display: "inline-flex", flexWrap: "wrap", gap: 6, background: v2Mix(V2.ink, 0.05), borderRadius: 11, padding: 4, alignSelf: "flex-start" }}>
        {REPORTS.map((item) => (
          <button
            key={item.id}
            onClick={() => setReport(item.id)}
            style={{
              padding: "7px 15px", borderRadius: 8, border: "none", cursor: "pointer",
              fontFamily: UI, fontSize: 12.5, fontWeight: report === item.id ? 700 : 500,
              background: report === item.id ? V2.card : "transparent",
              color: report === item.id ? INK : MUTED,
              boxShadow: report === item.id ? `0 1px 4px ${v2Mix(V2.ink, 0.1)}` : "none",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {report === "performance" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
            <Kpi label="Łączny zwrot (TWR)" value={fmtPct(metrics.totalReturnPct)} sub={`${absGain >= 0 ? "+" : ""}${fmt(absGain)} ${ccy} ponad wpłaty`} color={metrics.totalReturnPct >= 0 ? PROFIT : LOSS} />
            <Kpi label="MWR · XIRR" value={metrics.xirrPct == null ? "—" : fmtPct(metrics.xirrPct)} sub="rocznie, ważony kapitałem" color={(metrics.xirrPct ?? 0) >= 0 ? PROFIT : LOSS} />
            <Kpi label="Maks. obsunięcie" value={`${fmt(metrics.maxDrawdownPct, 2)}%`} sub="od szczytu" color={LOSS} />
            <Kpi label="Wartość portfela" value={fmt(snapshot.totalValue)} sub={ccy} />
          </div>

          <div style={{ ...card, padding: "22px 22px 18px" }}>
            <div style={{ marginBottom: 14 }}>
              <SectionHead>Wzrost 100 (TWR, bez wpłat)</SectionHead>
              <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
                {perf.length} punktów · {perf.length > 0 && new Date(perf[0].date).toLocaleDateString("pl-PL", { month: "long", year: "numeric" })} → {asOfLabel}
              </div>
            </div>
            <AreaChart data={perf} height={220} color={V2.brand} />
          </div>

          {monthlyStats.best && monthlyStats.worst && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <Kpi label="Najlepszy miesiąc" value={fmtPct(monthlyStats.best.pct)} sub={monthlyStats.best.label} color={PROFIT} />
              <Kpi label="Najgorszy miesiąc" value={fmtPct(monthlyStats.worst.pct)} sub={monthlyStats.worst.label} color={LOSS} />
              <div style={{ ...card, padding: "18px 20px" }}>
                <div style={{ fontFamily: UI, fontSize: 10.5, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: ".10em", marginBottom: 8 }}>Miesiące z zyskiem</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 500, color: PROFIT }}>{monthlyStats.positive}</span>
                  <span style={{ fontSize: 14, color: SUBTLE }}>/ {monthlyStats.total}</span>
                </div>
                <div style={{ display: "flex", borderRadius: 4, overflow: "hidden", marginTop: 8, height: 6 }}>
                  <div style={{ flex: monthlyStats.positive, background: PROFIT, minWidth: monthlyStats.positive > 0 ? 4 : 0 }} />
                  <div style={{ flex: monthlyStats.negative, background: LOSS, minWidth: monthlyStats.negative > 0 ? 4 : 0 }} />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {report === "yearly" && (
        <div style={{ ...card, padding: 0 }}>
          <div style={{ padding: "16px 22px 12px", borderBottom: `0.5px solid ${LINE_SOFT}` }}>
            <SectionHead>Zwrot rok do roku (ważony czasem)</SectionHead>
          </div>
          {yearlyReturns.length === 0 ? (
            <div style={{ padding: "28px 22px", textAlign: "center", fontSize: 13, color: SUBTLE }}>Za mało danych historycznych.</div>
          ) : (
            yearlyReturns.map((yr, i) => {
              const isPos = yr.returnPct >= 0;
              return (
                <div key={yr.year} style={{ display: "grid", gridTemplateColumns: "90px 1fr 110px", padding: "14px 22px", borderTop: i === 0 ? "none" : `0.5px solid ${LINE_SOFT}`, alignItems: "center", gap: 12 }}>
                  <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 500, color: INK }}>{yr.year}</div>
                  <div style={{ height: 8, borderRadius: 4, background: v2Mix(V2.ink, 0.06), position: "relative", overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(Math.abs(yr.returnPct) * 2.5, 100)}%`, height: "100%", borderRadius: 4, background: isPos ? PROFIT : LOSS }} />
                  </div>
                  <div style={{ textAlign: "right", fontFamily: SERIF, fontSize: 17, fontWeight: 500, color: isPos ? PROFIT : LOSS }}>{fmtPct(yr.returnPct)}</div>
                </div>
              );
            })
          )}
        </div>
      )}

      {report === "income" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
            <Kpi label="Dywidendy" value={`+${fmt(cashflows.dividends)} ${ccy}`} color={PROFIT} />
            <Kpi label="Odsetki / kupony" value={`+${fmt(cashflows.interest)} ${ccy}`} color={V2.bonds} />
            <Kpi label="Prowizje" value={`-${fmt(cashflows.fees)} ${ccy}`} color={LOSS} />
            <Kpi label="Podatki" value={`-${fmt(cashflows.taxes)} ${ccy}`} color={LOSS} />
          </div>
          <div style={{ ...card, padding: "20px 22px" }}>
            <SectionHead>Dochód pasywny netto</SectionHead>
            {(() => {
              const net = cashflows.dividends + cashflows.interest - cashflows.fees - cashflows.taxes;
              return (
                <div style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 500, marginTop: 8, color: net >= 0 ? PROFIT : LOSS }}>
                  {net >= 0 ? "+" : ""}{fmt(net)} {ccy}
                </div>
              );
            })()}
            <div style={{ fontSize: 12.5, color: MUTED, marginTop: 6 }}>
              Dywidendy i odsetki pomniejszone o prowizje i podatki. Wpłaty/wypłaty kapitału nie są wliczane do dochodu.
            </div>
          </div>
        </>
      )}

      {report === "personalIncome" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
            <Kpi label="Zarobki" value={`+${fmt(personalIncome.earningsPLN)} ${ccy}`} sub={`${personalIncome.earningCount} rekordów`} color={PROFIT} />
            <Kpi label="Obciążenia" value={`-${fmt(personalIncome.burdensPLN)} ${ccy}`} sub={`${personalIncome.burdenCount} rekordów`} color={LOSS} />
            <Kpi label="Netto" value={`${personalIncome.netPLN >= 0 ? "+" : ""}${fmt(personalIncome.netPLN)} ${ccy}`} color={personalIncome.netPLN >= 0 ? PROFIT : LOSS} />
            <Kpi label="Razem wpisów" value={fmt(personalIncome.earningCount + personalIncome.burdenCount)} sub="income z sync" />
          </div>
          <div style={{ ...card, padding: "20px 22px" }}>
            <SectionHead>Zarobki i obciążenia</SectionHead>
            <div style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 500, marginTop: 8, color: personalIncome.netPLN >= 0 ? PROFIT : LOSS }}>
              {personalIncome.netPLN >= 0 ? "+" : ""}{fmt(personalIncome.netPLN)} {ccy}
            </div>
            <div style={{ fontSize: 12.5, color: MUTED, marginTop: 6 }}>
              Suma rekordów zarobków i obciążeń zsynchronizowanych z macOS. Nie jest mieszana z gotówką portfela.
            </div>
          </div>
        </>
      )}

      {report === "allocation" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
          <div style={{ ...card, padding: "22px 22px 18px" }}>
            <div style={{ marginBottom: 14 }}><SectionHead>Alokacja aktywów</SectionHead></div>
            <AllocationDonut slices={snapshot.allocation} />
          </div>
          <div style={{ ...card, padding: 0 }}>
            <div style={{ padding: "16px 22px 10px", borderBottom: `0.5px solid ${LINE_SOFT}` }}><SectionHead>Podział alokacji</SectionHead></div>
            {snapshot.allocation.length === 0 ? (
              <div style={{ padding: "24px 22px", textAlign: "center", fontSize: 13, color: SUBTLE }}>Brak danych alokacji</div>
            ) : (
              snapshot.allocation.map((slice, i) => {
                const COLORS = [V2.equity, V2.bonds, V2.gold, V2.deposit, V2.profit, V2.cash];
                const color = COLORS[i % COLORS.length];
                return (
                  <div key={slice.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 22px", borderTop: `0.5px solid ${LINE_SOFT}`, gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0, display: "block" }} />
                      <span style={{ fontSize: 13, color: INK, fontWeight: 500 }}>{slice.label}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 80, height: 4, borderRadius: 2, background: v2Mix(V2.ink, 0.08) }}>
                        <div style={{ width: `${slice.percent}%`, height: "100%", borderRadius: 2, background: color }} />
                      </div>
                      <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums", minWidth: 48, textAlign: "right" }}>
                        {slice.percent.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
