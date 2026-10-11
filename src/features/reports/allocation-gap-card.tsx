"use client";

import { useMemo } from "react";
import { aggregateTarget, buildAllocationGap, computeActualAllocation, type GapTone } from "@/domain/allocation/allocation-gap";
import { useDisplayCurrency } from "@/features/sync/use-display-currency";
import { useSyncStore } from "@/sync/store/sync-store";
import { buildPortfolioDetail, SYNTHETIC_FALLBACK_ACCOUNT_ID } from "@/sync/records/investor-snapshot";
import { ASSET_CLASSES, readAllocation } from "@/features/portfolios/asset-classes";
import { findAccountRecord } from "@/sync/records/account-record";
import { V2, V2_TYPE, v2Mix } from "@/lib/v2-design";

const TONE_COLOR: Record<GapTone, string> = {
  neutral: V2.muted,
  over: V2.profit,
  under: V2.loss,
};

function pct(n: number) {
  return n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Native "DOCELOWA VS AKTUALNA": current share per asset class against the portfolios' target plan. */
export function AllocationGapCard({ portfolioIds }: { portfolioIds: string[] }) {
  const records = useSyncStore((s) => s.records);
  const marketFxRates = useSyncStore((s) => s.marketFxRates);
  const marketQuotes = useSyncStore((s) => s.marketQuotes);
  const marketCpi = useSyncStore((s) => s.marketCpi);
  const marketMetricsCpi = useSyncStore((s) => s.marketMetricsCpi);
  const marketReferenceRates = useSyncStore((s) => s.marketReferenceRates);
  const { currency: displayCurrency } = useDisplayCurrency();

  const gap = useMemo(() => {
    const details = records
      ? portfolioIds
          .filter((id) => id !== SYNTHETIC_FALLBACK_ACCOUNT_ID)
          .map((id) =>
            buildPortfolioDetail(records, id, {
              asOf: new Date(),
              fxRates: marketFxRates,
              marketQuotes,
              useLatestTransactionFxRate: true,
              useMarketQuotes: true,
              displayCurrency,
              cpi: marketCpi,
              metricsCpi: marketMetricsCpi,
              referenceRates: marketReferenceRates,
            }),
          )
          .filter((detail): detail is NonNullable<typeof detail> => detail !== null)
      : [];
    const targets = details.map((detail) => {
      const payload = (findAccountRecord(records, detail.id)?.envelope.payload ?? {}) as {
        targetAllocation?: Record<string, number>;
      };
      return { totalValue: detail.totalValue, target: readAllocation(payload.targetAllocation) };
    });
    const actual = computeActualAllocation(details.flatMap((detail) => detail.holdings));
    return buildAllocationGap(aggregateTarget(targets), actual);
  }, [records, portfolioIds, marketFxRates, marketQuotes, marketCpi, marketMetricsCpi, marketReferenceRates, displayCurrency]);

  const meta = new Map(ASSET_CLASSES.map((c) => [c.key, c]));

  return (
    <div
      style={{
        background: V2.card,
        borderRadius: "var(--r-md)",
        border: `0.5px solid ${V2.line}`,
        padding: "20px 22px",
        fontFamily: V2_TYPE.ui,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, color: V2.subtle, textTransform: "uppercase", letterSpacing: ".10em" }}>
        Docelowa vs aktualna
      </div>
      {!gap.hasTarget && (
        <div style={{ fontSize: 12, color: V2.muted, marginTop: 10 }}>
          Brak ustawionej alokacji docelowej. Ustaw w Ustawieniach → Portfele.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
        {gap.rows.map((row) => {
          const def = meta.get(row.key)!;
          const color = TONE_COLOR[row.tone];
          return (
            <div key={row.key} data-testid={`allocation-gap-${row.key}`}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, color: V2.ink, fontWeight: 500 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "var(--r-sm)", background: def.color }} />
                  {def.label}
                </span>
                <span style={{ fontFamily: V2_TYPE.mono, fontVariantNumeric: "tabular-nums", color: V2.ink }}>
                  {pct(row.actualPct)}%
                  {row.targetPct !== null && <span style={{ color: V2.muted }}> / {pct(row.targetPct)}%</span>}
                  {row.deltaPp !== null && (
                    <span style={{ color, marginLeft: 10 }}>
                      {row.deltaPp >= 0 ? "+" : ""}{pct(row.deltaPp)}pp
                    </span>
                  )}
                </span>
              </div>
              <div style={{ position: "relative", height: 6, borderRadius: "var(--r-xs)", background: v2Mix(V2.ink, 0.08), marginTop: 6 }}>
                <div
                  style={{
                    width: `${Math.min(100, Math.max(0, row.actualPct))}%`,
                    height: "100%",
                    borderRadius: "var(--r-xs)",
                    background: def.color,
                  }}
                />
                {row.targetPct !== null && (
                  <div
                    style={{
                      position: "absolute",
                      left: `${Math.min(100, Math.max(0, row.targetPct))}%`,
                      top: -3,
                      width: 2,
                      height: 12,
                      background: V2.ink,
                      transform: "translateX(-1px)",
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
