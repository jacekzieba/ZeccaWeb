"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { COLORS, SHADOWS } from "@/lib/design-tokens";
import {
  forcePendingSyncOperation,
  getPendingSyncOperations,
  PENDING_SYNC_CHANGED_EVENT,
  refreshSyncStore,
  removePendingSyncOperation,
  flushPendingSyncOperations,
  type PendingSyncOperation,
} from "@/sync/records/record-writer";
import { useSyncStore } from "@/sync/store/sync-store";

const panelStyle: CSSProperties = {
  position: "absolute",
  right: 0,
  top: 44,
  width: 380,
  maxWidth: "calc(100vw - 24px)",
  borderRadius: 14,
  background: "rgba(255,253,249,0.98)",
  border: `0.5px solid ${COLORS.border}`,
  boxShadow: SHADOWS.cardStrong,
  padding: 12,
  zIndex: 120,
};

function operationLabel(operation: PendingSyncOperation) {
  const action = operation.operation === "upsert" ? "Zapis" : "Usunięcie";
  const type =
    operation.recordType === "account"
      ? "portfela"
      : operation.recordType === "asset"
      ? "instrumentu"
      : operation.recordType === "transaction"
      ? "transakcji"
      : operation.recordType;
  return `${action} ${type}`;
}

export function PendingSyncStatus() {
  const supabase = useSyncStore((s) => s.supabase);
  const userDataKey = useSyncStore((s) => s.userDataKey);
  const setSync = useSyncStore((s) => s.setSync);
  const [operations, setOperations] = useState<PendingSyncOperation[]>([]);
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    function refreshQueue() {
      setOperations(getPendingSyncOperations());
    }

    refreshQueue();
    window.addEventListener(PENDING_SYNC_CHANGED_EVENT, refreshQueue);
    window.addEventListener("storage", refreshQueue);
    return () => {
      window.removeEventListener(PENDING_SYNC_CHANGED_EVENT, refreshQueue);
      window.removeEventListener("storage", refreshQueue);
    };
  }, []);

  const conflictCount = useMemo(
    () =>
      operations.filter((operation) =>
        operation.error?.toLowerCase().includes("rekord"),
      ).length,
    [operations],
  );

  async function refreshData() {
    if (!supabase || !userDataKey) return;
    const { records, snapshot } = await refreshSyncStore(supabase, userDataKey);
    setSync(records, snapshot);
  }

  async function handleRetry() {
    if (!supabase) return;
    setSyncing(true);
    setMessage(null);
    try {
      const result = await flushPendingSyncOperations(supabase);
      if (result.sent > 0) {
        await refreshData();
      }
      setOperations(getPendingSyncOperations());
      setMessage(
        result.remaining.length === 0
          ? "Wysłano wszystkie oczekujące zmiany."
          : `Wysłano ${result.sent}; ${result.remaining.length} nadal czeka.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się ponowić sync.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleForce(operationId: string) {
    if (!supabase) return;
    const confirmed = window.confirm(
      "Wymusić zapis tej lokalnej zmiany? Może nadpisać zmianę z innego urządzenia.",
    );
    if (!confirmed) return;

    setSyncing(true);
    setMessage(null);
    try {
      await forcePendingSyncOperation(supabase, operationId);
      await refreshData();
      setOperations(getPendingSyncOperations());
      setMessage("Wymuszono lokalną zmianę.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się wymusić zmiany.");
    } finally {
      setSyncing(false);
    }
  }

  function handleDiscard(operationId: string) {
    const confirmed = window.confirm("Odrzucić tę lokalną oczekującą zmianę?");
    if (!confirmed) return;
    removePendingSyncOperation(operationId);
    setOperations(getPendingSyncOperations());
    setMessage("Odrzucono zmianę z kolejki.");
  }

  if (operations.length === 0) {
    return null;
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((value) => !value)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "7px 11px",
          borderRadius: 9,
          border: `0.5px solid ${conflictCount > 0 ? "rgba(184,80,66,0.26)" : COLORS.border}`,
          background: conflictCount > 0 ? "rgba(184,80,66,0.10)" : COLORS.surface,
          color: conflictCount > 0 ? "#B85042" : COLORS.textMuted,
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <span>{conflictCount > 0 ? "Konflikt" : "Oczekuje"}</span>
        <span>{operations.length}</span>
      </button>

      {open && (
        <div style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.text }}>
                Oczekujące zmiany
              </div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
                Zmiany są zaszyfrowane lokalnie i czekają na wysłanie.
              </div>
            </div>
            <button
              onClick={handleRetry}
              disabled={!supabase || syncing}
              style={{
                alignSelf: "flex-start",
                padding: "6px 10px",
                borderRadius: 8,
                border: "none",
                background: COLORS.text,
                color: COLORS.white,
                fontSize: 12,
                fontWeight: 700,
                cursor: !supabase || syncing ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                opacity: !supabase || syncing ? 0.5 : 1,
              }}
            >
              {syncing ? "Wysyłam…" : "Ponów"}
            </button>
          </div>

          {message && (
            <div
              style={{
                marginTop: 10,
                padding: "8px 10px",
                borderRadius: 8,
                background: COLORS.surfaceAlt,
                color: COLORS.textMuted,
                fontSize: 11,
              }}
            >
              {message}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {operations.map((operation) => (
              <div
                key={operation.operationId}
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border: `0.5px solid ${COLORS.border}`,
                  background: COLORS.surface,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.text }}>
                      {operationLabel(operation)}
                    </div>
                    <div style={{ fontSize: 10, color: COLORS.subtle, marginTop: 2 }}>
                      #{operation.id.slice(0, 8)} · {new Date(operation.createdAt).toLocaleString("pl-PL")}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                    <button
                      onClick={() => void handleForce(operation.operationId)}
                      disabled={!supabase || syncing}
                      style={{
                        padding: "5px 8px",
                        borderRadius: 7,
                        border: "0.5px solid rgba(184,80,66,0.20)",
                        background: "transparent",
                        color: "#B85042",
                        fontSize: 11,
                        cursor: !supabase || syncing ? "not-allowed" : "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Wymuś
                    </button>
                    <button
                      onClick={() => handleDiscard(operation.operationId)}
                      disabled={syncing}
                      style={{
                        padding: "5px 8px",
                        borderRadius: 7,
                        border: `0.5px solid ${COLORS.border}`,
                        background: "transparent",
                        color: COLORS.textMuted,
                        fontSize: 11,
                        cursor: syncing ? "not-allowed" : "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Odrzuć
                    </button>
                  </div>
                </div>
                {operation.error && (
                  <div style={{ fontSize: 11, color: "#B85042", marginTop: 7 }}>
                    {operation.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
