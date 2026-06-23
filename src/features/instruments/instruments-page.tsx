"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Check, RefreshCw, X } from "lucide-react";
import { InstrumentEditorModal } from "@/features/instruments/instrument-editor-modal";
import { deleteRecord, refreshSyncStore, saveRecord } from "@/sync/records/record-writer";
import { makeManualValuationPayload } from "@/sync/records/macos-payloads";
import { useSyncStore } from "@/sync/store/sync-store";
import { buildInstrumentList } from "@/sync/records/investor-snapshot";
import type { MarketQuote } from "@/market-data/types";
import { yahooSymbolForInstrument } from "@/market-data/symbols";
import { isFakeSyncEnabled } from "@/lib/env";
import { buildFakeManualValuationRecord } from "@/sync/dev/fake-sync";
import { buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";
import { useProfile } from "@/features/profile/profile-store";
import type { InstrumentRow } from "@/domain/models/investor-data";
import {
  groupTreasuryBondSeries,
  treasuryBondFamilyLabel,
  type GroupedTreasuryBondFamily,
} from "@/domain/bonds/bond-series-groups";
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

const INK = V2.ink;
const MUTED = V2.muted;
const SUBTLE = V2.subtle;
const LINE_SOFT = V2.line2;
const PROFIT = V2.profit;
const LOSS = V2.loss;

const glassCard: CSSProperties = {
  background: V2.card,
  backdropFilter: "blur(30px) saturate(160%)",
  WebkitBackdropFilter: "blur(30px) saturate(160%)",
  borderRadius: 16,
  border: `0.5px solid ${V2.line}`,
  boxShadow: `0 1px 0 ${v2Mix(V2.ink, 0.03)}, 0 6px 20px ${v2Mix(V2.ink, 0.05)}`,
};

const KIND_LABELS: Record<string, string> = {
  stock: "Akcja",
  etf: "ETF",
  treasuryBond: "Obl. skarbowa",
  listedBond: "Obl. giełdowa",
  crypto: "Kryptowaluta",
  deposit: "Lokata",
  cash: "Gotówka",
};

const KIND_COLORS: Record<string, string> = {
  stock: V2.equity,
  etf: V2.equity,
  treasuryBond: V2.bonds,
  listedBond: V2.bonds,
  crypto: V2.crypto,
  deposit: V2.deposit,
  cash: V2.cash,
};

const KIND_ALL = "all";

function fmt(n: number, d = 0) {
  return n.toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtQty(n: number) {
  if (n === 0) return "—";
  if (Number.isInteger(n)) return fmt(n);
  return n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pl-PL", { day: "2-digit", month: "short", year: "numeric" });
}

type KindFilter = typeof KIND_ALL | string;
type HeldFilter = "all" | "held" | "closed";
type QuotePreview = {
  instrumentId: string;
  requestSymbol: string;
  quote: MarketQuote;
};
type MarketDataStatus = {
  providers: {
    yahoo: {
      configured: boolean;
    };
    nbp: {
      configured: boolean;
    };
  };
};

function quoteCurrencyForInstrument(quote: MarketQuote, fallbackCurrency: string) {
  return quote.currency ?? fallbackCurrency;
}

function buildFakeQuote(inst: { symbol: string; currency: string }): MarketQuote {
  return {
    provider: "yahoo",
    symbol: yahooSymbolForInstrument(inst.symbol, inst.currency),
    currency: inst.currency,
    date: "2026-06-18",
    open: 136,
    high: 142,
    low: 135,
    close: 140,
    volume: 123456,
  };
}

export function InstrumentsPage() {
  const records = useSyncStore((s) => s.records);
  const marketFxRates = useSyncStore((s) => s.marketFxRates);
  const userDataKey = useSyncStore((s) => s.userDataKey);
  const supabase = useSyncStore((s) => s.supabase);
  const setSync = useSyncStore((s) => s.setSync);
  const { displayCurrency } = useProfile();

  const allInstruments = useMemo(
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
    [marketFxRates, records, displayCurrency],
  );

  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>(KIND_ALL);
  const [heldFilter, setHeldFilter] = useState<HeldFilter>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingInstrumentId, setEditingInstrumentId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [quoteLoadingId, setQuoteLoadingId] = useState<string | null>(null);
  const [quoteSavingId, setQuoteSavingId] = useState<string | null>(null);
  const [quotePreview, setQuotePreview] = useState<QuotePreview | null>(null);
  const [quoteMessage, setQuoteMessage] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [marketDataStatus, setMarketDataStatus] = useState<MarketDataStatus | null>(null);
  const [marketDataStatusError, setMarketDataStatusError] = useState<string | null>(null);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<GroupedTreasuryBondFamily>>(() => new Set());

  useEffect(() => {
    if (!records) {
      return;
    }

    let cancelled = false;

    async function fetchMarketDataStatus() {
      try {
        const response = await fetch("/api/market-data/status");
        const body = await response.json() as MarketDataStatus;
        if (!response.ok) {
          throw new Error("Nie udało się sprawdzić konfiguracji market data.");
        }
        if (!cancelled) {
          setMarketDataStatus(body);
          setMarketDataStatusError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setMarketDataStatus(null);
          setMarketDataStatusError(
            error instanceof Error
              ? error.message
              : "Nie udało się sprawdzić konfiguracji market data.",
          );
        }
      }
    }

    void fetchMarketDataStatus();

    return () => {
      cancelled = true;
    };
  }, [records]);

  const kinds = useMemo(() => {
    const seen = new Set<string>();
    for (const inst of allInstruments) seen.add(inst.kind);
    return [...seen].sort();
  }, [allInstruments]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allInstruments.filter((inst) => {
      if (kindFilter !== KIND_ALL && inst.kind !== kindFilter) return false;
      if (heldFilter === "held" && inst.totalQuantity <= 0) return false;
      if (heldFilter === "closed" && inst.totalQuantity > 0) return false;
      if (q) {
        const hay = [inst.name, inst.symbol, KIND_LABELS[inst.kind] ?? inst.kind, inst.currency]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allInstruments, kindFilter, heldFilter, search]);

  const totalValue = useMemo(
    () => filtered.filter((i) => i.totalQuantity > 0).reduce((s, i) => s + i.marketValue, 0),
    [filtered],
  );

  const groupedFiltered = useMemo(() => groupTreasuryBondSeries(filtered), [filtered]);
  const groupedAllCount = useMemo(() => groupTreasuryBondSeries(allInstruments).length, [allInstruments]);
  const groupedHeldCount = useMemo(
    () => groupTreasuryBondSeries(allInstruments.filter((instrument) => instrument.totalQuantity > 0)).length,
    [allInstruments],
  );
  const displayRows = useMemo(() => groupedFiltered.flatMap((entry) => {
    if (entry.type === "item") return [{ instrument: entry.item, family: null, depth: 0 }];
    const instrument: InstrumentRow = {
      id: `bond-family-${entry.family}`,
      symbol: entry.family,
      name: `${treasuryBondFamilyLabel(entry.family)} · ${entry.items.length} ${entry.items.length === 1 ? "seria" : "serie"}`,
      kind: "treasuryBond",
      currency: "PLN",
      lastPrice: 0,
      lastPriceDate: null,
      valuationSource: "treasuryBond",
      valuationSourceLabel: `${entry.items.length} ${entry.items.length === 1 ? "seria" : "serie"}`,
      totalQuantity: entry.items.reduce((sum, item) => sum + item.totalQuantity, 0),
      marketValue: entry.items.reduce((sum, item) => sum + item.marketValue, 0),
      portfolios: [...new Set(entry.items.flatMap((item) => item.portfolios))],
    };
    const parent = { instrument, family: entry.family, depth: 0 };
    return expandedFamilies.has(entry.family)
      ? [parent, ...entry.items.map((item) => ({ instrument: item, family: null, depth: 1 }))]
      : [parent];
  }), [expandedFamilies, groupedFiltered]);
  const toggleFamily = (family: GroupedTreasuryBondFamily) => {
    setExpandedFamilies((current) => {
      const next = new Set(current);
      if (next.has(family)) next.delete(family);
      else next.add(family);
      return next;
    });
  };
  const editableInstruments = useMemo(() => {
    if (!records) {
      return [];
    }

    return records
      .filter((record) => !record.deletedAt && record.envelope.type === "asset")
      .map((record) => {
        const payload = record.envelope.payload as {
          id: string;
          symbol: string;
          name: string;
          kind: string;
          currency: string;
          category?: string | null;
        };

        return {
          id: payload.id,
          symbol: payload.symbol,
          name: payload.name,
          kind: payload.kind,
          currency: payload.currency,
          category: payload.category ?? null,
          updatedAt: record.updatedAt,
        };
      });
  }, [records]);

  const editingInstrument = editingInstrumentId
    ? editableInstruments.find((instrument) => instrument.id === editingInstrumentId) ?? null
    : null;

  async function handleDeleteInstrument(id: string) {
    if (!userDataKey || !supabase || !records) {
      return;
    }

    const linkedRecords = records.filter((record) => {
      if (record.deletedAt) {
        return false;
      }

      if (record.envelope.type === "transaction") {
        return (record.envelope.payload as { instrumentID?: string | null }).instrumentID === id;
      }

      if (record.envelope.type === "manualValuation") {
        return (record.envelope.payload as { instrumentID?: string }).instrumentID === id;
      }

      return false;
    }).length;

    if (linkedRecords > 0) {
      window.alert("Nie można usunąć instrumentu, który ma wyceny albo transakcje.");
      return;
    }

    if (!window.confirm("Usunąć instrument?")) {
      return;
    }

    setDeletingId(id);

    try {
      const sourceRecord = records.find(
        (record) =>
          !record.deletedAt &&
          record.envelope.type === "asset" &&
          record.id === id,
      );
      const result = await deleteRecord(supabase, "asset", id, {
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

  async function handleFetchQuote(inst: (typeof allInstruments)[number]) {
    const requestSymbol = yahooSymbolForInstrument(inst.symbol, inst.currency);
    if (!requestSymbol) {
      setQuoteError("Instrument nie ma symbolu do pobrania ceny.");
      return;
    }

    setQuoteLoadingId(inst.id);
    setQuotePreview(null);
    setQuoteMessage(null);
    setQuoteError(null);

    try {
      if (isFakeSyncEnabled()) {
        setQuotePreview({
          instrumentId: inst.id,
          requestSymbol,
          quote: buildFakeQuote(inst),
        });
        return;
      }

      const response = await fetch(
        `/api/market-data/quote?symbol=${encodeURIComponent(inst.symbol)}&currency=${encodeURIComponent(inst.currency)}`,
      );
      const body = await response.json() as { data?: MarketQuote; error?: string };

      if (!response.ok || !body.data) {
        throw new Error(body.error ?? "Nie udało się pobrać ceny.");
      }

      setQuotePreview({
        instrumentId: inst.id,
        requestSymbol,
        quote: body.data,
      });
    } catch (fetchError) {
      setQuoteError(
        fetchError instanceof Error
          ? fetchError.message
          : "Nie udało się pobrać ceny.",
      );
    } finally {
      setQuoteLoadingId(null);
    }
  }

  async function handleAcceptQuote(inst: (typeof allInstruments)[number]) {
    if (!quotePreview || quotePreview.instrumentId !== inst.id) {
      return;
    }

    if (isFakeSyncEnabled() && records) {
      const quote = quotePreview.quote;
      const nextRecords = [
        ...records,
        buildFakeManualValuationRecord({
          instrumentID: inst.id,
          date: `${quote.date}T00:00:00.000Z`,
          value: quote.close,
          currency: quoteCurrencyForInstrument(quote, inst.currency),
        }),
      ];
      setSync(
        nextRecords,
        buildInvestorDataSnapshot(nextRecords, {
          asOf: new Date(),
          historyGranularity: "daily",
          useLatestTransactionFxRate: true,
          useMarketQuotes: true,
        }),
      );
      setQuotePreview(null);
      setQuoteMessage("Cena została zapisana lokalnie w fake sync.");
      return;
    }

    if (!supabase || !userDataKey) {
      setQuoteError("Odblokuj dane w panelu synchronizacji przed zapisem ceny.");
      return;
    }

    setQuoteSavingId(inst.id);
    setQuoteMessage(null);
    setQuoteError(null);

    try {
      const quote = quotePreview.quote;
      const result = await saveRecord(
        supabase,
        userDataKey,
        "manualValuation",
        makeManualValuationPayload({
          id: crypto.randomUUID(),
          instrumentID: inst.id,
          date: `${quote.date}T00:00:00.000Z`,
          value: quote.close,
          currency: quoteCurrencyForInstrument(quote, inst.currency),
        }),
        { baseUpdatedAt: null },
      );

      if (!result.queued) {
        const { records: nextRecords, snapshot: nextSnapshot } = await refreshSyncStore(
          supabase,
          userDataKey,
        );
        setSync(nextRecords, nextSnapshot);
      }

      setQuotePreview(null);
      setQuoteMessage(
        result.queued
          ? "Cena czeka w kolejce sync."
          : "Cena została zapisana jako wycena manualna.",
      );
    } catch (saveError) {
      setQuoteError(
        saveError instanceof Error
          ? saveError.message
          : "Nie udało się zapisać ceny.",
      );
    } finally {
      setQuoteSavingId(null);
    }
  }

  const selectStyle: CSSProperties = v2SelectStyle;
  const best = [...allInstruments]
    .filter((instrument) => instrument.totalQuantity > 0)
    .sort((a, b) => b.marketValue - a.marketValue)[0];
  const pricedCount = allInstruments.filter((instrument) => instrument.lastPrice > 0).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: V2_TYPE.ui, color: V2.ink }}>
      <V2ScreenHead
        eyebrow="Analiza"
        title="Instrumenty"
        sub={records ? `${groupedAllCount} pozycji · ${groupedHeldCount} w portfelu` : "Odblokuj dane w panelu synchronizacji"}
        action={(
          <V2Button
            onClick={() => {
              setEditingInstrumentId(null);
              setEditorOpen(true);
            }}
            disabled={!userDataKey}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>Dodaj instrument
          </V2Button>
        )}
      />

      {records && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
          <V2Card pad={20}><V2Kpi label="Wartość rynkowa" value={`${fmt(totalValue)} ${displayCurrency}`} sub={`${groupedHeldCount} aktywnych pozycji`} /></V2Card>
          <V2Card pad={20}><V2Kpi label="Największa pozycja" value={best?.symbol ?? "—"} accent={V2.profit} sub={best ? `${fmt(best.marketValue)} ${displayCurrency}` : "Brak aktywów"} /></V2Card>
          <V2Card pad={20}><V2Kpi label="Wyceny" value={`${pricedCount}/${allInstruments.length}`} accent={V2.bonds} sub="instrumenty z ceną" /></V2Card>
        </div>
      )}

      {/* Summary chips */}
      {records && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { label: "Wszystkie", value: "all" as HeldFilter },
            { label: "W portfelu", value: "held" as HeldFilter },
            { label: "Zamknięte", value: "closed" as HeldFilter },
          ].map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setHeldFilter(value)}
              style={{
                padding: "7px 14px",
                borderRadius: 99,
                border: `0.5px solid ${heldFilter === value ? "transparent" : V2.line}`,
                background: heldFilter === value ? V2.ink : V2.card,
                color: heldFilter === value ? V2.card : V2.muted,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: heldFilter === value
                  ? `0 2px 8px ${v2Mix(V2.ink, 0.18)}`
                  : "none",
                transition: "all .15s",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {records && (
        <div
          style={{
            padding: "13px 16px",
            background: V2.card,
            borderRadius: 16,
            border: `0.5px solid ${
              marketDataStatus?.providers.yahoo.configured === false
                ? v2Mix(V2.bonds, 0.28)
                : V2.line
            }`,
            boxShadow: `0 1px 0 ${v2Mix(V2.ink, 0.03)}, 0 6px 20px ${v2Mix(V2.ink, 0.05)}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ color: V2.ink, fontSize: 13.5, fontWeight: 800 }}>
              Diagnostyka market data
            </div>
            <div style={{ color: V2.muted, fontSize: 12, marginTop: 3, lineHeight: 1.45 }}>
              {marketDataStatusError
                ? marketDataStatusError
                : marketDataStatus?.providers.yahoo.configured
                  ? "Yahoo Finance jest skonfigurowany."
                  : "Sprawdzam konfigurację providerów..."}
            </div>
          </div>
          <div
            style={{
              borderRadius: 99,
              background:
                marketDataStatus?.providers.yahoo.configured === false
                  ? v2Mix(V2.bonds, 0.12)
                  : v2Mix(V2.profit, 0.12),
              color:
                marketDataStatus?.providers.yahoo.configured === false
                  ? V2.bonds
                  : V2.profit,
              fontSize: 11,
              fontWeight: 800,
              padding: "6px 10px",
              whiteSpace: "nowrap",
            }}
          >
            Yahoo · {marketDataStatus
              ? marketDataStatus.providers.yahoo.configured
                ? "OK"
                : "niedostępny"
              : "sprawdzam"}
          </div>
        </div>
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
              placeholder="Szukaj nazwy, symbolu…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                ...v2InputStyle,
              }}
            />
          </div>

          <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} style={selectStyle}>
            <option value={KIND_ALL}>Wszystkie klasy</option>
            {kinds.map((k) => (
              <option key={k} value={k}>{KIND_LABELS[k] ?? k}</option>
            ))}
          </select>

          {(search || kindFilter !== KIND_ALL) && (
            <button
              onClick={() => { setSearch(""); setKindFilter(KIND_ALL); }}
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

          <div style={{ marginLeft: "auto", fontFamily: V2_TYPE.mono, fontSize: 11.5, color: V2.subtle }}>
            {groupedFiltered.length} wyników
            {totalValue > 0 && (
              <> · <strong style={{ color: V2.ink }}>{fmt(totalValue)} {displayCurrency}</strong></>
            )}
          </div>
        </div>
      )}

      {records && (quoteMessage || quoteError) && (
        <div
          style={{
            padding: "10px 14px",
            background: V2.card,
            borderRadius: 14,
            border: `0.5px solid ${quoteError ? v2Mix(V2.loss, 0.18) : v2Mix(V2.profit, 0.18)}`,
            color: quoteError ? LOSS : PROFIT,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {quoteError ?? quoteMessage}
        </div>
      )}

      {/* Table */}
      <div style={{ ...glassCard, padding: 0 }}>
        {/* Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,2.5fr) 80px minmax(0,0.8fr) minmax(0,0.8fr) minmax(0,1.1fr) minmax(0,1fr) 220px",
            padding: "10px 22px",
            background: v2Mix(V2.ink, 0.022),
            borderBottom: `0.5px solid ${LINE_SOFT}`,
            borderRadius: "16px 16px 0 0",
          }}
        >
          {["Instrument", "Klasa", "Ilość", "Cena", "Wartość", "Portfele", "Akcje"].map((h, i) => (
            <div
              key={h}
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: V2.subtle,
                textTransform: "uppercase",
                letterSpacing: ".08em",
                textAlign: i <= 1 ? "left" : "right",
              }}
            >
              {h}
            </div>
          ))}
        </div>

        {!records && (
          <div style={{ padding: "48px 22px", textAlign: "center" }}>
            <div style={{ fontSize: 32, opacity: 0.12, marginBottom: 12 }}>◈</div>
            <div style={{ fontSize: 14, color: SUBTLE }}>
              Odblokuj dane w panelu synchronizacji
            </div>
          </div>
        )}

        {records && filtered.length === 0 && (
          <div style={{ padding: "32px 22px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: SUBTLE }}>Brak instrumentów dla wybranych filtrów</div>
          </div>
        )}

        {displayRows.map(({ instrument: inst, family, depth }) => {
          const color = KIND_COLORS[inst.kind] ?? SUBTLE;
          const kindLabel = KIND_LABELS[inst.kind] ?? inst.kind;
          const isHeld = inst.totalQuantity > 0;
          const isGroup = family !== null;
          const preview = quotePreview?.instrumentId === inst.id ? quotePreview : null;
          const isLoadingQuote = quoteLoadingId === inst.id;
          const isSavingQuote = quoteSavingId === inst.id;

          return (
            <div key={inst.id}>
              <div
                role="row"
                aria-label={`${inst.symbol} ${inst.name}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,2.5fr) 80px minmax(0,0.8fr) minmax(0,0.8fr) minmax(0,1.1fr) minmax(0,1fr) 220px",
                  padding: "14px 22px",
                  paddingLeft: depth ? 42 : 22,
                  borderTop: `0.5px solid ${LINE_SOFT}`,
                  alignItems: "center",
                  opacity: isHeld ? 1 : 0.5,
                  transition: "background .12s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = v2Mix(V2.ink, 0.022))}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {/* Name + symbol */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      background: `${color}14`,
                      border: `1.5px solid ${color}${isHeld ? "40" : "20"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 800,
                      color: isHeld ? color : `${color}80`,
                      flexShrink: 0,
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {inst.symbol.slice(0, 4).toUpperCase()}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: V2.ink }}>{inst.name}</div>
                    <div style={{ fontFamily: V2_TYPE.mono, fontSize: 11, color: V2.subtle }}>{inst.symbol} · {inst.currency}</div>
                  </div>
                  {isGroup && (
                    <button
                      type="button"
                      onClick={() => toggleFamily(family!)}
                      aria-label={`${expandedFamilies.has(family!) ? "Zwiń" : "Rozwiń"} serie ${family}`}
                      aria-expanded={expandedFamilies.has(family!)}
                      style={{ marginLeft: "auto", width: 24, height: 24, border: "none", background: "transparent", color, cursor: "pointer", fontSize: 18, padding: 0, flexShrink: 0 }}
                    >
                      {expandedFamilies.has(family!) ? "⌄" : "›"}
                    </button>
                  )}
                </div>

                {/* Kind badge */}
                <div>
                  <V2Badge label={kindLabel} color={color} />
                </div>

                {/* Quantity */}
                <div style={{ textAlign: "right", fontFamily: V2_TYPE.mono, fontSize: 12.5, color: isHeld ? V2.ink : V2.subtle, fontVariantNumeric: "tabular-nums" }}>
                  {fmtQty(inst.totalQuantity)}
                </div>

                {/* Last price */}
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: V2_TYPE.mono, fontSize: 12.5, color: V2.ink, fontVariantNumeric: "tabular-nums" }}>
                    {inst.lastPrice > 0 ? fmt(inst.lastPrice, 2) : "—"}
                  </div>
                  <div
                    style={{
                      fontFamily: V2_TYPE.mono,
                      fontSize: 10.5,
                      color: inst.valuationSource === "missing" ? LOSS : V2.subtle,
                      marginTop: 2,
                    }}
                  >
                    {inst.valuationSourceLabel}
                    {inst.lastPriceDate ? ` · ${fmtDate(inst.lastPriceDate)}` : ""}
                  </div>
                </div>

                {/* Market value */}
                <div style={{ textAlign: "right" }}>
                  {isHeld ? (
                    <div style={{ fontFamily: V2_TYPE.serif, fontSize: 16, fontWeight: 500, color: V2.ink, fontVariantNumeric: "tabular-nums" }}>
                      {fmt(inst.marketValue)}{" "}
                      <span style={{ fontSize: 10, opacity: 0.5 }}>{displayCurrency}</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: V2.subtle }}>—</div>
                  )}
                </div>

                {/* Portfolios */}
                <div style={{ textAlign: "right" }}>
                  {inst.portfolios.length > 0 ? (
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      {inst.portfolios.map((pf) => (
                        <span
                          key={pf}
                          style={{
                            fontSize: 10,
                            padding: "2px 7px",
                            borderRadius: 5,
                            background: v2Mix(V2.profit, 0.12),
                            color: PROFIT,
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {pf}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: V2.subtle }}>—</span>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, flexWrap: "wrap" }}>
                  {isGroup ? (
                    <button
                      type="button"
                      onClick={() => toggleFamily(family!)}
                      aria-expanded={expandedFamilies.has(family!)}
                      style={{ padding: "6px 10px", borderRadius: 8, border: `0.5px solid ${V2.line}`, background: v2Mix(V2.card, 0.72), color: V2.muted, fontSize: 12, cursor: "pointer", fontFamily: V2_TYPE.ui }}
                    >
                      {expandedFamilies.has(family!) ? "Zwiń serie" : "Pokaż serie"}
                    </button>
                  ) : (
                  <>
                  <button
                    onClick={() => void handleFetchQuote(inst)}
                    disabled={!userDataKey || isLoadingQuote || isSavingQuote}
                    title="Pobierz cenę Yahoo Finance"
                    style={{
                      padding: "6px 9px",
                      borderRadius: 8,
                      border: `0.5px solid ${v2Mix(V2.profit, 0.2)}`,
                      background: isLoadingQuote ? v2Mix(V2.profit, 0.08) : v2Mix(V2.card, 0.72),
                      color: userDataKey ? PROFIT : SUBTLE,
                      fontSize: 12,
                      cursor: !userDataKey || isLoadingQuote || isSavingQuote ? "not-allowed" : "pointer",
                      fontFamily: V2_TYPE.ui,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <RefreshCw size={13} />
                    {isLoadingQuote ? "Pobieram" : "Cena"}
                  </button>
                  <button
                    onClick={() => {
                      setEditingInstrumentId(inst.id);
                      setEditorOpen(true);
                    }}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: `0.5px solid ${V2.line}`,
                      background: v2Mix(V2.card, 0.72),
                      color: V2.muted,
                      fontSize: 12,
                      cursor: "pointer",
                      fontFamily: V2_TYPE.ui,
                    }}
                  >
                    Edytuj
                  </button>
                  <button
                    onClick={() => void handleDeleteInstrument(inst.id)}
                    disabled={!userDataKey || deletingId === inst.id}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: `0.5px solid ${v2Mix(V2.loss, 0.18)}`,
                      background: deletingId === inst.id ? v2Mix(V2.loss, 0.08) : "transparent",
                      color: deletingId === inst.id ? V2.loss : V2.subtle,
                      fontSize: 12,
                      cursor: !userDataKey || deletingId === inst.id ? "not-allowed" : "pointer",
                      fontFamily: V2_TYPE.ui,
                    }}
                  >
                    {deletingId === inst.id ? "Usuwam…" : "Usuń"}
                  </button>
                  </>
                  )}
                </div>
              </div>

              {!isGroup && preview && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    padding: "12px 22px 14px 66px",
                    borderTop: `0.5px solid ${LINE_SOFT}`,
                    background: "rgba(45,156,107,0.045)",
                  }}
                >
                  <div>
                    <div style={{ color: INK, fontSize: 13, fontWeight: 800 }}>
                      {fmt(preview.quote.close, 2)} {quoteCurrencyForInstrument(preview.quote, inst.currency)}
                    </div>
                    <div style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>
                      Yahoo {preview.quote.symbol || preview.requestSymbol} · {preview.quote.date} · zapisze jako wycenę manualną
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      onClick={() => void handleAcceptQuote(inst)}
                      disabled={isSavingQuote}
                      style={{
                        padding: "7px 11px",
                        borderRadius: 8,
                        border: "none",
                        background: PROFIT,
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: isSavingQuote ? "not-allowed" : "pointer",
                        fontFamily: "inherit",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <Check size={13} />
                      {isSavingQuote ? "Zapisuję" : "Zapisz"}
                    </button>
                    <button
                      onClick={() => setQuotePreview(null)}
                      disabled={isSavingQuote}
                      title="Odrzuć cenę"
                      aria-label="Odrzuć cenę"
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        border: "0.5px solid rgba(28,49,68,0.12)",
                        background: "rgba(255,255,255,0.7)",
                        color: MUTED,
                        cursor: isSavingQuote ? "not-allowed" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <InstrumentEditorModal
        open={editorOpen}
        initialValue={editingInstrument}
        onClose={() => {
          setEditorOpen(false);
          setEditingInstrumentId(null);
        }}
      />
    </div>
  );
}
