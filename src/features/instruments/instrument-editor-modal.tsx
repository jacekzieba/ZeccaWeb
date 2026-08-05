"use client";

import { token } from "@/design/tokens";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { useSyncStore } from "@/sync/store/sync-store";
import { refreshSyncStore, saveRecord } from "@/sync/records/record-writer";
import { makeAssetPayload } from "@/sync/records/macos-payloads";
import { buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";
import { isFakeSyncEnabled } from "@/lib/env";
import type { InstrumentCandidate } from "@/market-data/types";

const SEARCH_DEBOUNCE_MS = 350;

const INK = token("ink");
const MUTED = "rgba(28,49,68,0.58)";
const SUBTLE = "rgba(28,49,68,0.38)";
const LINE_SOFT = "rgba(28,49,68,0.06)";
const LOSS = token("down");
const AMBER = token("accent");
const PAPER = token("ground");

const CURRENCIES = ["PLN", "USD", "EUR", "GBP", "CHF", "CZK"];

const KIND_OPTIONS = [
  { value: "stock", label: "Akcja" },
  { value: "etf", label: "ETF" },
  { value: "treasuryBond", label: "Obligacja skarbowa" },
  { value: "listedBond", label: "Obligacja giełdowa" },
  { value: "crypto", label: "Kryptowaluta" },
  { value: "deposit", label: "Lokata" },
  { value: "cash", label: "Gotówka" },
] as const;

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 10.5,
  fontWeight: 700,
  color: SUBTLE,
  textTransform: "uppercase",
  letterSpacing: ".08em",
  marginBottom: 5,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 9,
  border: "0.5px solid rgba(28,49,68,0.14)",
  background: PAPER,
  fontSize: 13,
  color: INK,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
  boxShadow: "inset 0 1px 3px rgba(28,49,68,0.05)",
};

type InstrumentDraft = {
  id: string;
  symbol: string;
  name: string;
  kind: string;
  currency: string;
  category: string | null;
  exchange?: string | null;
  country?: string | null;
  isin?: string | null;
  marketDataID?: string | null;
  updatedAt: string;
};

export type SavedInstrumentDraft = {
  id: string;
  symbol: string;
  name: string;
  kind: string;
  currency: string;
  category: string | null;
  exchange: string | null;
  country: string | null;
  isin: string | null;
  marketDataID: string | null;
  updatedAt: string;
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

export function InstrumentEditorModal({
  open,
  initialValue,
  defaultValue,
  onClose,
  onSaved,
  zIndex = 200,
}: {
  open: boolean;
  initialValue: InstrumentDraft | null;
  defaultValue?: Partial<Pick<InstrumentDraft, "symbol" | "name" | "kind" | "currency" | "category">>;
  onClose(): void;
  onSaved?: (instrument: SavedInstrumentDraft) => void;
  zIndex?: number;
}) {
  const userDataKey = useSyncStore((s) => s.userDataKey);
  const supabase = useSyncStore((s) => s.supabase);
  const records = useSyncStore((s) => s.records);
  const setSync = useSyncStore((s) => s.setSync);
  const [mounted, setMounted] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState("stock");
  const [currency, setCurrency] = useState("PLN");
  const [category, setCategory] = useState("");
  const [exchange, setExchange] = useState("");
  const [isin, setIsin] = useState("");
  const [marketDataID, setMarketDataID] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<InstrumentCandidate[]>([]);
  const [bondParams, setBondParams] = useState<Record<string, unknown> | null>(null);
  const [bondFetch, setBondFetch] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => setMounted(true), []);

  const defaultSymbol = defaultValue?.symbol;
  const defaultName = defaultValue?.name;
  const defaultKind = defaultValue?.kind;
  const defaultCurrency = defaultValue?.currency;
  const defaultCategory = defaultValue?.category;

  useEffect(() => {
    if (!open) {
      return;
    }

    setSymbol(initialValue?.symbol ?? defaultSymbol ?? "");
    setName(initialValue?.name ?? defaultName ?? "");
    setKind(initialValue?.kind ?? defaultKind ?? "stock");
    setCurrency(initialValue?.currency ?? defaultCurrency ?? "PLN");
    setCategory(initialValue?.category ?? defaultCategory ?? "");
    setExchange(initialValue?.exchange ?? "");
    setIsin(initialValue?.isin ?? "");
    setMarketDataID(initialValue?.marketDataID ?? "");
    setSaving(false);
    setError(null);
    setCandidates([]);
    setBondParams(null);
    setBondFetch("idle");
  }, [
    defaultCategory,
    defaultCurrency,
    defaultKind,
    defaultName,
    defaultSymbol,
    initialValue,
    open,
  ]);

  const applyCandidate = useCallback((candidate: InstrumentCandidate) => {
    setSymbol(candidate.symbol);
    // Only fill the name when the user hasn't typed one — never clobber input.
    setName((current) => (current.trim() ? current : candidate.name));
    if (candidate.currency && CURRENCIES.includes(candidate.currency)) {
      setCurrency(candidate.currency);
    }
    setExchange(candidate.exchange ?? "");
    setMarketDataID(candidate.symbol);
    setCandidates([]);
  }, []);

  // Yahoo autocomplete: only stocks and ETFs are searchable here. Debounce the
  // symbol input and abort any in-flight request/timer when it changes, when
  // the modal closes, or on unmount. Errors/offline stay silent — this is a
  // typeahead, not a validated field.
  useEffect(() => {
    if (!open || (kind !== "stock" && kind !== "etf")) {
      setCandidates([]);
      return;
    }

    const query = symbol.trim();
    if (!query) {
      setCandidates([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, kind });
        const response = await fetch(`/api/market-data/search?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          return;
        }
        const body = (await response.json()) as { data?: InstrumentCandidate[] };
        const results = body.data ?? [];
        if (results.length === 1) {
          applyCandidate(results[0]!);
        } else {
          setCandidates(results);
        }
      } catch {
        // Silent: aborts, network failures and parse errors leave the field as-is.
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [symbol, kind, open, applyCandidate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userDataKey || !supabase) {
      setError("Odblokuj dane w panelu synchronizacji, żeby zapisywać instrumenty.");
      return;
    }

    const trimmedSymbol = symbol.trim().toUpperCase();
    const trimmedName = name.trim();
    const trimmedExchange = exchange.trim();
    const trimmedIsin = isin.trim().toUpperCase();
    const trimmedMarketDataID = marketDataID.trim().toUpperCase();
    if (!trimmedSymbol || !trimmedName) {
      setError("Symbol i nazwa instrumentu są wymagane.");
      return;
    }
    if ((kind === "stock" || kind === "etf") && !trimmedMarketDataID) {
      setError("Dla akcji i ETF wybierz notowanie albo wpisz ticker Yahoo.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const id = initialValue?.id ?? crypto.randomUUID();
      const savedInstrument: SavedInstrumentDraft = {
        id,
        symbol: trimmedSymbol,
        name: trimmedName,
        kind,
        currency,
        category: category.trim() || null,
        exchange: trimmedExchange || null,
        country: initialValue?.country ?? null,
        isin: trimmedIsin || null,
        marketDataID: trimmedMarketDataID || null,
        updatedAt: new Date().toISOString(),
      };
      const payload = makeAssetPayload({
        id: savedInstrument.id,
        kind: savedInstrument.kind,
        symbol: savedInstrument.symbol,
        name: savedInstrument.name,
        currency: savedInstrument.currency,
        category: savedInstrument.category,
        exchange: savedInstrument.exchange,
        country: savedInstrument.country,
        isin: savedInstrument.isin,
        marketDataID: savedInstrument.marketDataID,
        bondParams: kind === "treasuryBond" ? bondParams : null,
      });
      if (isFakeSyncEnabled() && records) {
        const now = new Date().toISOString();
        const nextRecords = [
          ...records.filter((record) => record.id !== id),
          { id, deviceId: "fake-sync-web", updatedAt: now, deletedAt: null, envelope: { type: "asset" as const, payloadVersion: 1, schemaVersion: 1, payload } },
        ];
        setSync(nextRecords, buildInvestorDataSnapshot(nextRecords, { asOf: new Date(), historyGranularity: "daily", useLatestTransactionFxRate: true, useMarketQuotes: true }));
      } else {
        const result = await saveRecord(supabase, userDataKey, "asset", payload, { baseUpdatedAt: initialValue?.updatedAt ?? null });
        if (!result.queued) {
          const { records, snapshot } = await refreshSyncStore(supabase, userDataKey);
          setSync(records, snapshot);
        }
      }
      onSaved?.(savedInstrument);
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Nie udało się zapisać instrumentu.",
      );
      setSaving(false);
    }
  }

  async function handleFetchBondParams() {
    const code = symbol.trim().toUpperCase();
    if (!code) return;
    setBondFetch("loading");
    try {
      const res = await fetch(`/api/market-data/bond-params?code=${encodeURIComponent(code)}`);
      const json = (await res.json()) as { data?: Record<string, unknown> };
      if (!res.ok || !json.data) {
        setBondParams(null);
        setBondFetch("error");
        return;
      }
      setBondParams(json.data);
      setBondFetch("idle");
    } catch {
      setBondParams(null);
      setBondFetch("error");
    }
  }

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(28,49,68,0.45)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      />

      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 520,
          background: PAPER,
          borderRadius: 18,
          boxShadow: "0 24px 64px rgba(28,49,68,0.22), inset 0 0.5px 0 rgba(255,255,255,0.8)",
          border: "0.5px solid rgba(255,255,255,0.7)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 22px 14px",
            borderBottom: `0.5px solid ${LINE_SOFT}`,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: INK }}>
            {initialValue ? "Edytuj instrument" : "Dodaj instrument"}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              border: "none",
              background: "rgba(28,49,68,0.07)",
              color: MUTED,
              fontSize: 16,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>

        {!userDataKey && (
          <div
            style={{
              padding: "16px 22px",
              background: `${AMBER}12`,
              borderBottom: `0.5px solid ${LINE_SOFT}`,
            }}
          >
            <div style={{ fontSize: 12, color: AMBER, fontWeight: 600 }}>
              Odblokuj dane w panelu synchronizacji, żeby zapisywać instrumenty.
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{
            padding: "18px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12 }}>
            <Field label="Symbol">
              <input
                type="text"
                value={symbol}
                onChange={(event) => setSymbol(event.target.value)}
                placeholder="np. VWCE, BTC, EDO1033"
                style={inputStyle}
                required
              />
            </Field>
            <Field label="Nazwa">
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="np. Vanguard FTSE All-World"
                style={inputStyle}
                required
              />
            </Field>
          </div>

          {candidates.length > 1 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                borderRadius: 9,
                border: `0.5px solid ${LINE_SOFT}`,
                background: PAPER,
                overflow: "hidden",
              }}
            >
              {candidates.map((candidate, index) => (
                <button
                  key={`${candidate.symbol}-${index}`}
                  type="button"
                  onClick={() => applyCandidate(candidate)}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                    padding: "8px 12px",
                    border: "none",
                    borderTop: index === 0 ? "none" : `0.5px solid ${LINE_SOFT}`,
                    background: "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: 12,
                      fontWeight: 700,
                      color: INK,
                      flexShrink: 0,
                    }}
                  >
                    {candidate.symbol}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: MUTED,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}
                  >
                    {candidate.name}
                  </span>
                  {(candidate.exchange || candidate.currency) && (
                    <span style={{ fontSize: 10.5, color: SUBTLE, flexShrink: 0 }}>
                      {[candidate.exchange, candidate.currency]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12 }}>
            <Field label="Klasa aktywa">
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value)}
                style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
              >
                {KIND_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Waluta">
              <select
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
              >
                {CURRENCIES.map((currencyCode) => (
                  <option key={currencyCode} value={currencyCode}>
                    {currencyCode}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {kind === "treasuryBond" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ color: MUTED, fontSize: 11.5, lineHeight: 1.45 }}>
                Parametry emisji (oprocentowanie, marża, daty) pobieramy z listu emisyjnego dla podanej serii — np. EDO0736.
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={handleFetchBondParams}
                  disabled={bondFetch === "loading" || !symbol.trim()}
                  style={{
                    border: "0.5px solid rgba(28,49,68,0.14)",
                    borderRadius: 8,
                    background: PAPER,
                    color: INK,
                    cursor: bondFetch === "loading" || !symbol.trim() ? "default" : "pointer",
                    fontSize: 12.5,
                    fontWeight: 600,
                    padding: "7px 12px",
                    opacity: bondFetch === "loading" || !symbol.trim() ? 0.6 : 1,
                  }}
                >
                  {bondFetch === "loading" ? "Pobieranie…" : "Pobierz parametry"}
                </button>
                {bondParams && (
                  <span style={{ fontSize: 12, color: MUTED }}>
                    {`Pobrano: ${Number(bondParams.firstPeriodRate)}% · ${String(bondParams.subsequentBase)}`}
                    {Number(bondParams.marginOverBase) > 0 && String(bondParams.subsequentBase) !== "stałe"
                      ? ` + marża ${Number(bondParams.marginOverBase)}%`
                      : ""}
                  </span>
                )}
                {bondFetch === "error" && (
                  <span style={{ fontSize: 12, color: LOSS }}>
                    Nie znaleziono listu emisyjnego — sprawdź kod serii.
                  </span>
                )}
              </div>
            </div>
          )}

          {(kind === "stock" || kind === "etf") && (
            <>
              <div style={{ color: MUTED, fontSize: 11.5, lineHeight: 1.45 }}>
                Potwierdź tożsamość instrumentu: ticker brokera, walutę rozliczenia i dokładne notowanie Yahoo są zapisywane osobno.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Ticker Yahoo">
                  <input
                    type="text"
                    value={marketDataID}
                    onChange={(event) => setMarketDataID(event.target.value)}
                    placeholder="np. VWRL.L"
                    style={inputStyle}
                    required
                  />
                </Field>
                <Field label="Giełda / listing">
                  <input
                    type="text"
                    value={exchange}
                    onChange={(event) => setExchange(event.target.value)}
                    placeholder="np. LSE"
                    style={inputStyle}
                  />
                </Field>
              </div>
              <Field label="ISIN">
                <input
                  type="text"
                  value={isin}
                  onChange={(event) => setIsin(event.target.value)}
                  placeholder="np. IE00B3RBWM25"
                  style={inputStyle}
                />
              </Field>
            </>
          )}

          <Field label="Kategoria">
            <input
              type="text"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="opcjonalnie, np. Global equity"
              style={inputStyle}
            />
          </Field>

          {error && (
            <div
              style={{
                fontSize: 12,
                color: LOSS,
                padding: "8px 12px",
                borderRadius: 8,
                background: `${LOSS}10`,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "9px 18px",
                borderRadius: 9,
                border: "0.5px solid rgba(28,49,68,0.14)",
                background: "transparent",
                color: MUTED,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={saving || !userDataKey}
              style={{
                padding: "9px 20px",
                borderRadius: 9,
                border: "none",
                background: saving || !userDataKey ? "rgba(28,49,68,0.12)" : INK,
                color: saving || !userDataKey ? SUBTLE : "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: saving || !userDataKey ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {saving ? "Zapisuję…" : initialValue ? "Zapisz zmiany" : "Dodaj instrument"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
