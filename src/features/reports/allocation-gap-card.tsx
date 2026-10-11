"use client";

import { useMemo, useState } from "react";
import {
  aggregateTarget,
  buildAllocationGap,
  computeActualAllocation,
  sumByAssetClass,
  type GapTone,
} from "@/domain/allocation/allocation-gap";
import { planBuyOnlyRebalance } from "@/domain/allocation/rebalance";
import { currencyLabel } from "@/lib/money";
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

  const [contributionText, setContributionText] = useState("");
  const [planOpen, setPlanOpen] = useState(false);

  const { gap, target, valuesByClass } = useMemo(() => {
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
    const holdings = details.flatMap((detail) => detail.holdings);
    const target = aggregateTarget(targets);
    return {
      gap: buildAllocationGap(target, computeActualAllocation(holdings)),
      target,
      valuesByClass: sumByAssetClass(holdings),
    };
  }, [records, portfolioIds, marketFxRates, marketQuotes, marketCpi, marketMetricsCpi, marketReferenceRates, displayCurrency]);

  const meta = new Map(ASSET_CLASSES.map((c) => [c.key, c]));
  const contribution = Number(contributionText.replace(/\s/g, "").replace(",", "."));
  const plan = useMemo(
    () =>
      planOpen && contribution > 0
        ? planBuyOnlyRebalance({ target, currentByClass: valuesByClass, contribution })
        : null,
    [planOpen, contribution, target, valuesByClass],
  );
  const ccy = currencyLabel(displayCurrency);

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

      {gap.hasTarget && (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: `0.5px solid ${V2.line2}` }}>
          <button
            type="button"
            onClick={() => setPlanOpen((open) => !open)}
            aria-expanded={planOpen}
            style={{
              padding: "7px 14px",
              borderRadius: "var(--r-lg)",
              border: `0.5px solid ${V2.line}`,
              background: V2.card,
              color: V2.ink,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Zaplanuj dokupienie
          </button>
          {planOpen && (
            <div style={{ marginTop: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: V2.muted }}>
                Kwota nowej wpłaty ({ccy})
                <input
                  type="text"
                  inputMode="decimal"
                  value={contributionText}
                  onChange={(e) => setContributionText(e.target.value)}
                  style={{
                    display: "block",
                    marginTop: 6,
                    width: 160,
                    padding: "7px 10px",
                    borderRadius: "var(--r-lg)",
                    border: `0.5px solid ${V2.line}`,
                    background: V2.card,
                    color: V2.ink,
                    fontFamily: V2_TYPE.mono,
                    fontSize: 13,
                  }}
                />
              </label>
              <div style={{ fontSize: 12, color: V2.muted, marginTop: 8 }}>
                Tylko dokupowanie: nic nie sprzedajemy, więc bez podatku. To podpowiedź, nic się nie zapisuje.
              </div>
              {plan && (
                <div style={{ marginTop: 12 }} data-testid="rebalance-plan">
                  {plan.orders.length === 0 ? (
                    <div style={{ fontSize: 13, color: V2.muted }}>Brak klas z ustawionym celem do dokupienia.</div>
                  ) : (
                    plan.orders.map((order) => (
                      <div
                        key={order.key}
                        style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, color: V2.ink }}
                      >
                        <span>Dokup: {meta.get(order.key)!.label}</span>
                        <span style={{ fontFamily: V2_TYPE.mono, fontVariantNumeric: "tabular-nums" }}>
                          {order.amount.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {ccy}
                        </span>
                      </div>
                    ))
                  )}
                  <div style={{ fontSize: 12, color: V2.muted, marginTop: 6 }}>
                    Największe odchylenie: {pct(plan.preMaxDriftPp)} pp → {pct(plan.postMaxDriftPp)} pp
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
