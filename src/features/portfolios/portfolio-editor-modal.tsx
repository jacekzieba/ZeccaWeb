"use client";

import { createPortal } from "react-dom";
import {
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { useSyncStore } from "@/sync/store/sync-store";
import { refreshSyncStore, saveRecord } from "@/sync/records/record-writer";
import { makeAccountPayload } from "@/sync/records/macos-payloads";

const INK = "#1C3144";
const MUTED = "rgba(28,49,68,0.58)";
const SUBTLE = "rgba(28,49,68,0.38)";
const LINE_SOFT = "rgba(28,49,68,0.06)";
const LOSS = "#B85042";
const AMBER = "#B87830";
const PAPER = "#FBFAF6";

const CURRENCIES = ["PLN", "USD", "EUR", "GBP", "CHF", "CZK"];

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

type PortfolioDraft = {
  id: string;
  name: string;
  baseCurrency: string;
  /** Preserved from the source account record so editing the name never wipes
   * the per-portfolio allocation, color, or type set on macOS. */
  accountType?: string;
  colorHex?: string;
  targetAllocation?: Record<string, number>;
  updatedAt: string;
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

export function PortfolioEditorModal({
  open,
  initialValue,
  onClose,
}: {
  open: boolean;
  initialValue: PortfolioDraft | null;
  onClose(): void;
}) {
  const userDataKey = useSyncStore((s) => s.userDataKey);
  const supabase = useSyncStore((s) => s.supabase);
  const setSync = useSyncStore((s) => s.setSync);
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("PLN");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      return;
    }

    setName(initialValue?.name ?? "");
    setBaseCurrency(initialValue?.baseCurrency ?? "PLN");
    setSaving(false);
    setError(null);
  }, [initialValue, open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userDataKey || !supabase) {
      setError("Odblokuj dane w panelu synchronizacji, żeby zapisywać portfele.");
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Nazwa portfela jest wymagana.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const id = initialValue?.id ?? crypto.randomUUID();
      const result = await saveRecord(
        supabase,
        userDataKey,
        "account",
        makeAccountPayload({
          id,
          name: trimmedName,
          baseCurrency,
          accountType: initialValue?.accountType,
          colorHex: initialValue?.colorHex,
          targetAllocation: initialValue?.targetAllocation,
        }),
        { baseUpdatedAt: initialValue?.updatedAt ?? null },
      );
      if (!result.queued) {
        const { records, snapshot } = await refreshSyncStore(supabase, userDataKey);
        setSync(records, snapshot);
      }
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Nie udało się zapisać portfela.",
      );
      setSaving(false);
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
        zIndex: 200,
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
          maxWidth: 460,
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
            {initialValue ? "Edytuj portfel" : "Dodaj portfel"}
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
              Odblokuj dane w panelu synchronizacji, żeby zapisywać portfele.
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
          <Field label="Nazwa portfela">
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="np. IKZE, Obligacje, Interactive Brokers"
              style={inputStyle}
              required
            />
          </Field>

          <Field label="Waluta bazowa">
            <select
              value={baseCurrency}
              onChange={(event) => setBaseCurrency(event.target.value)}
              style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
            >
              {CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
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
              {saving ? "Zapisuję…" : initialValue ? "Zapisz zmiany" : "Dodaj portfel"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
