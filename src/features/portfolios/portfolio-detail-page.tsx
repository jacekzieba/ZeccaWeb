"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useSyncStore } from "@/sync/store/sync-store";
import { useProfile } from "@/features/profile/profile-store";
import { buildPortfolioDetail } from "@/sync/records/investor-snapshot";
import { AreaChart } from "@/components/charts/area-chart";
import type { CashBalance, HoldingRow, ValuationPoint } from "@/domain/models/investor-data";
import { TYPOGRAPHY } from "@/lib/design-tokens";
import {
  groupTreasuryBondSeries,
  treasuryBondFamilyLabel,
  type GroupedTreasuryBondFamily,
} from "@/domain/bonds/bond-series-groups";
import {
  getKpiTiles,
  KPI_TILE_META,
  KpiCard,
  type KpiTileId,
} from "@/components/metrics/portfolio-kpi-strip";
import { ValueVsDepositsChart } from "@/components/charts/value-vs-deposits-chart";
import {
  useSectionCustomization,
  type SectionDef,
  type SectionRegistry,
  type SectionSize,
} from "@/components/customize/section-customization";
import {
  SectionCustomizePanel,
  type SectionPanelTheme,
} from "@/components/customize/section-customize-panel";
import { SectionGrid } from "@/components/customize/section-grid";
import {
  BadgeDollarSign,
  BadgePercent,
  Banknote,
  BriefcaseBusiness,
  ChartArea,
  ChartLine,
  ChartNoAxesColumnDecreasing,
  ChartNoAxesCombined,
  CircleDollarSign,
  CircleGauge,
  ClipboardList,
  Coins,
  Landmark,
  LayoutDashboard,
  Wallet,
} from "lucide-react";

const PERIOD_OPTIONS = ["1M", "3M", "6M", "1Y", "2Y", "MAX"] as const;
type Period = (typeof PERIOD_OPTIONS)[number];
const PERIOD_MONTHS: Record<Period, number> = { "1M": 1, "3M": 3, "6M": 6, "1Y": 12, "2Y": 24, MAX: 0 };

function filterSeriesByPeriod(series: ValuationPoint[], period: Period) {
  if (period === "MAX" || series.length <= 2) return series;
  const last = series[series.length - 1];
  const cutoff = new Date(last.date);
  cutoff.setMonth(cutoff.getMonth() - PERIOD_MONTHS[period]);
  const filtered = series.filter((p) => new Date(p.date).getTime() >= cutoff.getTime());
  return filtered.length >= 2 ? filtered : series.slice(-2);
}

function useMedia(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

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

// --- Registry & theme ---

const PD_KPI_ICONS: Record<string, typeof ChartLine> = {
  kpiValue: LayoutDashboard,
  kpiCash: Coins,
  kpiUnrealized: ChartLine,
  kpiXirr: BadgePercent,
  kpiTwr: CircleGauge,
  kpiCagr: ChartNoAxesCombined,
  kpiRealReturn: CircleDollarSign,
  kpiMaxDd: ChartNoAxesColumnDecreasing,
  kpiRealized: BadgeDollarSign,
  kpiInvested: Landmark,
  kpiDividends: Coins,
  kpiOpenPositions: BriefcaseBusiness,
};

const KPI_SIZE: SectionSize[] = [{ width: 1 }, { width: 2 }];

const PD_SECTIONS: SectionDef<string>[] = [
  { id: "kpiValue", label: "Wartość portfela", desc: "Łączna wartość portfela.", category: "metrics", icon: LayoutDashboard, sizePresets: KPI_SIZE },
  { id: "kpiCash", label: "Gotówka", desc: "Saldo środków pieniężnych.", category: "metrics", icon: Coins, sizePresets: KPI_SIZE },
  ...KPI_TILE_META.map((t) => ({ id: t.id, label: t.label, desc: t.desc, category: "metrics", icon: PD_KPI_ICONS[t.id], sizePresets: KPI_SIZE })),
  { id: "history", label: "Historia wartości", desc: "Wykres wartości z wyborem zakresu.", category: "charts", icon: ChartArea, sizePresets: [{ width: 4 }, { width: 2 }] },
  { id: "valueVsDeposits", label: "Wartość vs wpłaty", desc: "Wartość konta na tle wpłat.", category: "charts", icon: ChartNoAxesCombined, sizePresets: [{ width: 4 }, { width: 2 }] },
  { id: "holdings", label: "Pozycje", desc: "Tabela instrumentów w portfelu.", category: "data", icon: Wallet, sizePresets: [{ width: 4 }, { width: 3 }, { width: 2 }] },
  { id: "cash", label: "Środki pieniężne", desc: "Salda gotówkowe wg waluty.", category: "data", icon: Banknote, sizePresets: [{ width: 4 }, { width: 2 }] },
];

const PD_REGISTRY: SectionRegistry<string> = {
  storageKey: "zecca.portfolio-detail.sections.v1",
  categoryOrder: ["metrics", "charts", "data"],
  categories: [
    { id: "metrics", label: "Wskaźniki", desc: "KPI portfela i zwrotu.", icon: CircleGauge },
    { id: "charts", label: "Wykresy", desc: "Wizualizacje wartości.", icon: ChartArea },
    { id: "data", label: "Dane", desc: "Pozycje i środki pieniężne.", icon: ClipboardList },
  ],
  sections: PD_SECTIONS,
};

const PD_THEME: SectionPanelTheme = {
  card: "#FFFDF9",
  ink: "#1C3144",
  brand: "#34699A",
  muted: "rgba(28,49,68,0.58)",
  subtle: "rgba(28,49,68,0.38)",
  line: "rgba(28,49,68,0.10)",
  fontUi: TYPOGRAPHY.system,
  fontSerif: TYPOGRAPHY.serif,
  fontMono: TYPOGRAPHY.mono,
};

// --- Sub-components ---

function HistoryCard({
  detail,
  period,
  onPeriodChange,
  chartSeries,
}: {
  detail: { valuationSeries: ValuationPoint[] };
  period: Period;
  onPeriodChange: (p: Period) => void;
  chartSeries: ValuationPoint[];
}) {
  if (detail.valuationSeries.length <= 1) return null;
  return (
    <div style={{ ...glassCard, padding: "22px 22px 18px", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: ".10em" }}>
          Historia wartości · {period === "MAX" ? "maksimum" : period}
        </div>
        <div style={{ display: "inline-flex", background: "rgba(28,49,68,0.06)", borderRadius: 11, padding: 3 }}>
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option}
              onClick={() => onPeriodChange(option)}
              style={{
                padding: "5px 12px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontFamily: TYPOGRAPHY.system,
                fontSize: 11.5,
                fontWeight: period === option ? 700 : 500,
                background: period === option ? "#FFFDF9" : "transparent",
                color: period === option ? INK : MUTED,
                boxShadow: period === option ? "0 1px 4px rgba(28,49,68,0.12)" : "none",
                transition: "all .15s",
              }}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      <AreaChart data={chartSeries} height={200} />
    </div>
  );
}

function HoldingsCard({
  rows,
  groupedCount,
  expandedFamilies,
  toggleFamily,
  displayCurrency,
}: {
  rows: { holding: HoldingRow; family: GroupedTreasuryBondFamily | null; depth: number }[];
  groupedCount: number;
  expandedFamilies: Set<GroupedTreasuryBondFamily>;
  toggleFamily: (family: GroupedTreasuryBondFamily) => void;
  displayCurrency: string;
}) {
  return (
    <div style={{ ...glassCard, padding: 0, height: "100%" }}>
      <div
        style={{
          padding: "16px 22px 12px",
          borderBottom: `0.5px solid ${LINE_SOFT}`,
        }}
      >
        <div style={{ fontSize: 10.5, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: ".10em" }}>
          Pozycje ({groupedCount})
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

      {rows.length === 0 && (
        <div style={{ padding: "32px 22px", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: SUBTLE }}>Brak otwartych pozycji</div>
        </div>
      )}

      {rows.map(({ holding: h, family, depth }) => {
        const color = KIND_COLORS[h.kind] ?? SUBTLE;
        const kindLabel = KIND_LABELS[h.kind] ?? h.kind;
        const isGroup = family !== null;

        return (
          <div
            key={h.instrumentId}
            onClick={isGroup ? () => toggleFamily(family!) : undefined}
            onKeyDown={isGroup ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleFamily(family!);
              }
            } : undefined}
            role={isGroup ? "button" : undefined}
            tabIndex={isGroup ? 0 : undefined}
            aria-expanded={isGroup ? expandedFamilies.has(family!) : undefined}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,2.5fr) minmax(0,0.8fr) minmax(0,1fr) minmax(0,1.2fr) minmax(0,0.8fr)",
              padding: `14px 22px 14px ${depth ? 42 : 22}px`,
              borderTop: `0.5px solid ${LINE_SOFT}`,
              alignItems: "center",
              transition: "background .12s",
              cursor: isGroup ? "pointer" : "default",
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
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>{h.name}</div>
                <div style={{ fontSize: 11, color: SUBTLE }}>
                  {h.symbol} · <span style={{ color: `${color}CC` }}>{kindLabel}</span>
                </div>
              </div>
              {isGroup && <span aria-hidden="true" style={{ marginLeft: "auto", color, flexShrink: 0 }}>{expandedFamilies.has(family!) ? "⌄" : "›"}</span>}
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
              <div style={{ fontSize: 10, color: SUBTLE }}>
                {h.currency} · {h.valuationSourceLabel}
              </div>
            </div>

            {/* Market value */}
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>
                {fmt(h.marketValue)}{" "}
                <span style={{ fontSize: 10, opacity: 0.5 }}>{displayCurrency}</span>
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
  );
}

function CashCard({ balances }: { balances: CashBalance[] }) {
  return (
    <div style={{ ...glassCard, padding: 0, height: "100%" }}>
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
      {balances.map((cb) => (
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
  );
}

export function PortfolioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const records = useSyncStore((s) => s.records);
  const marketFxRates = useSyncStore((s) => s.marketFxRates);
  const { displayCurrency } = useProfile();

  const detail = useMemo(
    () =>
      records
        ? buildPortfolioDetail(records, id, {
            asOf: new Date(),
            fxRates: marketFxRates,
            useLatestTransactionFxRate: true,
            useMarketQuotes: true,
            displayCurrency,
          })
        : null,
    [records, id, marketFxRates, displayCurrency],
  );
  const [period, setPeriod] = useState<Period>("1Y");
  const chartSeries = useMemo(
    () => (detail ? filterSeriesByPeriod(detail.valuationSeries, period) : []),
    [detail, period],
  );
  const groupedHoldings = useMemo(
    () => groupTreasuryBondSeries(detail?.holdings ?? []),
    [detail],
  );
  const [expandedFamilies, setExpandedFamilies] = useState<Set<GroupedTreasuryBondFamily>>(() => new Set());

  const isMobile = useMedia("(max-width: 720px)");
  const isTablet = useMedia("(max-width: 1140px)");
  const [showCustomize, setShowCustomize] = useState(false);
  const { config, toggle, move, resize, reset } = useSectionCustomization(PD_REGISTRY);
  const visibleSections = new Set(config.visibleSections);
  const orderedVisibleSections = config.sectionOrder.filter((s) => visibleSections.has(s));
  const sizeOf = (id: string) =>
    config.sectionSizes[id] ?? PD_REGISTRY.sections.find((s) => s.id === id)!.sizePresets[0];

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

  const holdingRows = groupedHoldings.flatMap((entry) => {
    if (entry.type === "item") return [{ holding: entry.item, family: null, depth: 0 }];
    const holding: HoldingRow = {
      instrumentId: `bond-family-${entry.family}`,
      symbol: entry.family,
      name: `${treasuryBondFamilyLabel(entry.family)} · ${entry.items.length} ${entry.items.length === 1 ? "seria" : "serie"}`,
      kind: "treasuryBond",
      quantity: entry.items.reduce((sum, item) => sum + item.quantity, 0),
      lastPrice: 0,
      currency: "PLN",
      valuationSource: "treasuryBond",
      valuationSourceLabel: `${entry.items.length} ${entry.items.length === 1 ? "seria" : "serie"}`,
      marketValue: entry.items.reduce((sum, item) => sum + item.marketValue, 0),
      portfolioPercent: entry.items.reduce((sum, item) => sum + item.portfolioPercent, 0),
    };
    const parent = { holding, family: entry.family, depth: 0 };
    return expandedFamilies.has(entry.family)
      ? [parent, ...entry.items.map((item) => ({ holding: item, family: null, depth: 1 }))]
      : [parent];
  });

  const toggleFamily = (family: GroupedTreasuryBondFamily) => {
    setExpandedFamilies((current) => {
      const next = new Set(current);
      if (next.has(family)) next.delete(family);
      else next.add(family);
      return next;
    });
  };

  const kpiById = new Map(
    getKpiTiles({
      metrics: detail.metrics,
      cashflows: detail.cashflows,
      totalValue: detail.totalValue,
      openPositions: detail.holdings.length,
      currency: displayCurrency,
    }).map((tile) => [tile.id, tile]),
  );

  const renderSection = (id: string) => {
    if (id === "kpiValue") return <KpiCard label="Wartość portfela" value={`${fmt(detail.totalValue)} ${displayCurrency}`} />;
    if (id === "kpiCash") return <KpiCard label="Gotówka" value={`${fmt(detail.cashValue)} ${displayCurrency}`} />;
    const kpi = kpiById.get(id as KpiTileId);
    if (kpi) return <KpiCard label={kpi.label} value={kpi.value} sub={kpi.sub} color={kpi.color} />;
    if (id === "history") return (
      <HistoryCard
        detail={detail}
        period={period}
        onPeriodChange={setPeriod}
        chartSeries={chartSeries}
      />
    );
    if (id === "valueVsDeposits") return (
      <div style={{ ...glassCard, padding: "22px 22px 18px", height: "100%" }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: ".10em", marginBottom: 14 }}>Wartość konta na tle wpłat</div>
        <ValueVsDepositsChart value={detail.valuationSeries} deposits={detail.netInvestedSeries} currency={displayCurrency} height={210} />
      </div>
    );
    if (id === "holdings") return (
      <HoldingsCard
        rows={holdingRows}
        groupedCount={groupedHoldings.length}
        expandedFamilies={expandedFamilies}
        toggleFamily={toggleFamily}
        displayCurrency={displayCurrency}
      />
    );
    if (id === "cash") return detail.cashBalances.length > 0 ? <CashCard balances={detail.cashBalances} /> : null;
    return null;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
        <Breadcrumb name={detail.name} />
        <button
          type="button"
          onClick={() => setShowCustomize((v) => !v)}
          aria-expanded={showCustomize}
          style={{
            border: `0.5px solid ${PD_THEME.line}`,
            borderRadius: 10,
            background: showCustomize ? "rgba(52,105,154,0.10)" : "#FFFDF9",
            color: showCustomize ? PD_THEME.brand : INK,
            cursor: "pointer",
            fontFamily: TYPOGRAPHY.system,
            fontSize: 12.5,
            fontWeight: 700,
            padding: "8px 13px",
          }}
        >
          Dostosuj
        </button>
      </div>

      {showCustomize && (
        <SectionCustomizePanel
          registry={PD_REGISTRY}
          config={config}
          visibleSections={visibleSections}
          onToggle={toggle}
          onMove={move}
          onResize={resize}
          onReset={reset}
          theme={PD_THEME}
          eyebrow="Portfel"
          title="Układ sekcji"
          subtitle="Web zapisuje widoczność, kolejność i preset rozmiaru w tej przeglądarce."
        />
      )}

      <SectionGrid
        orderedVisibleSections={orderedVisibleSections}
        sizeOf={sizeOf}
        renderSection={renderSection}
        isMobile={isMobile}
        isTablet={isTablet}
        testIdPrefix="portfolio-detail"
      />
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
