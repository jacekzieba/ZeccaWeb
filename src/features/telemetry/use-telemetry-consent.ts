"use client";

import { useCallback, useMemo, useState } from "react";
import { makeSettingsPayload } from "@/sync/records/macos-payloads";
import {
  refreshSyncStore,
  saveRecord,
  type WriteRecordPayload,
} from "@/sync/records/record-writer";
import { useSyncStore } from "@/sync/store/sync-store";

/**
 * Reads and writes the product-telemetry preference on the synced `settings`
 * record. Writing it also acknowledges the existing native privacy disclosure,
 * keeping the shared record compatible across platforms.
 */
export function useTelemetryConsent() {
  const settings = useSyncStore((s) => s.snapshot?.settings);
  const records = useSyncStore((s) => s.records);
  const userDataKey = useSyncStore((s) => s.userDataKey);
  const supabase = useSyncStore((s) => s.supabase);
  const setSync = useSyncStore((s) => s.setSync);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Latest settings record, so we write with the right id + baseUpdatedAt and
  // merge onto its full payload.
  const settingsRecord = useMemo(() => {
    if (!records) return null;
    return (
      records
        .filter((record) => record.envelope.type === "settings")
        .sort(
          (left, right) =>
            new Date(left.updatedAt).getTime() -
            new Date(right.updatedAt).getTime(),
        )
        .at(-1) ?? null
    );
  }, [records]);

  const canWrite = Boolean(supabase && userDataKey);

  const setConsent = useCallback(
    async (enabled: boolean) => {
      if (!supabase || !userDataKey) {
        setError("Najpierw odblokuj synchronizację, aby zapisać wybór.");
        return;
      }
      setSaving(true);
      setError(null);
      try {
        const existing = settingsRecord?.envelope.payload as
          | Record<string, unknown>
          | undefined;
        const payload = makeSettingsPayload({
          id: settingsRecord?.id ?? crypto.randomUUID(),
          existing,
          telemetryEnabled: enabled,
          hasAcknowledgedPrivacyDisclosure: true,
        }) as WriteRecordPayload;

        const result = await saveRecord(supabase, userDataKey, "settings", payload, {
          baseUpdatedAt: settingsRecord?.updatedAt ?? null,
        });

        if (!result.queued) {
          const { records: newRecords, snapshot } = await refreshSyncStore(
            supabase,
            userDataKey,
          );
          setSync(newRecords, snapshot);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Nie udało się zapisać wyboru.",
        );
      } finally {
        setSaving(false);
      }
    },
    [settingsRecord, supabase, userDataKey, setSync],
  );

  return {
    enabled: settings?.telemetryEnabled ?? true,
    canWrite,
    saving,
    error,
    setConsent,
  };
}
