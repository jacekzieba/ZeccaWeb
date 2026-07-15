"use client";

import { useState, type CSSProperties } from "react";
import { RefreshCw } from "lucide-react";
import { COLORS, SHADOWS } from "@/lib/design-tokens";
import { isFakeSyncEnabled } from "@/lib/env";
import { V2, v2Mix } from "@/lib/v2-design";
import { runSyncCycle } from "@/sync/records/sync-cycle";
import { useSyncStore } from "@/sync/store/sync-store";

type SyncFeedback = {
  kind: "success" | "error";
  text: string;
};

const feedbackStyle: CSSProperties = {
  position: "absolute",
  right: 0,
  top: 42,
  zIndex: 120,
  width: "max-content",
  maxWidth: "min(320px, calc(100vw - 24px))",
  padding: "8px 11px",
  borderRadius: 9,
  border: `0.5px solid ${COLORS.border}`,
  background: "rgba(255,253,249,0.98)",
  boxShadow: SHADOWS.cardStrong,
  fontSize: 11,
  lineHeight: 1.4,
};

export function ManualSyncButton({ compact = false }: { compact?: boolean }) {
  const supabase = useSyncStore((state) => state.supabase);
  const userDataKey = useSyncStore((state) => state.userDataKey);
  const setSync = useSyncStore((state) => state.setSync);
  const [syncing, setSyncing] = useState(false);
  const [feedback, setFeedback] = useState<SyncFeedback | null>(null);

  async function handleSync() {
    if (!supabase || !userDataKey || syncing) {
      return;
    }

    setSyncing(true);
    setFeedback(null);
    try {
      if (isFakeSyncEnabled()) {
        const { records, snapshot } = useSyncStore.getState();
        if (records && snapshot) {
          setSync(records, snapshot);
        }
        setFeedback({ kind: "success", text: "Dane zsynchronizowane." });
        return;
      }

      const { records, snapshot, pending } = await runSyncCycle(
        supabase,
        userDataKey,
      );
      setSync(records, snapshot);
      setFeedback({
        kind: "success",
        text:
          pending.remaining.length === 0
            ? "Dane zsynchronizowane."
            : `Dane odświeżone. ${pending.remaining.length} ${pending.remaining.length === 1 ? "zmiana nadal czeka" : "zmian nadal czeka"}.`,
      });
    } catch (error) {
      setFeedback({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Nie udało się zsynchronizować danych.",
      });
    } finally {
      setSyncing(false);
    }
  }

  const disabled = !supabase || !userDataKey || syncing;

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => void handleSync()}
        disabled={disabled}
        aria-label={syncing ? "Synchronizowanie danych" : "Synchronizuj teraz"}
        title="Wymuś synchronizację"
        style={{
          height: compact ? 44 : 34,
          width: compact ? 44 : undefined,
          padding: compact ? 0 : "7px 11px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
          borderRadius: 9,
          border: `0.5px solid ${COLORS.border}`,
          background: v2Mix(V2.card, 0.7),
          color: COLORS.textMuted,
          boxShadow: `inset 0 1px 0 ${V2.spec}`,
          fontFamily: "inherit",
          fontSize: 12,
          fontWeight: 700,
          whiteSpace: "nowrap",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <RefreshCw
          size={14}
          strokeWidth={1.9}
          aria-hidden="true"
          style={{ animation: syncing ? "spin 0.8s linear infinite" : undefined }}
        />
        {!compact && (syncing ? "Synchronizuję…" : "Synchronizuj")}
      </button>

      {feedback && (
        <div
          role={feedback.kind === "error" ? "alert" : "status"}
          aria-live={feedback.kind === "error" ? "assertive" : "polite"}
          style={{
            ...feedbackStyle,
            color: feedback.kind === "error" ? "#B85042" : COLORS.textMuted,
          }}
        >
          {feedback.text}
        </div>
      )}
    </div>
  );
}
