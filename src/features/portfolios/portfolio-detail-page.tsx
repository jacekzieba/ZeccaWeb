"use client";

import Link from "next/link";
import { use, useMemo, type CSSProperties } from "react";
import { useSyncStore } from "@/sync/store/sync-store";
import { buildPortfolioDetail } from "@/sync/records/investor-snapshot";
import { AreaChart } from "@/components/charts/area-chart";

const INK = "#1C3144";
const MUTED = "rgba(28,49,68,0.58)";
const SUBTLE = "rgba(28,49,68,0.38)";
const LINE_SOFT = "rgba(28,49,68,0.06)";
const PROFIT = "#2D9C6B";

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

function fmtQty(n: number) {
  if (Number.isInteger(n)) return fmt(n);
  return n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

const KIND_LABELS: Record<string, string> = {
  stock: "Akcja",
  etf: "ETF",
  treasuryBond: "Obligacja skarbowa",
  listedBond: "Obligacja giełdowa",
  crypto: "Kryptowaluta",
  deposit: "Lokata",
  cash: "Gotówka",
};

const KIND_COLORS: Record<string, string> = {
  stock: "#34699A",
  etf: "#2D9C6B",
  treasuryBond: "#8A7A3C",
  listedBond: "#7EA16B",
  crypto: "#9B6BC4",
  deposit: "#C97B30",
  cash: "#5E6C84",
};

export function PortfolioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const records = useSyncStore((s) => s.records);
  const marketFxRates = useSyncStore((s) => s.marketFxRates);

  const detail = useMemo(
    () => (records ? buildPortfolioDetail(records, id, { fxRates: marketFxRates }) : null),
    [records, id, marketFxRates],
  );

  if (!records) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Breadcrumb name="—" />
        <div style={{ ...glassCard, padding: "48px 22px", textAlign: "center" }}>
          <div style={{ fontSize: 32, opacity: 0.12, marginBottom: 12 }}>◎</div>
          <div style={{ fontSize: 14, color: SUBTLE }}>
            Odblokuj dane w panelu synchronizacji
          </div>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Breadcrumb name="Nieznany portfel" />
        <div style={{ ...glassCard, padding: "48px 22px", textAlign: "center" }}>
          <div style={{ fontSize: 14, color: SUBTLE }}>Portfel nie istnieje lub nie zawiera danych.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Breadcrumb name={detail.name} />

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <div style={{ ...glassCard, padding: "18px 20px" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: ".10em", marginBottom: 6 }}>
            Wartość portfela
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>
            {fmt(detail.totalValue)}{" "}
            <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.6 }}>{detail.baseCurrency}</span>
          </div>
        </div>
        <div style={{ ...glassCard, padding: "18px 20px" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: ".10em", marginBottom: 6 }}>
            Pozycji
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: INK }}>{detail.holdings.length}</div>
        </div>
        <div style={{ ...glassCard, padding: "18px 20px" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: ".10em", marginBottom: 6 }}>
            Gotówka
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>
            {fmt(detail.cashValue)}{" "}
            <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.6 }}>{detail.baseCurrency}</span>
          </div>
        </div>
      </div>

      {/* Valuation chart */}
      {detail.valuationSeries.length > 1 && (
        <div style={{ ...glassCard, padding: "22px 22px 18px" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: ".10em", marginBottom: 14 }}>
            Historia wartości
          </div>
          <AreaChart data={detail.valuationSeries} height={180} />
        </div>
      )}

      {/* Holdings table */}
      <div style={{ ...glassCard, padding: 0 }}>
        <div
          style={{
            padding: "16px 22px 12px",
            borderBottom: `0.5px solid ${LINE_SOFT}`,
          }}
        >
          <div style={{ fontSize: 10.5, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: ".10em" }}>
            Pozycje ({detail.holdings.length})
          </div>
        </div>

        {/* Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,2.5fr) minmax(0,0.8fr) minmax(0,1fr) minmax(0,1.2fr) minmax(0,0.8fr)",
            padding: "10px 22px",
            background: "rgba(28,49,68,0.025)",
          }}
        >
          {["Instrument", "Ilość", "Cena", "Wartość", "Udział"].map((h, i) => (
            <div
              key={h}
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: SUBTLE,
                textTransform: "uppercase",
                letterSpacing: ".08em",
                textAlign: i === 0 ? "left" : "right",
              }}
            >
              {h}
            </div>
          ))}
        </div>

        {detail.holdings.length === 0 && (
          <div style={{ padding: "32px 22px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: SUBTLE }}>Brak otwartych pozycji</div>
          </div>
        )}

        {detail.holdings.map((h) => {
          const color = KIND_COLORS[h.kind] ?? SUBTLE;
          const kindLabel = KIND_LABELS[h.kind] ?? h.kind;

          return (
            <div
              key={h.instrumentId}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,2.5fr) minmax(0,0.8fr) minmax(0,1fr) minmax(0,1.2fr) minmax(0,0.8fr)",
                padding: "14px 22px",
                borderTop: `0.5px solid ${LINE_SOFT}`,
                alignItems: "center",
                transition: "background .12s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(28,49,68,0.025)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {/* Instrument */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: `${color}14`,
                    border: `1.5px solid ${color}30`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 800,
                    color,
                    flexShrink: 0,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {h.symbol.slice(0, 3).toUpperCase()}
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>{h.name}</div>
                  <div style={{ fontSize: 11, color: SUBTLE }}>
                    {h.symbol} · <span style={{ color: `${color}CC` }}>{kindLabel}</span>
                  </div>
                </div>
              </div>

              {/* Quantity */}
              <div style={{ textAlign: "right", fontSize: 13, color: INK, fontVariantNumeric: "tabular-nums" }}>
                {fmtQty(h.quantity)}
              </div>

              {/* Last price */}
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, color: INK, fontVariantNumeric: "tabular-nums" }}>
                  {h.lastPrice > 0 ? fmt(h.lastPrice, 2) : "—"}
                </div>
                <div style={{ fontSize: 10, color: SUBTLE }}>{h.currency}</div>
              </div>

              {/* Market value */}
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>
                  {fmt(h.marketValue)}{" "}
                  <span style={{ fontSize: 10, opacity: 0.5 }}>PLN</span>
                </div>
              </div>

              {/* Portfolio % + bar */}
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, color: MUTED, fontVariantNumeric: "tabular-nums" }}>
                  {h.portfolioPercent.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                </div>
                <div
                  style={{
                    width: "100%",
                    height: 3,
                    borderRadius: 2,
                    background: "rgba(28,49,68,0.08)",
                    marginTop: 4,
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(h.portfolioPercent, 100)}%`,
                      height: "100%",
                      borderRadius: 2,
                      background: color,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cash balances */}
      {detail.cashBalances.length > 0 && (
        <div style={{ ...glassCard, padding: 0 }}>
          <div
            style={{
              padding: "16px 22px 12px",
              borderBottom: `0.5px solid ${LINE_SOFT}`,
            }}
          >
            <div style={{ fontSize: 10.5, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: ".10em" }}>
              Środki pieniężne
            </div>
          </div>
          {detail.cashBalances.map((cb) => (
            <div
              key={cb.currency}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 22px",
                borderTop: `0.5px solid ${LINE_SOFT}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: `${PROFIT}14`,
                    border: `1.5px solid ${PROFIT}30`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 800,
                    color: PROFIT,
                  }}
                >
                  {cb.currency.slice(0, 3)}
                </span>
                <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{cb.currency}</div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>
                {fmt(cb.amount, 2)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Breadcrumb({ name }: { name: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 2px 4px" }}>
      <Link
        href="/portfolios"
        style={{ fontSize: 13, color: MUTED, fontWeight: 500, textDecoration: "none" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = INK)}
        onMouseLeave={(e) => (e.currentTarget.style.color = MUTED)}
      >
        Portfele
      </Link>
      <span style={{ color: SUBTLE, fontSize: 13 }}>›</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{name}</span>
    </div>
  );
}
