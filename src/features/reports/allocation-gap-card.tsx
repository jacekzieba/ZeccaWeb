"use client";

import { useMemo, useState } from "react";
import {
  aggregateTarget,
  buildAllocationGap,
  computeActualAllocation,
  sumByAssetClass,
  type GapTone,
} from "@/domain/allocation/allocation-gap";
import { buildTaxLots, planBuyOnlyRebalance, planFullRebalance, splitOrdersByInstrument } from "@/domain/allocation/rebalance";
import { wrapperType } from "@/features/settings/ike-ikze-usage";
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
  const [mode, setMode] = useState<"buyOnly" | "full">("buyOnly");

  const { gap, target, valuesByClass, lotsByClass, holdings: allHoldings } = useMemo(() => {
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
    const payloads = details.map(
      (detail) =>
        (findAccountRecord(records, detail.id)?.envelope.payload ?? {}) as {
          targetAllocation?: Record<string, number>;
          accountType?: string;
        },
    );
    const targets = details.map((detail, i) => ({
      totalValue: detail.totalValue,
      target: readAllocation(payloads[i].targetAllocation),
    }));
    const holdings = details.flatMap((detail) => detail.holdings);
    const lotsByClass = buildTaxLots(
      details.flatMap((detail, i) =>
        detail.holdings.map((holding) => ({
          kind: holding.kind,
          marketValue: holding.marketValue,
          costBasis: holding.costBasis,
          exempt: wrapperType(payloads[i].accountType) !== null,
        })),
      ),
    );
    const target = aggregateTarget(targets);
    return {
      gap: buildAllocationGap(target, computeActualAllocation(holdings)),
      target,
      valuesByClass: sumByAssetClass(holdings),
      lotsByClass,
      holdings,
    };
  }, [records, portfolioIds, marketFxRates, marketQuotes, marketCpi, marketMetricsCpi, marketReferenceRates, displayCurrency]);

  const meta = new Map(ASSET_CLASSES.map((c) => [c.key, c]));
  const contribution = Number(contributionText.replace(/\s/g, "").replace(",", "."));
  const plan = useMemo(() => {
    if (!planOpen) return null;
    if (mode === "full") {
      return planFullRebalance({
        target,
        currentByClass: valuesByClass,
        lotsByClass,
        contribution: Math.max(0, contribution || 0),
      });
    }
    if (!(contribution > 0)) return null;
    return {
      ...planBuyOnlyRebalance({ target, currentByClass: valuesByClass, contribution }),
      estimatedTax: 0,
    };
  }, [planOpen, mode, contribution, target, valuesByClass, lotsByClass]);
  const ccy = currencyLabel(displayCurrency);
  const instrumentLines = useMemo(
    () => (plan ? splitOrdersByInstrument(plan.orders, allHoldings) : []),
    [plan, allHoldings],
  );

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
              <div role="radiogroup" aria-label="Tryb planu" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {([
                  ["buyOnly", "Tylko dokupowanie"],
                  ["full", "Pełny rebalansing"],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={mode === id}
                    onClick={() => setMode(id)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "var(--r-lg)",
                      border: `0.5px solid ${V2.line}`,
                      background: mode === id ? V2.ink : V2.card,
                      color: mode === id ? V2.card : V2.ink,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label style={{ display: "block", fontSize: 12, color: V2.muted }}>
                Kwota nowej wpłaty ({ccy}){mode === "full" ? ", opcjonalnie" : ""}
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
                {mode === "buyOnly"
                  ? "Tylko dokupowanie: nic nie sprzedajemy, więc bez podatku. To podpowiedź, nic się nie zapisuje."
                  : "Sprzedajemy klasy powyżej celu i dokupujemy poniżej. Sprzedaż najpierw z IKE/IKZE, reszta z podatkiem Belki 19% od średniego zysku klasy. To szacunek na poziomie klasy, nie porada podatkowa. Nic się nie zapisuje."}
              </div>
              {plan && (
                <div style={{ marginTop: 12 }} data-testid="rebalance-plan">
                  {plan.orders.length === 0 ? (
                    <div style={{ fontSize: 13, color: V2.muted }}>Brak klas z ustawionym celem do dokupienia.</div>
                  ) : (
                    plan.orders.map((order) => (
                      <div key={order.key} style={{ padding: "6px 0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: V2.ink }}>
                          <span>
                            {order.action === "sell" ? "Sprzedaj" : "Dokup"}: {meta.get(order.key)!.label}
                          </span>
                          <span style={{ fontFamily: V2_TYPE.mono, fontVariantNumeric: "tabular-nums" }}>
                            {order.amount.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {ccy}
                          </span>
                        </div>
                        {instrumentLines
                          .filter((line) => line.key === order.key && line.action === order.action)
                          .map((line) => (
                            <div
                              key={line.instrumentId ?? "class"}
                              style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: V2.muted, paddingLeft: 14, marginTop: 2 }}
                            >
                              <span>{line.symbol ?? "Wybierz instrument tej klasy"}</span>
                              {line.symbol && (
                                <span style={{ fontFamily: V2_TYPE.mono, fontVariantNumeric: "tabular-nums" }}>
                                  {line.amount.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {ccy}
                                  {line.quantity != null && ` · ok. ${line.quantity.toLocaleString("pl-PL", { maximumFractionDigits: 4 })} szt.`}
                                </span>
                              )}
                            </div>
                          ))}
                      </div>
                    ))
                  )}
                  {mode === "full" && plan.orders.length > 0 && (
                    <div style={{ fontSize: 12, color: V2.ink, marginTop: 6 }}>
                      Szacowany podatek:{" "}
                      <span style={{ fontFamily: V2_TYPE.mono }}>
                        {plan.estimatedTax.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {ccy}
                      </span>
                    </div>
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
