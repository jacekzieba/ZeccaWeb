"use client";

import { useEffect } from "react";
import { getTelemetryService } from "@/lib/telemetry";
import { useSyncStore } from "@/sync/store/sync-store";

/**
 * Feeds the telemetry gate from the synced settings record. Mounts once near the
 * app root. When synced settings arrive, `update()` applies the telemetry
 * preference and emits `app_launched` exactly once when enabled.
 */
export function TelemetryBootstrap() {
  const settings = useSyncStore((state) => state.snapshot?.settings);

  useEffect(() => {
    if (!settings) return;
    getTelemetryService().update({
      telemetryEnabled: settings.telemetryEnabled,
      syncMode: settings.syncMode,
    });
  }, [
    settings?.telemetryEnabled,
    settings?.syncMode,
    settings,
  ]);

  return null;
}
