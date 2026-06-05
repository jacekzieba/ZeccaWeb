"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useSyncStore } from "@/sync/store/sync-store";
import { buildTransactionList } from "@/sync/records/investor-snapshot";
import {
  AddTransactionModal,
  type TransactionEditorDraft,
} from "@/features/transactions/add-transaction-modal";
import { deleteRecord, refreshSyncStore } from "@/sync/records/record-writer";
import {
  V2,
  V2Badge,
  V2Button,
  V2Card,
  V2Kpi,
  V2ScreenHead,
  V2_TYPE,
  v2InputStyle,
  v2Mix,
  v2SelectStyle,
} from "@/lib/v2-design";

const MUTED = V2.muted;
const SUBTLE = V2.subtle;
const LINE_SOFT = V2.line2;
const PROFIT = V2.profit;
const LOSS = V2.loss;
const AMBER = V2.bonds;
const BLUE = V2.equity;

const glassCard: CSSProperties = {
  background: V2.card,
  backdropFilter: "blur(30px) saturate(160%)",
  WebkitBackdropFilter: "blur(30px) saturate(160%)",
  borderRadius: 16,
  border: `0.5px solid ${V2.line}`,
  boxShadow: `0 1px 0 ${v2Mix(V2.ink, 0.03)}, 0 6px 20px ${v2Mix(V2.ink, 0.05)}`,
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
  const openAddTransaction = useSyncStore((s) => s.openAddTransaction);

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

  const selectStyle: CSSProperties = v2SelectStyle;
  const deposits = allTransactions.filter((tx) => tx.transactionType === "cashDeposit").reduce((sum, tx) => sum + tx.grossAmount, 0);
  const dividends = allTransactions.filter((tx) => tx.transactionType === "dividend").reduce((sum, tx) => sum + tx.grossAmount, 0);
  const interest = allTransactions.filter((tx) => ["interest", "bondCoupon"].includes(tx.transactionType)).reduce((sum, tx) => sum + tx.grossAmount, 0);
  const fees = allTransactions.filter((tx) => ["fee", "tax"].includes(tx.transactionType)).reduce((sum, tx) => sum + tx.grossAmount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: V2_TYPE.ui, color: V2.ink }}>
      <V2ScreenHead
        eyebrow="Analiza"
        title="Transakcje"
        sub={records ? `${allTransactions.length} operacji · ${filtered.length} widocznych` : "Odblokuj dane w panelu synchronizacji"}
        action={<V2Button onClick={openAddTransaction}><span style={{ fontSize: 16, lineHeight: 1 }}>+</span>Dodaj transakcję</V2Button>}
      />

      {records && (
        <V2Card pad={20}>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <V2Kpi label="Wpłaty" value={`+${fmt(deposits)} zł`} />
            <div style={{ width: "0.5px", background: V2.line, alignSelf: "stretch" }} />
            <V2Kpi label="Dywidendy" value={`+${fmt(dividends)} zł`} accent={V2.profit} />
            <V2Kpi label="Odsetki" value={`+${fmt(interest)} zł`} accent={V2.bonds} />
            <V2Kpi label="Prowizje" value={`−${fmt(fees)} zł`} accent={V2.loss} />
          </div>
        </V2Card>
      )}

      {/* Filters */}
      {records && (
        <div
          style={{
            padding: "0",
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
                color: V2.subtle,
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
                ...v2InputStyle,
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
                border: `0.5px solid ${V2.line}`,
                background: "transparent",
                color: V2.muted,
                fontSize: 12,
                cursor: "pointer",
                fontFamily: V2_TYPE.ui,
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
            background: v2Mix(V2.ink, 0.022),
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
                color: V2.subtle,
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
                onMouseEnter={(e) => (e.currentTarget.style.background = v2Mix(V2.ink, 0.022))}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {/* Date */}
              <div style={{ fontFamily: V2_TYPE.mono, fontSize: 11.5, color: V2.muted }}>{fmtDate(tx.date)}</div>

              {/* Instrument */}
              <div>
                {tx.instrumentName ? (
                  <>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: V2.ink }}>{tx.instrumentName}</div>
                    <div style={{ fontSize: 11.5, color: V2.subtle, marginTop: 1 }}>
                      {tx.instrumentSymbol}
                      {tx.quantity != null && ` · ${tx.quantity.toLocaleString("pl-PL", { maximumFractionDigits: 6 })} szt.`}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: V2.muted }}>—</div>
                )}
              </div>

              {/* Portfolio */}
              <div style={{ fontFamily: V2_TYPE.mono, fontSize: 11.5, color: V2.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {tx.portfolioName}
              </div>

              {/* Type badge */}
              <div style={{ textAlign: "right" }}>
                <V2Badge label={label} color={color} />
              </div>

              {/* Amount */}
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontFamily: V2_TYPE.serif,
                    fontSize: 16,
                    fontWeight: 500,
                    color: isInflow ? PROFIT : tx.transactionType === "buy" ? BLUE : LOSS,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {isInflow ? "+" : "−"}{fmt(tx.grossAmount, 2)}
                </div>
                {(tx.fees > 0 || tx.taxes > 0) && (
                  <div style={{ fontFamily: V2_TYPE.mono, fontSize: 10.5, color: V2.subtle }}>
                    prowizja {fmt(tx.fees + tx.taxes, 2)}
                  </div>
                )}
              </div>

              {/* Currency */}
              <div style={{ textAlign: "right", fontFamily: V2_TYPE.mono, fontSize: 11.5, color: V2.muted, fontWeight: 500 }}>
                {tx.currency}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  onClick={() => setEditingTransactionId(tx.id)}
                  disabled={!userDataKey}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: `0.5px solid ${V2.line}`,
                    background: v2Mix(V2.card, 0.72),
                    color: userDataKey ? V2.muted : V2.subtle,
                    fontSize: 12,
                    cursor: userDataKey ? "pointer" : "not-allowed",
                    fontFamily: V2_TYPE.ui,
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
                    border: `0.5px solid ${v2Mix(V2.loss, 0.18)}`,
                    background: deletingId === tx.id ? v2Mix(V2.loss, 0.08) : "transparent",
                    color: deletingId === tx.id ? LOSS : MUTED,
                    fontSize: 12,
                    cursor: !userDataKey || deletingId === tx.id ? "not-allowed" : "pointer",
                    fontFamily: V2_TYPE.ui,
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
