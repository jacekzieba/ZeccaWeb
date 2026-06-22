"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import { PortfolioEditorModal } from "@/features/portfolios/portfolio-editor-modal";
import { deleteRecord, refreshSyncStore } from "@/sync/records/record-writer";
import { useSyncStore } from "@/sync/store/sync-store";
import { useDisplaySnapshot } from "@/features/sync/use-display-snapshot";
import { useProfile } from "@/features/profile/profile-store";

const INK = "#1C3144";
const MUTED = "rgba(28,49,68,0.58)";
const SUBTLE = "rgba(28,49,68,0.38)";
const LINE_SOFT = "rgba(28,49,68,0.06)";
const PROFIT = "#2D9C6B";
const LOSS = "#B85042";
const AMBER = "#B87830";
const glassCard: CSSProperties = {
  background: "rgba(255,253,249,0.82)",
  backdropFilter: "blur(30px) saturate(160%)",
  WebkitBackdropFilter: "blur(30px) saturate(160%)",
  borderRadius: 16,
  border: "0.5px solid rgba(255,255,255,0.7)",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 0 rgba(28,49,68,0.04), 0 4px 16px rgba(28,49,68,0.05)",
};

function fmt(n: number) {
  return n.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

const PORTFOLIO_COLORS = [
  "#6B3F5A", "#34699A", "#7EA16B", "#C97B30", "#5E6C84", "#8A7A3C",
];

export function PortfolioListPage() {
  const records = useSyncStore((s) => s.records);
  const snapshot = useDisplaySnapshot();
  const { displayCurrency } = useProfile();
  const userDataKey = useSyncStore((s) => s.userDataKey);
  const supabase = useSyncStore((s) => s.supabase);
  const setSync = useSyncStore((s) => s.setSync);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPortfolioId, setEditingPortfolioId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const editablePortfolios = useMemo(
    () =>
      snapshot?.portfolios.map((portfolio) => {
        const sourceRecord = records?.find(
          (record) =>
            !record.deletedAt &&
            record.envelope.type === "account" &&
            record.id === portfolio.id,
        );

        const payload = (sourceRecord?.envelope.payload ?? {}) as {
          accountType?: string;
          colorHex?: string;
          targetAllocation?: Record<string, number>;
        };

        return {
          id: portfolio.id,
          name: portfolio.name,
          baseCurrency: portfolio.baseCurrency,
          accountType: payload.accountType,
          colorHex: payload.colorHex,
          targetAllocation: payload.targetAllocation,
          updatedAt: sourceRecord?.updatedAt ?? "",
        };
      }) ?? [],
    [records, snapshot],
  );

  const editingPortfolio = editingPortfolioId
    ? editablePortfolios.find((portfolio) => portfolio.id === editingPortfolioId) ?? null
    : null;

  async function handleDeletePortfolio(id: string) {
    if (!userDataKey || !supabase || !records) {
      return;
    }

    const linkedTransactions = records.filter(
      (record) =>
        !record.deletedAt &&
        record.envelope.type === "transaction" &&
        (record.envelope.payload as { portfolioID?: string }).portfolioID === id,
    ).length;

    if (linkedTransactions > 0) {
      window.alert("Nie można usunąć portfela, który ma przypisane transakcje.");
      return;
    }

    if (!window.confirm("Usunąć portfel?")) {
      return;
    }

    setDeletingId(id);

    try {
      const sourceRecord = records.find(
        (record) =>
          !record.deletedAt &&
          record.envelope.type === "account" &&
          record.id === id,
      );
      const result = await deleteRecord(supabase, "account", id, {
        baseUpdatedAt: sourceRecord?.updatedAt ?? null,
      });
      if (!result.queued) {
        const { records: nextRecords, snapshot: nextSnapshot } = await refreshSyncStore(
          supabase,
          userDataKey,
        );
        setSync(nextRecords, nextSnapshot);
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header */}
      <div
        style={{
          padding: "0 2px 4px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: INK, letterSpacing: "-0.01em" }}>
            Portfele
          </div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
            {snapshot ? `${snapshot.portfolios.length} portfeli · dane na ${new Date(snapshot.asOf).toLocaleDateString("pl-PL")}` : "Odblokuj dane w panelu synchronizacji"}
          </div>
        </div>
        <button
          onClick={() => {
            setEditingPortfolioId(null);
            setEditorOpen(true);
          }}
          disabled={!userDataKey}
          style={{
            padding: "8px 14px",
            borderRadius: 9,
            border: "none",
            background: userDataKey ? INK : "rgba(28,49,68,0.12)",
            color: userDataKey ? "#fff" : SUBTLE,
            fontSize: 13,
            fontWeight: 700,
            cursor: userDataKey ? "pointer" : "not-allowed",
            fontFamily: "inherit",
          }}
        >
          + Dodaj portfel
        </button>
      </div>

      {/* Summary row */}
      {snapshot && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <div style={{ ...glassCard, padding: "18px 20px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: ".10em", marginBottom: 6 }}>
              Łączna wartość
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>
              {fmt(snapshot.totalValue)}{" "}
              <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.6 }}>{displayCurrency}</span>
            </div>
          </div>
          <div style={{ ...glassCard, padding: "18px 20px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: ".10em", marginBottom: 6 }}>
              Portfeli
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: INK }}>
              {snapshot.portfolios.length}
            </div>
          </div>
          <div style={{ ...glassCard, padding: "18px 20px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: ".10em", marginBottom: 6 }}>
              Gotówka
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>
              {fmt(snapshot.cash)}{" "}
              <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.6 }}>{displayCurrency}</span>
            </div>
          </div>
        </div>
      )}

      {/* Portfolio table */}
      <div style={{ ...glassCard, padding: 0 }}>
        {/* Table header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,2fr) minmax(0,0.7fr) minmax(0,0.5fr) minmax(0,1.2fr) minmax(0,1fr) 130px",
            padding: "12px 22px",
            background: "rgba(28,49,68,0.025)",
            borderBottom: `0.5px solid ${LINE_SOFT}`,
            borderRadius: "16px 16px 0 0",
          }}
        >
          {["Nazwa", "Waluta", "Pozycje", "Wartość", "Udział", "Akcje"].map((h, i) => (
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

        {!snapshot && (
          <div style={{ padding: "48px 22px", textAlign: "center" }}>
            <div style={{ fontSize: 32, opacity: 0.12, marginBottom: 12 }}>◎</div>
            <div style={{ fontSize: 14, color: SUBTLE }}>
              Odblokuj dane w panelu synchronizacji
            </div>
          </div>
        )}

        {snapshot && snapshot.portfolios.length === 0 && (
          <div style={{ padding: "48px 22px", textAlign: "center" }}>
            <div style={{ fontSize: 32, opacity: 0.12, marginBottom: 12 }}>◎</div>
            <div style={{ fontSize: 14, color: SUBTLE }}>
              Nie masz jeszcze żadnego portfela — utwórz pierwszy przyciskiem powyżej.
            </div>
          </div>
        )}

        {snapshot?.portfolios.map((pf, i) => {
          const color = PORTFOLIO_COLORS[i % PORTFOLIO_COLORS.length];
          const pct = snapshot.totalValue > 0 ? (pf.value / snapshot.totalValue) * 100 : 0;

          return (
            <div
              key={pf.id}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,2fr) minmax(0,0.7fr) minmax(0,0.5fr) minmax(0,1.2fr) minmax(0,1fr) 130px",
                padding: "16px 22px",
                borderTop: `0.5px solid ${LINE_SOFT}`,
                alignItems: "center",
                transition: "background .12s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(28,49,68,0.025)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {/* Name */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: `${color}18`,
                    border: `1.5px solid ${color}40`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    color,
                    flexShrink: 0,
                  }}
                >
                  ◎
                </span>
                <div>
                  <Link
                    href={`/portfolios/${pf.id}`}
                    style={{ fontSize: 14, fontWeight: 700, color: INK, textDecoration: "none" }}
                  >
                    {pf.name}
                  </Link>
                  <div style={{ fontSize: 11, color: SUBTLE }}>#{pf.id.slice(0, 8)}</div>
                </div>
              </div>

              {/* Currency */}
              <div style={{ textAlign: "right", fontSize: 13, color: MUTED, fontWeight: 500 }}>
                {pf.baseCurrency}
              </div>

              {/* Positions */}
              <div style={{ textAlign: "right", fontSize: 14, color: INK, fontWeight: 600 }}>
                {pf.positions}
              </div>

              {/* Value */}
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>
                  {fmt(pf.value)} <span style={{ fontSize: 11, opacity: 0.55 }}>{displayCurrency}</span>
                </div>
                <div style={{ fontSize: 11, color: pf.dailyChange >= 0 ? PROFIT : LOSS, fontWeight: 600, marginTop: 1 }}>
                  {fmtPct(pf.dailyChange)} dziś
                </div>
              </div>

              {/* % of total + chevron */}
              <div style={{ textAlign: "right", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: MUTED, fontVariantNumeric: "tabular-nums" }}>
                    {pct.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                  </div>
                  {/* Mini bar */}
                  <div
                    style={{
                      width: 60,
                      height: 3,
                      borderRadius: 2,
                      background: "rgba(28,49,68,0.08)",
                      marginTop: 4,
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(pct, 100)}%`,
                        height: "100%",
                        borderRadius: 2,
                        background: color,
                      }}
                    />
                  </div>
                </div>
                <Link
                  href={`/portfolios/${pf.id}`}
                  style={{ fontSize: 16, color: SUBTLE, marginLeft: 4, textDecoration: "none" }}
                >
                  ›
                </Link>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  onClick={() => {
                    setEditingPortfolioId(pf.id);
                    setEditorOpen(true);
                  }}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "0.5px solid rgba(28,49,68,0.12)",
                    background: "rgba(255,255,255,0.7)",
                    color: MUTED,
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Edytuj
                </button>
                <button
                  onClick={() => void handleDeletePortfolio(pf.id)}
                  disabled={!userDataKey || deletingId === pf.id}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "0.5px solid rgba(184,80,66,0.18)",
                    background: deletingId === pf.id ? "rgba(184,80,66,0.08)" : "transparent",
                    color: deletingId === pf.id ? LOSS : AMBER,
                    fontSize: 12,
                    cursor: !userDataKey || deletingId === pf.id ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {deletingId === pf.id ? "Usuwam…" : "Usuń"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <PortfolioEditorModal
        open={editorOpen}
        initialValue={editingPortfolio}
        onClose={() => {
          setEditorOpen(false);
          setEditingPortfolioId(null);
        }}
      />
    </div>
  );
}
