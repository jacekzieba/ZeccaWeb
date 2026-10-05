"use client";

import { useEffect } from "react";
import { getTelemetryService } from "@/lib/telemetry";
import { useSyncStore } from "@/sync/store/sync-store";
import { useAnalyticsConsent } from "@/features/telemetry/analytics-consent";

/**
 * Feeds the telemetry gate. Mounts once near the app root. The gate is this
 * browser's analytics consent (opt-in, see analytics-consent.ts) — the synced
 * `telemetryEnabled` flag no longer opens anything on web. Synced settings only
 * supply `sync_mode`, so `app_launched` is emitted once, after they arrive.
 */
export function TelemetryBootstrap() {
  const consent = useAnalyticsConsent();
  const settings = useSyncStore((state) => state.snapshot?.settings);

  useEffect(() => {
    const telemetryEnabled = consent === "granted";
    if (!settings) {
      getTelemetryService().setEnabled(telemetryEnabled);
      return;
    }
    getTelemetryService().update({
      telemetryEnabled,
      syncMode: settings.syncMode,
    });
  }, [consent, settings?.syncMode, settings]);

  return null;
}
