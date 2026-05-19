"use client";

import { useState, type CSSProperties } from "react";
import { AreaChart } from "@/components/charts/area-chart";
import { AllocationDonut } from "@/components/charts/allocation-donut";
import { StatCard } from "@/components/ui/stat-card";
import { sampleSnapshot, SAMPLE_HISTORY } from "./sample-data";
import { useSyncStore } from "@/sync/store/sync-store";
import { summarizeDecryptedRecords } from "@/sync/records/sync-summary";
import { CHART_COLORS, COLORS, SURFACES } from "@/lib/design-tokens";

const glassCard: CSSProperties = {
  ...SURFACES.glassCard,
};

function fmt(n: number, d = 0) {
  return n.toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${fmt(n, 2)}%`;
}

// ── Period selector ──────────────────────────────────────────────
const PERIOD_OPTIONS = ["1M", "3M", "6M", "1Y", "2Y", "MAX"] as const;
type Period = (typeof PERIOD_OPTIONS)[number];

const PERIOD_MONTHS: Record<Period, number> = {
  "1M": 1, "3M": 3, "6M": 6, "1Y": 12, "2Y": 24, MAX: 24,
};

function PeriodBar({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div
      style={{
        display: "inline-flex",
        gap: 0,
        background: COLORS.surfaceAlt,
        borderRadius: 11,
        padding: 3,
      }}
    >
      {PERIOD_OPTIONS.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          style={{
            padding: "5px 12px",
            borderRadius: 9,
            border: "none",
            background: value === opt ? COLORS.surface : "transparent",
            color: value === opt ? COLORS.text : COLORS.textMuted,
            fontSize: 11.5,
            fontWeight: value === opt ? 700 : 500,
            cursor: "pointer",
            boxShadow: value === opt ? `inset 0 0 0 1px ${COLORS.border}` : "none",
            transition: "all .15s",
            fontFamily: "inherit",
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ── Holdings row ─────────────────────────────────────────────────
const PORTFOLIO_COLORS: Record<string, string> = {
  ike: COLORS.plum,
  bond: CHART_COLORS.benchmark,
  core: CHART_COLORS.comparison,
  growth: COLORS.other,
  cash: CHART_COLORS.cash,
};

// ── Main dashboard ───────────────────────────────────────────────
export function DashboardOverview() {
  const storeSnapshot = useSyncStore((s) => s.snapshot);
  const records = useSyncStore((s) => s.records);
  const [period, setPeriod] = useState<Period>("1Y");

  const snapshot = storeSnapshot ?? sampleSnapshot;
  const syncSummary = records ? summarizeDecryptedRecords(records) : null;
  const isDemo = !syncSummary;

  // Full history for the area chart
  const historySource = storeSnapshot ? snapshot.valuationSeries : SAMPLE_HISTORY;
  const chartData = historySource.slice(-PERIOD_MONTHS[period]);
  const sparkData = historySource.slice(-12).map((h) => h.value);

  const totalValue = snapshot.totalValue;
  const monthlyChange = snapshot.monthlyChange;
  const cash = snapshot.cash;

  // Status pill
  const now = new Date();
  const timeStr = now.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ── Top status strip ──────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          padding: "0 2px 4px",
        }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.text, letterSpacing: "-0.01em" }}>
            Dashboard
          </div>
          <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>{dateStr}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 11px",
              borderRadius: 99,
              background: isDemo ? "rgba(182,154,87,0.14)" : "rgba(32,122,80,0.12)",
              color: isDemo ? COLORS.gold : COLORS.profit,
              fontSize: 11.5,
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: isDemo ? COLORS.gold : COLORS.profit,
              }}
            />
            {isDemo ? "Tryb demo" : `Zsynchronizowano · ${timeStr}`}
          </span>
        </div>
      </div>

      {/* ── KPI tiles ─────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        <StatCard
          label="Wartość portfela"
          value={<>{fmt(totalValue)} <span style={{ fontSize: 14, fontWeight: 500, opacity: 0.65 }}>PLN</span></>}
          sub={
            <>
              <span style={{ color: monthlyChange >= 0 ? COLORS.profit : COLORS.loss, fontWeight: 600 }}>
                {fmtPct(monthlyChange)}
              </span>
              {" "}
              <span style={{ color: COLORS.subtle }}>vs 30 dni temu</span>
            </>
          }
          spark={sparkData}
        />
        <StatCard
          label="Gotówka"
          value={<>{fmt(cash)} <span style={{ fontSize: 14, fontWeight: 500, opacity: 0.65 }}>PLN</span></>}
          sub={<span style={{ color: COLORS.subtle }}>Środki bez sprzedaży aktywów</span>}
        />
        <StatCard
          label="Zmiana miesięczna"
          value={
            <span style={{ color: monthlyChange >= 0 ? COLORS.profit : COLORS.loss }}>
              {fmtPct(monthlyChange)}
            </span>
          }
          sub={<span style={{ color: COLORS.subtle }}>Ostatnie 30 dni</span>}
          accent={monthlyChange >= 0 ? COLORS.profit : COLORS.loss}
        />
        <StatCard
          label="Status sync"
          value={
            <span style={{ fontSize: 20, color: syncSummary ? COLORS.profit : COLORS.gold }}>
              {syncSummary ? `${syncSummary.totalRecords} rek.` : "Demo"}
            </span>
          }
          sub={
            syncSummary ? (
              <>
                <span style={{ color: COLORS.profit }}>Odszyfrowano lokalnie</span>
                <br />
                <span style={{ color: COLORS.subtle }}>
                  {syncSummary.latestUpdatedAt
                    ? new Date(syncSummary.latestUpdatedAt).toLocaleString("pl-PL")
                    : "brak dat"}
                </span>
              </>
            ) : (
              <span style={{ color: COLORS.subtle }}>Podłącz Supabase i odblokuj klucz</span>
            )
          }
          accent={syncSummary ? COLORS.profit : COLORS.gold}
        />
      </div>

      {/* ── Chart + Allocation ────────────────────────────────── */}
      <div className="grid-chart-alloc">
        {/* Area chart */}
        <div style={{ ...glassCard, padding: "22px 22px 18px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 14,
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: COLORS.subtle,
                  textTransform: "uppercase",
                  letterSpacing: ".10em",
                }}
              >
                Historia wartości portfela
              </div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  color: COLORS.text,
                  marginTop: 6,
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: "-0.01em",
                }}
              >
                {fmt(totalValue)}{" "}
                <span style={{ fontSize: 14, fontWeight: 500, opacity: 0.65 }}>PLN</span>
              </div>
            </div>
            <PeriodBar value={period} onChange={setPeriod} />
          </div>
          <AreaChart data={chartData} height={220} />
          <div
            style={{
              display: "flex",
              gap: 18,
              flexWrap: "wrap",
              marginTop: 12,
              paddingTop: 12,
              borderTop: `0.5px solid ${COLORS.lineSoft}`,
              fontSize: 11.5,
            }}
          >
            <span style={{ color: COLORS.muted }}>
              <span style={{ color: CHART_COLORS.portfolio, marginRight: 6 }}>◊</span>
              Wynik realny:{" "}
              <strong style={{ color: CHART_COLORS.portfolio }}>{fmtPct(monthlyChange)}</strong>
            </span>
            <span style={{ color: COLORS.muted }}>
              <span style={{ color: CHART_COLORS.contribution, marginRight: 6 }}>↗</span>
              Inflacja YOY: <strong style={{ color: COLORS.text }}>0,00%</strong>
            </span>
          </div>
        </div>

        {/* Allocation donut */}
        <div style={{ ...glassCard, padding: "22px 22px 18px" }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: COLORS.subtle,
              textTransform: "uppercase",
              letterSpacing: ".10em",
              marginBottom: 14,
            }}
          >
            Alokacja
          </div>
          <AllocationDonut slices={snapshot.allocation} />
        </div>
      </div>

      {/* ── Portfolios + sync summary ─────────────────────────── */}
      <div className="grid-holdings-sync">
        {/* Portfolios table */}
        <div style={{ ...glassCard, padding: 0 }}>
          <div
            style={{
              padding: "18px 22px 12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: `0.5px solid ${COLORS.lineSoft}`,
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: COLORS.subtle,
                textTransform: "uppercase",
                letterSpacing: ".10em",
              }}
            >
              Portfele
            </div>
          </div>

          {/* Table header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,2fr) minmax(0,0.8fr) minmax(0,0.6fr) minmax(0,1.1fr)",
              padding: "10px 22px",
              background: COLORS.textSofter,
            }}
          >
            {["Nazwa", "Waluta", "Pozycje", "Wartość"].map((h, i) => (
              <div
                key={h}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: COLORS.subtle,
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                  textAlign: i === 0 ? "left" : "right",
                }}
              >
                {h}
              </div>
            ))}
          </div>

          {snapshot.portfolios.map((pf) => {
            const color = PORTFOLIO_COLORS[pf.id] || COLORS.subtle;
            const isPos = pf.dailyChange >= 0;
            return (
              <div
                key={pf.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,2fr) minmax(0,0.8fr) minmax(0,0.6fr) minmax(0,1.1fr)",
                  padding: "14px 22px",
                  borderTop: `0.5px solid ${COLORS.lineSoft}`,
                  alignItems: "center",
                  cursor: "pointer",
                  transition: "background .12s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.textSofter)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color, fontSize: 13 }}>●</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{pf.name}</span>
                </div>
                <div style={{ textAlign: "right", fontSize: 13, color: COLORS.muted }}>
                  {pf.baseCurrency}
                </div>
                <div style={{ textAlign: "right", fontSize: 13, color: COLORS.text }}>
                  {pf.positions}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: COLORS.text,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {fmt(pf.value)} PLN
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: isPos ? COLORS.profit : COLORS.loss,
                      fontWeight: 600,
                    }}
                  >
                    {fmtPct(pf.dailyChange)} dziś
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sync record counts */}
        <div style={{ ...glassCard, padding: 0 }}>
          <div
            style={{
              padding: "18px 22px 12px",
              borderBottom: `0.5px solid ${COLORS.lineSoft}`,
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: COLORS.subtle,
                textTransform: "uppercase",
                letterSpacing: ".10em",
              }}
            >
              Rekordy sync
            </div>
          </div>

          {syncSummary ? (
            <div style={{ padding: "8px 0" }}>
              {Object.entries(syncSummary.byType).map(([type, count]) => (
                <div
                  key={type}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 22px",
                    borderTop: `0.5px solid ${COLORS.lineSoft}`,
                    cursor: "default",
                    transition: "background .12s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = COLORS.textSofter)
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <span
                    style={{
                      fontSize: 12.5,
                      color: COLORS.muted,
                      textTransform: "capitalize",
                    }}
                  >
                    {type}
                  </span>
                  <span
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color: COLORS.text,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: "32px 22px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div style={{ fontSize: 28, opacity: 0.15 }}>◯</div>
              <div style={{ fontSize: 13, color: COLORS.subtle, textAlign: "center" }}>
                Odblokuj dane, żeby zobaczyć statystyki rekordów
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
