"use client";

import { createPortal } from "react-dom";
import { useState, useEffect, useMemo, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useSyncStore } from "@/sync/store/sync-store";
import { refreshSyncStore, saveRecord } from "@/sync/records/record-writer";
import {
  makeTransactionPayload,
  swiftReferenceSeconds,
} from "@/sync/records/macos-payloads";

const INK = "#1C3144";
const MUTED = "rgba(28,49,68,0.58)";
const SUBTLE = "rgba(28,49,68,0.38)";
const LINE_SOFT = "rgba(28,49,68,0.06)";
const LOSS = "#B85042";
const AMBER = "#B87830";
const PAPER = "#FBFAF6";

const TX_TYPES = [
  { value: "buy",           label: "Kupno",                  needsInstrument: true,  needsQty: true  },
  { value: "sell",          label: "Sprzedaż",               needsInstrument: true,  needsQty: true  },
  { value: "cashDeposit",   label: "Wpłata gotówki",         needsInstrument: false, needsQty: false },
  { value: "cashWithdrawal",label: "Wypłata gotówki",        needsInstrument: false, needsQty: false },
  { value: "dividend",      label: "Dywidenda",              needsInstrument: true,  needsQty: false },
  { value: "interest",      label: "Odsetki",                needsInstrument: false, needsQty: false },
  { value: "bondCoupon",    label: "Kupon obligacji",        needsInstrument: true,  needsQty: false },
  { value: "bondRedemption",label: "Wykup obligacji",        needsInstrument: true,  needsQty: true  },
  { value: "depositOpen",   label: "Otwarcie lokaty",        needsInstrument: true,  needsQty: false },
  { value: "depositClose",  label: "Zamknięcie lokaty",      needsInstrument: true,  needsQty: false },
  { value: "fee",           label: "Opłata",                 needsInstrument: false, needsQty: false },
  { value: "tax",           label: "Podatek",                needsInstrument: false, needsQty: false },
] as const;

const CURRENCIES = ["PLN", "USD", "EUR", "GBP", "CHF", "CZK"];

// ── Styles ───────────────────────────────────────────────────────
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

const selectStyle: CSSProperties = {
  ...inputStyle,
  appearance: "none" as const,
  cursor: "pointer",
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

export type TransactionEditorDraft = {
  id: string;
  date: string;
  portfolioId: string;
  instrumentId: string | null;
  transactionType: string;
  quantity: number | null;
  price: number | null;
  grossAmount: number;
  currency: string;
  fees: number;
  taxes: number;
  updatedAt: string;
};

export function AddTransactionModal({
  open: controlledOpen,
  initialValue,
  onClose,
}: {
  open?: boolean;
  initialValue?: TransactionEditorDraft | null;
  onClose?: () => void;
}) {
  const globalOpen = useSyncStore((s) => s.addTransactionOpen);
  const close = useSyncStore((s) => s.closeAddTransaction);
  const records = useSyncStore((s) => s.records);
  const userDataKey = useSyncStore((s) => s.userDataKey);
  const supabase = useSyncStore((s) => s.supabase);
  const setSync = useSyncStore((s) => s.setSync);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const open = controlledOpen ?? globalOpen;
  const isEditing = Boolean(initialValue);

  // Form state
  const today = new Date().toISOString().slice(0, 10);
  const [txType, setTxType] = useState("cashDeposit");
  const [portfolioId, setPortfolioId] = useState("");
  const [instrumentId, setInstrumentId] = useState("");
  const [date, setDate] = useState(today);
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [grossAmount, setGrossAmount] = useState("");
  const [currency, setCurrency] = useState("PLN");
  const [fees, setFees] = useState("0");
  const [taxes, setTaxes] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setTxType(initialValue?.transactionType ?? "cashDeposit");
    setPortfolioId(initialValue?.portfolioId ?? "");
    setInstrumentId(initialValue?.instrumentId ?? "");
    setDate(initialValue?.date.slice(0, 10) ?? today);
    setQuantity(initialValue?.quantity != null ? String(initialValue.quantity) : "");
    setPrice(initialValue?.price != null ? String(initialValue.price) : "");
    setGrossAmount(initialValue ? String(initialValue.grossAmount) : "");
    setCurrency(initialValue?.currency ?? "PLN");
    setFees(initialValue ? String(initialValue.fees) : "0");
    setTaxes(initialValue ? String(initialValue.taxes) : "0");
    setSaving(false);
    setError(null);
  }, [initialValue, open, today]);

  // Derive portfolio list from records
  const portfolios = useMemo(() => {
    if (!records) return [];
    const seen = new Map<string, string>();
    for (const r of records) {
      if (r.deletedAt) continue;
      if (r.envelope.type === "account") {
        const p = r.envelope.payload as { id: string; name: string };
        seen.set(p.id, p.name);
      }
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [records]);

  const instruments = useMemo(() => {
    if (!records) return [];
    const seen = new Map<string, { id: string; symbol: string; name: string }>();
    for (const r of records) {
      if (r.deletedAt) continue;
      if (r.envelope.type === "asset") {
        const a = r.envelope.payload as { id: string; symbol: string; name: string };
        seen.set(a.id, a);
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, "pl"));
  }, [records]);

  // Set default portfolio when list loads
  useEffect(() => {
    if (portfolios.length > 0 && !portfolioId) {
      setPortfolioId(portfolios[0].id);
    }
  }, [portfolios, portfolioId]);

  const txDef = TX_TYPES.find((t) => t.value === txType) ?? TX_TYPES[0];

  // Auto-compute grossAmount from qty * price for buy/sell
  useEffect(() => {
    if (txDef.needsQty && quantity && price) {
      const computed = parseFloat(quantity) * parseFloat(price);
      if (!isNaN(computed)) setGrossAmount(computed.toFixed(2));
    }
  }, [quantity, price, txDef.needsQty]);

  function reset() {
    setTxType("cashDeposit");
    setInstrumentId("");
    setDate(today);
    setQuantity("");
    setPrice("");
    setGrossAmount("");
    setCurrency("PLN");
    setFees("0");
    setTaxes("0");
    setError(null);
    setSaving(false);
  }

  function handleClose() {
    reset();
    if (onClose) {
      onClose();
    } else {
      close();
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userDataKey || !supabase) {
      setError("Brak klucza danych. Odblokuj dane w panelu synchronizacji.");
      return;
    }
    if (!portfolioId) {
      setError("Wybierz portfel.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const id = initialValue?.id ?? crypto.randomUUID();
      const dateSeconds = swiftReferenceSeconds(new Date(date));

      const payload = makeTransactionPayload({
        id,
        date: dateSeconds,
        portfolioID: portfolioId,
        transactionType: txType,
        grossAmount: parseFloat(grossAmount) || 0,
        currency,
        fees: parseFloat(fees) || 0,
        taxes: parseFloat(taxes) || 0,
        instrumentID: txDef.needsInstrument && instrumentId ? instrumentId : null,
        quantity: txDef.needsQty && quantity ? parseFloat(quantity) : null,
        price: price ? parseFloat(price) : null,
      });

      const result = await saveRecord(
        supabase,
        userDataKey,
        "transaction",
        payload,
        { baseUpdatedAt: initialValue?.updatedAt ?? null },
      );

      if (!result.queued) {
        const { records: newRecords, snapshot } = await refreshSyncStore(supabase, userDataKey);
        setSync(newRecords, snapshot);
      }

      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zapisać transakcji.");
      setSaving(false);
    }
  }

  if (!mounted || !open) return null;

  const modal = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(28,49,68,0.45)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          overflowY: "auto",
          background: PAPER,
          borderRadius: 18,
          boxShadow: "0 24px 64px rgba(28,49,68,0.22), inset 0 0.5px 0 rgba(255,255,255,0.8)",
          border: "0.5px solid rgba(255,255,255,0.7)",
        }}
      >
        {/* Header */}
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
            {isEditing ? "Edytuj transakcję" : "Dodaj transakcję"}
          </div>
          <button
            onClick={handleClose}
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

        {/* No key warning */}
        {!userDataKey && (
          <div style={{ padding: "16px 22px", background: `${AMBER}12`, borderBottom: `0.5px solid ${LINE_SOFT}` }}>
            <div style={{ fontSize: 12, color: AMBER, fontWeight: 600 }}>
              Odblokuj dane w panelu synchronizacji, żeby zapisywać transakcje.
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Type + Portfolio */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Typ transakcji">
              <select value={txType} onChange={(e) => setTxType(e.target.value)} style={selectStyle} required>
                {TX_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Portfel">
              <select value={portfolioId} onChange={(e) => setPortfolioId(e.target.value)} style={selectStyle} required>
                {portfolios.length === 0 && <option value="">—</option>}
                {portfolios.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Date */}
          <Field label="Data">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={inputStyle}
              required
            />
          </Field>

          {/* Instrument (conditional) */}
          {txDef.needsInstrument && (
            <Field label="Instrument">
              <select value={instrumentId} onChange={(e) => setInstrumentId(e.target.value)} style={selectStyle}>
                <option value="">— wybierz instrument —</option>
                {instruments.map((inst) => (
                  <option key={inst.id} value={inst.id}>{inst.name} ({inst.symbol})</option>
                ))}
              </select>
            </Field>
          )}

          {/* Qty + Price (conditional) */}
          {txDef.needsQty && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Ilość (szt.)">
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="np. 10"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  style={inputStyle}
                />
              </Field>
              <Field label="Cena jednostkowa">
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="np. 152.40"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>
          )}

          {/* Amount + Currency */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 12 }}>
            <Field label="Kwota brutto">
              <input
                type="number"
                step="any"
                min="0"
                placeholder="np. 1524.00"
                value={grossAmount}
                onChange={(e) => setGrossAmount(e.target.value)}
                style={inputStyle}
                required
              />
            </Field>
            <Field label="Waluta">
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={selectStyle}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>

          {/* Fees + Taxes */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Prowizja">
              <input
                type="number"
                step="any"
                min="0"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="Podatek">
              <input
                type="number"
                step="any"
                min="0"
                value={taxes}
                onChange={(e) => setTaxes(e.target.value)}
                style={inputStyle}
              />
            </Field>
          </div>

          {/* Error */}
          {error && (
            <div style={{ fontSize: 12, color: LOSS, padding: "8px 12px", borderRadius: 8, background: `${LOSS}10` }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
            <button
              type="button"
              onClick={handleClose}
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
                boxShadow: saving || !userDataKey
                  ? "none"
                  : "0 3px 10px rgba(28,49,68,0.18), inset 0 0.5px 0 rgba(255,255,255,0.18)",
                transition: "all .15s",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {saving ? "Zapisuję…" : isEditing ? "Zapisz zmiany" : "Zapisz transakcję"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
