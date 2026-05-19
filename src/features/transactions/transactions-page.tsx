"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useSyncStore } from "@/sync/store/sync-store";
import { buildTransactionList } from "@/sync/records/investor-snapshot";
import {
  AddTransactionModal,
  type TransactionEditorDraft,
} from "@/features/transactions/add-transaction-modal";
import { deleteRecord, refreshSyncStore } from "@/sync/records/record-writer";

const INK = "#1C3144";
const MUTED = "rgba(28,49,68,0.58)";
const SUBTLE = "rgba(28,49,68,0.38)";
const LINE_SOFT = "rgba(28,49,68,0.06)";
const PROFIT = "#2D9C6B";
const LOSS = "#B85042";
const AMBER = "#B87830";
const BLUE = "#0A84FF";

const glassCard: CSSProperties = {
  background: "rgba(255,253,249,0.82)",
  backdropFilter: "blur(30px) saturate(160%)",
  WebkitBackdropFilter: "blur(30px) saturate(160%)",
  borderRadius: 16,
  border: "0.5px solid rgba(255,255,255,0.7)",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 0 rgba(28,49,68,0.04), 0 4px 16px rgba(28,49,68,0.05)",
};

const TX_LABELS: Record<string, string> = {
  buy: "Kupno",
  sell: "Sprzedaż",
  cashDeposit: "Wpłata",
  cashWithdrawal: "Wypłata",
  dividend: "Dywidenda",
  interest: "Odsetki",
  bondCoupon: "Kupon",
  bondRedemption: "Wykup",
  depositOpen: "Otwarcie lokaty",
  depositClose: "Zamknięcie lokaty",
  fee: "Opłata",
  tax: "Podatek",
  fxConversion: "Przewalutowanie",
  transferIn: "Transfer IN",
  transferOut: "Transfer OUT",
  accountTransferIn: "Przeniesienie",
  correction: "Korekta",
};

const TX_COLORS: Record<string, string> = {
  buy: BLUE,
  sell: LOSS,
  cashDeposit: PROFIT,
  cashWithdrawal: LOSS,
  dividend: PROFIT,
  interest: PROFIT,
  bondCoupon: PROFIT,
  bondRedemption: PROFIT,
  depositOpen: AMBER,
  depositClose: PROFIT,
  fee: LOSS,
  tax: LOSS,
  fxConversion: MUTED,
  transferIn: PROFIT,
  transferOut: LOSS,
  accountTransferIn: BLUE,
  correction: SUBTLE,
};

function fmt(n: number, d = 0) {
  return n.toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function TransactionsPage() {
  const records = useSyncStore((s) => s.records);
  const userDataKey = useSyncStore((s) => s.userDataKey);
  const supabase = useSyncStore((s) => s.supabase);
  const setSync = useSyncStore((s) => s.setSync);

  const allTransactions = useMemo(
    () => (records ? buildTransactionList(records) : []),
    [records],
  );

  const [portfolioFilter, setPortfolioFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const portfolios = useMemo(() => {
    const seen = new Map<string, string>();
    for (const tx of allTransactions) {
      seen.set(tx.portfolioId, tx.portfolioName);
    }
    return [...seen.entries()];
  }, [allTransactions]);

  const txTypes = useMemo(() => {
    const seen = new Set<string>();
    for (const tx of allTransactions) seen.add(tx.transactionType);
    return [...seen].sort();
  }, [allTransactions]);

  const editableTransactions = useMemo(() => {
    if (!records) return [];

    return records
      .filter((record) => !record.deletedAt && record.envelope.type === "transaction")
      .map((record) => {
        const payload = record.envelope.payload as {
          id: string;
          date: number | string;
          portfolioID: string;
          instrumentID?: string | null;
          transactionType: string;
          quantity?: number | null;
          price?: number | null;
          grossAmount: number;
          currency: string;
          fees: number;
          taxes: number;
        };

        return {
          id: payload.id,
          date:
            typeof payload.date === "number"
              ? new Date(Date.UTC(2001, 0, 1) + payload.date * 1000).toISOString()
              : new Date(payload.date).toISOString(),
          portfolioId: payload.portfolioID,
          instrumentId: payload.instrumentID ?? null,
          transactionType: payload.transactionType,
          quantity: payload.quantity ?? null,
          price: payload.price ?? null,
          grossAmount: payload.grossAmount,
          currency: payload.currency,
          fees: payload.fees,
          taxes: payload.taxes,
          updatedAt: record.updatedAt,
        } satisfies TransactionEditorDraft;
      });
  }, [records]);

  const editingTransaction = editingTransactionId
    ? editableTransactions.find((transaction) => transaction.id === editingTransactionId) ?? null
    : null;

  async function handleDeleteTransaction(id: string) {
    if (!userDataKey || !supabase || !records) {
      return;
    }

    if (!window.confirm("Usunąć transakcję?")) {
      return;
    }

    const sourceRecord = records.find(
      (record) =>
        !record.deletedAt &&
        record.envelope.type === "transaction" &&
        record.id === id,
    );

    setDeletingId(id);

    try {
      const result = await deleteRecord(supabase, "transaction", id, {
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

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allTransactions.filter((tx) => {
      if (portfolioFilter !== "all" && tx.portfolioId !== portfolioFilter) return false;
      if (typeFilter !== "all" && tx.transactionType !== typeFilter) return false;
      if (q) {
        const haystack = [
          tx.instrumentName,
          tx.instrumentSymbol,
          tx.portfolioName,
          TX_LABELS[tx.transactionType] ?? tx.transactionType,
          tx.currency,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [allTransactions, portfolioFilter, typeFilter, search]);

  const selectStyle: CSSProperties = {
    padding: "7px 12px",
    borderRadius: 9,
    border: "0.5px solid rgba(28,49,68,0.12)",
    background: "rgba(255,255,255,0.7)",
    color: INK,
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
    appearance: "none" as const,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header */}
      <div style={{ padding: "0 2px 4px" }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: INK, letterSpacing: "-0.01em" }}>
          Transakcje
        </div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
          {records
            ? `${allTransactions.length} transakcji · ${filtered.length} widocznych`
            : "Odblokuj dane w panelu synchronizacji"}
        </div>
      </div>

      {/* Filters */}
      {records && (
        <div
          style={{
            ...glassCard,
            padding: "14px 18px",
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {/* Search */}
          <div style={{ position: "relative", flex: "1 1 200px" }}>
            <span
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 13,
                color: SUBTLE,
                pointerEvents: "none",
              }}
            >
              ⌕
            </span>
            <input
              type="text"
              placeholder="Szukaj instrumentu, portfela…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "7px 12px 7px 30px",
                borderRadius: 9,
                border: "0.5px solid rgba(28,49,68,0.12)",
                background: "rgba(255,255,255,0.7)",
                color: INK,
                fontSize: 12,
                fontFamily: "inherit",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Portfolio filter */}
          <select
            value={portfolioFilter}
            onChange={(e) => setPortfolioFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="all">Wszystkie portfele</option>
            {portfolios.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>

          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="all">Wszystkie typy</option>
            {txTypes.map((t) => (
              <option key={t} value={t}>{TX_LABELS[t] ?? t}</option>
            ))}
          </select>

          {/* Clear */}
          {(search || portfolioFilter !== "all" || typeFilter !== "all") && (
            <button
              onClick={() => { setSearch(""); setPortfolioFilter("all"); setTypeFilter("all"); }}
              style={{
                padding: "7px 12px",
                borderRadius: 9,
                border: "0.5px solid rgba(28,49,68,0.12)",
                background: "transparent",
                color: MUTED,
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Wyczyść ×
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div style={{ ...glassCard, padding: 0 }}>
        {/* Header row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "100px minmax(0,1.5fr) minmax(0,1.2fr) 90px minmax(0,1fr) 90px 126px",
            padding: "10px 22px",
            background: "rgba(28,49,68,0.025)",
            borderBottom: `0.5px solid ${LINE_SOFT}`,
            borderRadius: "16px 16px 0 0",
          }}
        >
          {["Data", "Instrument", "Portfel", "Typ", "Kwota", "Waluta", "Akcje"].map((h, i) => (
            <div
              key={h}
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: SUBTLE,
                textTransform: "uppercase",
                letterSpacing: ".08em",
                textAlign: i >= 3 ? "right" : "left",
              }}
            >
              {h}
            </div>
          ))}
        </div>

        {!records && (
          <div style={{ padding: "48px 22px", textAlign: "center" }}>
            <div style={{ fontSize: 32, opacity: 0.12, marginBottom: 12 }}>↕</div>
            <div style={{ fontSize: 14, color: SUBTLE }}>
              Odblokuj dane w panelu synchronizacji
            </div>
          </div>
        )}

        {records && filtered.length === 0 && (
          <div style={{ padding: "32px 22px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: SUBTLE }}>Brak transakcji dla wybranych filtrów</div>
          </div>
        )}

        {filtered.slice(0, 200).map((tx) => {
          const color = TX_COLORS[tx.transactionType] ?? SUBTLE;
          const label = TX_LABELS[tx.transactionType] ?? tx.transactionType;
          const isInflow = ["cashDeposit", "dividend", "interest", "bondCoupon", "bondRedemption", "depositClose", "transferIn", "correction"].includes(tx.transactionType);

          return (
            <div
              key={tx.id}
              style={{
                display: "grid",
                gridTemplateColumns: "100px minmax(0,1.5fr) minmax(0,1.2fr) 90px minmax(0,1fr) 90px 126px",
                padding: "13px 22px",
                borderTop: `0.5px solid ${LINE_SOFT}`,
                alignItems: "center",
                transition: "background .12s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(28,49,68,0.025)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {/* Date */}
              <div style={{ fontSize: 12, color: MUTED }}>{fmtDate(tx.date)}</div>

              {/* Instrument */}
              <div>
                {tx.instrumentName ? (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{tx.instrumentName}</div>
                    <div style={{ fontSize: 11, color: SUBTLE }}>
                      {tx.instrumentSymbol}
                      {tx.quantity != null && ` · ${tx.quantity.toLocaleString("pl-PL", { maximumFractionDigits: 6 })} szt.`}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: MUTED }}>—</div>
                )}
              </div>

              {/* Portfolio */}
              <div style={{ fontSize: 12, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {tx.portfolioName}
              </div>

              {/* Type badge */}
              <div style={{ textAlign: "right" }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: `${color}14`,
                    color,
                    fontSize: 10.5,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </span>
              </div>

              {/* Amount */}
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: isInflow ? PROFIT : tx.transactionType === "buy" ? BLUE : LOSS,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {isInflow ? "+" : "−"}{fmt(tx.grossAmount, 2)}
                </div>
                {(tx.fees > 0 || tx.taxes > 0) && (
                  <div style={{ fontSize: 10, color: SUBTLE }}>
                    prowizja {fmt(tx.fees + tx.taxes, 2)}
                  </div>
                )}
              </div>

              {/* Currency */}
              <div style={{ textAlign: "right", fontSize: 12, color: MUTED, fontWeight: 500 }}>
                {tx.currency}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  onClick={() => setEditingTransactionId(tx.id)}
                  disabled={!userDataKey}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "0.5px solid rgba(28,49,68,0.12)",
                    background: "rgba(255,255,255,0.7)",
                    color: userDataKey ? MUTED : SUBTLE,
                    fontSize: 12,
                    cursor: userDataKey ? "pointer" : "not-allowed",
                    fontFamily: "inherit",
                  }}
                >
                  Edytuj
                </button>
                <button
                  onClick={() => void handleDeleteTransaction(tx.id)}
                  disabled={!userDataKey || deletingId === tx.id}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "0.5px solid rgba(184,80,66,0.18)",
                    background: deletingId === tx.id ? "rgba(184,80,66,0.08)" : "transparent",
                    color: deletingId === tx.id ? LOSS : MUTED,
                    fontSize: 12,
                    cursor: !userDataKey || deletingId === tx.id ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {deletingId === tx.id ? "Usuwam…" : "Usuń"}
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length > 200 && (
          <div
            style={{
              padding: "14px 22px",
              borderTop: `0.5px solid ${LINE_SOFT}`,
              textAlign: "center",
              fontSize: 12,
              color: SUBTLE,
            }}
          >
            Pokazano 200 z {filtered.length} transakcji — użyj filtrów, żeby zawęzić wyniki
          </div>
        )}
      </div>

      <AddTransactionModal
        open={Boolean(editingTransactionId)}
        initialValue={editingTransaction}
        onClose={() => setEditingTransactionId(null)}
      />
    </div>
  );
}
