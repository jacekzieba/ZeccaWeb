"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { buildInstrumentList, buildTransactionList } from "@/sync/records/investor-snapshot";
import { useSyncStore } from "@/sync/store/sync-store";
import { useProfile } from "@/features/profile/profile-store";
import type { InstrumentRow, TransactionRow } from "@/domain/models/investor-data";
import { V2, V2Card, V2ScreenHead, V2_TYPE, v2Mix } from "@/lib/v2-design";

const UI = V2_TYPE.ui;
const SERIF = V2_TYPE.serif;
const MONO = V2_TYPE.mono;

type SortKey = "symbol" | "kind" | "quantity" | "marketValue" | "lastPrice";
type SortDir = "asc" | "desc";

const KIND_FILTER_OPTIONS = [
  { id: "all", label: "Wszystkie" },
  { id: "etf", label: "ETF" },
  { id: "stock", label: "Akcje" },
  { id: "crypto", label: "Krypto" },
  { id: "treasuryBond", label: "Obligacje" },
  { id: "deposit", label: "Lokaty" },
] as const;
type KindFilter = (typeof KIND_FILTER_OPTIONS)[number]["id"];

const KIND_LABELS: Record<string, string> = {
  stock: "AKC",
  etf: "ETF",
  treasuryBond: "OBL",
  listedBond: "OBL",
  deposit: "LOK",
  cash: "GOT",
  crypto: "KRY",
};

function kindColor(kind: string) {
  if (kind === "etf" || kind === "stock") return V2.equity;
  if (kind === "treasuryBond" || kind === "listedBond") return V2.bonds;
  if (kind === "deposit") return V2.deposit;
  if (kind === "cash") return V2.cash;
  if (kind === "crypto") return V2.crypto;
  return V2.subtle;
}

function fmt(n: number, d = 0) {
  return n.toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtQty(n: number) {
  if (Number.isInteger(n)) return fmt(n);
  return n.toLocaleString("pl-PL", { minimumFractionDigits: n < 1 ? 4 : 2, maximumFractionDigits: 6 });
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      fontFamily: UI, fontSize: 10, fontWeight: 700, letterSpacing: ".04em",
      padding: "3px 7px", borderRadius: 5, color, background: v2Mix(color, 0.13), whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

// Sheet that slides up to show transactions for a clicked instrument
function TransactionSheet({
  instrument,
  transactions,
  onClose,
}: {
  instrument: InstrumentRow;
  transactions: TransactionRow[];
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const TX_LABELS: Record<string, string> = {
    buy: "Zakup", sell: "Sprzedaż", dividend: "Dywidenda", interest: "Odsetki",
    bondCoupon: "Kupon", depositOpen: "Lokata", depositClose: "Zamknięcie",
    cashDeposit: "Wpłata", cashWithdrawal: "Wypłata", fee: "Prowizja",
    tax: "Podatek", fxConversion: "FX", transferIn: "Transfer IN", transferOut: "Transfer OUT",
  };
  const color = kindColor(instrument.kind);
  const tag = KIND_LABELS[instrument.kind] ?? "INNE";

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  function handleDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const dialog = event.currentTarget;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute("disabled"));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 600,
        background: "rgba(22,29,24,0.44)", display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="positions-transaction-sheet-title"
        onKeyDown={handleDialogKeyDown}
        style={{
          background: V2.card, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 720,
          maxHeight: "80vh", overflow: "auto",
          boxShadow: "0 -8px 48px rgba(22,29,24,0.18)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "22px 24px 16px", borderBottom: `0.5px solid ${V2.line}`, display: "flex", alignItems: "center", gap: 14 }}>
          <Badge label={tag} color={color} />
          <div style={{ flex: 1 }}>
            <div id="positions-transaction-sheet-title" style={{ fontFamily: UI, fontSize: 15, fontWeight: 700, color: V2.ink }}>{instrument.symbol}</div>
            <div style={{ fontFamily: UI, fontSize: 12, color: V2.subtle }}>{instrument.name}</div>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Zamknij historię transakcji"
            style={{ border: "none", background: "transparent", fontSize: 20, color: V2.muted, cursor: "pointer", lineHeight: 1, padding: "4px 8px" }}
          >
            ×
          </button>
        </div>
        {transactions.length === 0 ? (
          <div style={{ padding: "32px 24px", color: V2.subtle, fontSize: 14 }}>Brak transakcji dla tego instrumentu.</div>
        ) : (
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ background: v2Mix(V2.ink, 0.025) }}>
                {["Data", "Typ", "Portfel", "Ilość", "Cena", "Kwota", "Waluta"].map((h, i) => (
                  <th key={h} style={{ fontFamily: UI, fontSize: 9.5, fontWeight: 700, color: V2.subtle, textTransform: "uppercase", letterSpacing: ".07em", padding: "9px 14px", textAlign: i === 0 ? "left" : "right" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => {
                const income = ["sell", "dividend", "interest", "bondCoupon", "depositClose"].includes(tx.transactionType);
                return (
                  <tr key={tx.id} style={{ borderTop: `0.5px solid ${V2.line2}` }}>
                    <td style={tdStyle}>{tx.date.slice(0, 10)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <Badge label={TX_LABELS[tx.transactionType] ?? tx.transactionType} color={income ? V2.profit : V2.muted} />
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", color: V2.muted }}>{tx.portfolioName}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontFamily: MONO }}>{tx.quantity != null ? fmtQty(tx.quantity) : "—"}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontFamily: MONO }}>{tx.price != null ? fmt(tx.price, 2) : "—"}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontFamily: MONO, fontWeight: 600, color: income ? V2.profit : V2.ink }}>
                      {income ? "+" : ""}{fmt(tx.grossAmount, 2)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", fontFamily: MONO, color: V2.muted }}>{tx.currency}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div style={{ height: 32 }} />
      </div>
    </div>
  );
}

const tdStyle: CSSProperties = { fontFamily: UI, fontSize: 12.5, color: V2.ink, padding: "10px 14px", verticalAlign: "middle" };

export function PositionsPage() {
  const records = useSyncStore((s) => s.records);
  const marketFxRates = useSyncStore((s) => s.marketFxRates);
  const { displayCurrency } = useProfile();

  const instruments = useMemo(
    () =>
      records
        ? buildInstrumentList(records, {
            asOf: new Date(),
            fxRates: marketFxRates,
            useLatestTransactionFxRate: true,
            useMarketQuotes: true,
            displayCurrency,
          })
        : [],
    [records, marketFxRates, displayCurrency],
  );

  const allTransactions = useMemo(
    () => (records ? buildTransactionList(records) : []),
    [records],
  );

  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("marketValue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<InstrumentRow | null>(null);

  const activeInstruments = useMemo(
    () => instruments.filter((i) => i.totalQuantity > 0.000001),
    [instruments],
  );

  const filtered = useMemo(() => {
    const base = kindFilter === "all"
      ? activeInstruments
      : activeInstruments.filter((i) => {
          if (kindFilter === "treasuryBond") return i.kind === "treasuryBond" || i.kind === "listedBond";
          if (kindFilter === "etf") return i.kind === "etf";
          if (kindFilter === "stock") return i.kind === "stock";
          if (kindFilter === "crypto") return i.kind === "crypto";
          if (kindFilter === "deposit") return i.kind === "deposit";
          return true;
        });

    return [...base].sort((a, b) => {
      let diff = 0;
      if (sortKey === "symbol") diff = a.symbol.localeCompare(b.symbol, "pl");
      else if (sortKey === "kind") diff = a.kind.localeCompare(b.kind, "pl");
      else if (sortKey === "quantity") diff = a.totalQuantity - b.totalQuantity;
      else if (sortKey === "marketValue") diff = a.marketValue - b.marketValue;
      else if (sortKey === "lastPrice") diff = a.lastPrice - b.lastPrice;
      return sortDir === "asc" ? diff : -diff;
    });
  }, [activeInstruments, kindFilter, sortKey, sortDir]);

  const instrumentTransactions = useMemo(
    () =>
      selected
        ? allTransactions.filter((tx) => tx.instrumentId === selected.id)
        : [],
    [allTransactions, selected],
  );

  const totalValue = filtered.reduce((s, i) => s + i.marketValue, 0);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span aria-hidden="true" style={{ opacity: 0.3, marginLeft: 3 }}>↕</span>;
    return <span aria-hidden="true" style={{ marginLeft: 3, color: V2.brand }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  function thStyle(key: SortKey, align: "left" | "right" = "right"): CSSProperties {
    return {
      fontFamily: UI, fontSize: 9.5, fontWeight: 700, color: V2.subtle,
      textTransform: "uppercase", letterSpacing: ".07em",
      padding: "9px 14px", textAlign: align, userSelect: "none",
      whiteSpace: "nowrap",
    };
  }

  function sortDirectionFor(key: SortKey): "ascending" | "descending" | "none" {
    if (sortKey !== key) return "none";
    return sortDir === "asc" ? "ascending" : "descending";
  }

  function SortHeader({ column, label, align = "right" }: { column: SortKey; label: string; align?: "left" | "right" }) {
    return (
      <th aria-sort={sortDirectionFor(column)} style={{ ...thStyle(column, align), paddingLeft: align === "left" ? 20 : undefined }}>
        <button
          type="button"
          onClick={() => toggleSort(column)}
          style={{
            border: "none",
            background: "transparent",
            color: "inherit",
            cursor: "pointer",
            font: "inherit",
            letterSpacing: "inherit",
            padding: 0,
            textAlign: align,
            textTransform: "inherit",
            width: "100%",
          }}
        >
          {label} <SortIcon k={column} />
        </button>
      </th>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: UI, color: V2.ink }}>
      <V2ScreenHead eyebrow="Analiza" title="Pozycje" sub="Aktywne instrumenty we wszystkich portfelach — filtruj, sortuj, kliknij aby zobaczyć historię transakcji" />

      {/* Filter strip */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {KIND_FILTER_OPTIONS.map((option) => (
          <button
            key={option.id}
            onClick={() => setKindFilter(option.id)}
            style={{
              border: `1.5px solid ${kindFilter === option.id ? V2.brand : V2.line}`,
              borderRadius: 20, padding: "6px 14px",
              background: kindFilter === option.id ? v2Mix(V2.brand, 0.08) : V2.card,
              color: kindFilter === option.id ? V2.brand : V2.muted,
              fontFamily: UI, fontSize: 12.5, fontWeight: kindFilter === option.id ? 700 : 500,
              cursor: "pointer",
            }}
          >
            {option.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <Link href="/instruments" style={{ alignSelf: "center", fontFamily: UI, fontSize: 12, color: V2.brand, fontWeight: 600, textDecoration: "none" }}>
          Instrumenty →
        </Link>
      </div>

      {!records ? (
        <V2Card>
          <div style={{ padding: "20px 4px", textAlign: "center", color: V2.subtle, fontSize: 14 }}>
            Odblokuj dane w panelu synchronizacji, żeby zobaczyć pozycje.
          </div>
        </V2Card>
      ) : (
        <V2Card pad={0} style={{ overflow: "hidden" }}>
          {/* Stats header */}
          <div style={{ padding: "16px 22px", borderBottom: `0.5px solid ${V2.line}`, display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontFamily: UI, fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: V2.subtle }}>Pozycji</div>
              <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 500, color: V2.ink }}>{filtered.length}</div>
            </div>
            <div>
              <div style={{ fontFamily: UI, fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: V2.subtle }}>Wartość (przefiltrowana)</div>
              <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 500, color: V2.ink }}>{fmt(totalValue)} <span style={{ fontSize: 12, color: V2.subtle, fontStyle: "italic" }}>{displayCurrency}</span></div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: "40px 24px", textAlign: "center", color: V2.subtle, fontSize: 14 }}>
              Brak aktywnych pozycji dla wybranej kategorii.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", minWidth: 640, width: "100%" }}>
                <thead>
                  <tr style={{ background: v2Mix(V2.ink, 0.022) }}>
                    <SortHeader column="symbol" label="Instrument" align="left" />
                    <SortHeader column="kind" label="Klasa" />
                    <SortHeader column="quantity" label="Ilość" />
                    <SortHeader column="lastPrice" label="Cena" />
                    <SortHeader column="marketValue" label={`Wartość (${displayCurrency})`} />
                    <th style={{ ...thStyle("marketValue"), cursor: "default" }}>Udział</th>
                    <th style={{ ...thStyle("marketValue"), cursor: "default" }}>Wycena</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((instrument) => {
                    const color = kindColor(instrument.kind);
                    const tag = KIND_LABELS[instrument.kind] ?? "?";
                    return (
                      <tr
                        key={instrument.id}
                        onClick={() => setSelected(instrument)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelected(instrument);
                          }
                        }}
                        tabIndex={0}
                        aria-label={`Pokaż transakcje instrumentu ${instrument.symbol}`}
                        style={{ borderTop: `0.5px solid ${V2.line2}`, cursor: "pointer", transition: "background .1s" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = v2Mix(V2.ink, 0.022); }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                      >
                        <td style={{ ...tdStyle, paddingLeft: 20 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <Badge label={tag} color={color} />
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13 }}>{instrument.symbol}</div>
                              <div style={{ fontSize: 11, color: V2.subtle, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{instrument.name}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", color: V2.muted, fontFamily: MONO, fontSize: 11 }}>
                          {KIND_LABELS[instrument.kind] ?? instrument.kind}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", fontFamily: MONO }}>
                          {fmtQty(instrument.totalQuantity)}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", fontFamily: MONO }}>
                          <div>{fmt(instrument.lastPrice, 2)}</div>
                          <div style={{ fontSize: 10.5, color: V2.subtle }}>{instrument.currency}</div>
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 500 }}>{fmt(instrument.marketValue)}</div>
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", fontFamily: MONO, fontSize: 12 }}>
                          {(totalValue > 0 ? ((instrument.marketValue / totalValue) * 100) : 0).toFixed(1)}%
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <span style={{ fontFamily: MONO, fontSize: 11, color: V2.subtle }}>{instrument.valuationSourceLabel}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </V2Card>
      )}

      {selected && (
        <TransactionSheet
          instrument={selected}
          transactions={instrumentTransactions}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
