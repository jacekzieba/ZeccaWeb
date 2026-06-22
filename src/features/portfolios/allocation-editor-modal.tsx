"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useSyncStore } from "@/sync/store/sync-store";
import { refreshSyncStore, saveRecord } from "@/sync/records/record-writer";
import { buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";
import { makeAccountPayload } from "@/sync/records/macos-payloads";
import { isFakeSyncEnabled } from "@/lib/env";
import { V2, V2_TYPE, v2Mix } from "@/lib/v2-design";
import {
  ASSET_CLASSES,
  readAllocation,
  sumAllocation,
  type AssetClassKey,
} from "./asset-classes";

/** A portfolio's account record, surfaced for allocation editing. */
export type AllocationDraft = {
  id: string;
  name: string;
  baseCurrency: string;
  accountType?: string;
  colorHex?: string;
  targetAllocation?: Record<string, number>;
  updatedAt: string;
};

const PAPER = "#FBFAF6";

const numberInputStyle: CSSProperties = {
  width: 56,
  padding: "6px 8px",
  borderRadius: 8,
  border: `0.5px solid ${V2.line}`,
  background: V2.card,
  color: V2.ink,
  fontFamily: V2_TYPE.mono,
  fontSize: 12.5,
  textAlign: "right",
  outline: "none",
};

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function AllocationEditorModal({
  open,
  draft,
  onClose,
}: {
  open: boolean;
  draft: AllocationDraft | null;
  onClose(): void;
}) {
  const userDataKey = useSyncStore((s) => s.userDataKey);
  const supabase = useSyncStore((s) => s.supabase);
  const setSync = useSyncStore((s) => s.setSync);
  const records = useSyncStore((s) => s.records);
  const [mounted, setMounted] = useState(false);
  const [alloc, setAlloc] = useState<Record<AssetClassKey, number>>(() =>
    readAllocation(null),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setAlloc(readAllocation(draft?.targetAllocation));
    setSaving(false);
    setError(null);
  }, [draft, open]);

  const total = useMemo(() => sumAllocation(alloc), [alloc]);
  const locked = !userDataKey || !supabase;

  function setShare(key: AssetClassKey, value: number) {
    setAlloc((prev) => ({ ...prev, [key]: clamp(value) }));
  }

  function clearAll() {
    setAlloc(readAllocation(null));
  }

  /** Fake-sync (dev/e2e) writes the account record straight into the store, since
   * the real upload path needs a live Supabase client. Mirrors the earnings flow. */
  function applyFakeAllocation(targetAllocation: Record<string, number>): boolean {
    if (!records || !draft) return false;
    const existing = records.find(
      (record) =>
        !record.deletedAt &&
        record.envelope.type === "account" &&
        record.id === draft.id,
    );
    if (!existing) return false;

    const nextRecords = records.map((record) =>
      record.id === draft.id && record.envelope.type === "account"
        ? {
            ...record,
            updatedAt: new Date().toISOString(),
            envelope: {
              ...record.envelope,
              payload: {
                ...(record.envelope.payload as Record<string, unknown>),
                targetAllocation,
              },
            },
          }
        : record,
    );
    setSync(
      nextRecords,
      buildInvestorDataSnapshot(nextRecords, {
        asOf: new Date(),
        historyGranularity: "daily",
        useLatestTransactionFxRate: true,
        useMarketQuotes: true,
      }),
    );
    return true;
  }

  async function handleSave() {
    if (!draft) return;
    if (!userDataKey || !supabase) {
      setError("Odblokuj dane w panelu synchronizacji, żeby zapisać alokację.");
      return;
    }

    setSaving(true);
    setError(null);

    // Persist only non-zero shares, so an untouched portfolio stays empty —
    // matching how macOS writes the allocation record.
    const targetAllocation: Record<string, number> = {};
    for (const { key } of ASSET_CLASSES) {
      if (alloc[key] > 0) targetAllocation[key] = alloc[key];
    }

    if (isFakeSyncEnabled() && applyFakeAllocation(targetAllocation)) {
      onClose();
      return;
    }

    try {
      const result = await saveRecord(
        supabase,
        userDataKey,
        "account",
        makeAccountPayload({
          id: draft.id,
          name: draft.name,
          baseCurrency: draft.baseCurrency,
          accountType: draft.accountType,
          colorHex: draft.colorHex,
          targetAllocation,
        }),
        { baseUpdatedAt: draft.updatedAt || null },
      );
      if (!result.queued) {
        const { records, snapshot } = await refreshSyncStore(supabase, userDataKey);
        setSync(records, snapshot);
      }
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Nie udało się zapisać alokacji.",
      );
      setSaving(false);
    }
  }

  if (!mounted || !open || !draft) {
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
          background: "rgba(22,29,24,0.45)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      />

      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 480,
          background: PAPER,
          borderRadius: 18,
          boxShadow:
            "0 24px 64px rgba(22,29,24,0.22), inset 0 0.5px 0 rgba(255,255,255,0.8)",
          border: "0.5px solid rgba(255,255,255,0.7)",
          fontFamily: V2_TYPE.ui,
        }}
      >
        <div style={{ padding: "18px 22px 14px", borderBottom: `0.5px solid ${V2.line2}` }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: V2.ink }}>
            Alokacja docelowa
          </div>
          <div style={{ fontSize: 12.5, color: V2.muted, marginTop: 2 }}>{draft.name}</div>
        </div>

        {locked && (
          <div
            style={{
              padding: "13px 22px",
              background: `${V2.gold}12`,
              borderBottom: `0.5px solid ${V2.line2}`,
              fontSize: 12,
              color: V2.gold,
              fontWeight: 600,
            }}
          >
            Odblokuj dane w panelu synchronizacji, żeby zapisać alokację.
          </div>
        )}

        <div style={{ padding: "16px 22px 4px" }}>
          <div style={{ fontSize: 12, color: V2.muted, marginBottom: 14 }}>
            Ustaw docelowe proporcje klas aktywów (suma = 100%).
          </div>

          {ASSET_CLASSES.map(({ key, label, color }) => (
            <div
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "9px 0",
              }}
            >
              <span
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: 3,
                  background: color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: V2.ink }}
              >
                {label}
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={alloc[key]}
                onChange={(e) => setShare(key, Number(e.target.value))}
                aria-label={label}
                style={{ width: 150, accentColor: V2.brand }}
              />
              <input
                type="number"
                min={0}
                max={100}
                value={alloc[key]}
                onChange={(e) => setShare(key, Number(e.target.value))}
                aria-label={`${label} procent`}
                style={numberInputStyle}
              />
              <span style={{ fontFamily: V2_TYPE.mono, fontSize: 12, color: V2.subtle }}>
                %
              </span>
            </div>
          ))}
        </div>

        <div
          style={{
            padding: "13px 22px",
            borderTop: `0.5px solid ${V2.line2}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 12.5, fontWeight: 600, color: V2.ink }}>
            Suma:{" "}
            <span
              style={{
                fontFamily: V2_TYPE.mono,
                fontWeight: 700,
                color: Math.round(total) === 100 ? V2.profit : V2.loss,
              }}
            >
              {total.toLocaleString("pl-PL", { maximumFractionDigits: 0 })}%
            </span>
          </span>
          <button
            type="button"
            onClick={clearAll}
            style={{
              padding: "7px 14px",
              borderRadius: 9,
              border: `0.5px solid ${V2.line}`,
              background: V2.card,
              color: V2.muted,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Wyczyść
          </button>
        </div>

        {error && (
          <div
            style={{
              margin: "0 22px 4px",
              fontSize: 12,
              color: V2.loss,
              padding: "8px 12px",
              borderRadius: 8,
              background: `${V2.loss}10`,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            padding: "14px 22px 18px",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "9px 18px",
              borderRadius: 9,
              border: `0.5px solid ${V2.line}`,
              background: "transparent",
              color: V2.muted,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || locked}
            style={{
              padding: "9px 20px",
              borderRadius: 9,
              border: "none",
              background: saving || locked ? v2Mix(V2.ink, 0.12) : V2.ink,
              color: saving || locked ? V2.subtle : "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: saving || locked ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {saving ? "Zapisuję…" : "Zapisz"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
