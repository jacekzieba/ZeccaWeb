import { ORGANIZATION, TelemetryEvent, type TelemetryEventName } from "./events";
import {
  NoopTelemetryClient,
  type TelemetryClient,
} from "./telemetry-client";

// Web mirror of native `TelemetryService`. Same gate, same common metadata,
// same "launch once" semantics. See docs/TELEMETRY_CONTRACT.md.

export type TelemetryBuildInfo = {
  platform: string;
  appVersion: string;
  build: string;
};

/** Gate inputs, sourced from the synced settings record (SnapshotSettings). */
export type TelemetryGateSettings = {
  telemetryEnabled: boolean;
  syncMode: string | null;
};

export type TelemetryServiceOptions = {
  appID: string | null;
  client?: TelemetryClient;
  buildInfo: TelemetryBuildInfo;
  /** Kill switch for e2e/UI tests and dev. Overrides the consent gate. */
  forcedOff?: boolean;
};

export class TelemetryService {
  private readonly appID: string | null;
  private readonly client: TelemetryClient;
  private readonly buildInfo: TelemetryBuildInfo;

  private didInitialize = false;
  private didTrackLaunch = false;
  private telemetryEnabled = true;
  private telemetryForcedOff = false;
  private syncMode = "none";

  constructor(options: TelemetryServiceOptions) {
    this.appID = options.appID;
    // No app ID configured ⇒ noop client, so nothing is sent regardless of consent.
    this.client = options.client ?? new NoopTelemetryClient();
    this.buildInfo = options.buildInfo;
    this.telemetryForcedOff = options.forcedOff ?? false;
  }

  bootstrap(settings: TelemetryGateSettings, forcedOff?: boolean): void {
    this.update(settings, forcedOff);
    this.trackLaunchIfAllowed();
  }

  update(settings: TelemetryGateSettings, forcedOff?: boolean): void {
    if (forcedOff !== undefined) this.telemetryForcedOff = forcedOff;
    this.telemetryEnabled = settings.telemetryEnabled;
    this.syncMode = settings.syncMode ?? "none";
    this.trackLaunchIfAllowed();
  }

  signal(
    event: TelemetryEventName,
    parameters: Record<string, string> = {},
  ): void {
    if (!this.effectiveTelemetryEnabled) return;
    this.ensureInitialized();

    const merged: Record<string, string> = {
      platform: this.buildInfo.platform,
      app_version: this.buildInfo.appVersion,
      build: this.buildInfo.build,
      sync_mode: this.syncMode,
      organization: ORGANIZATION,
      ...parameters,
    };
    this.client.signal(event, merged);
  }

  private get effectiveTelemetryEnabled(): boolean {
    return (
      this.appID !== null &&
      this.telemetryEnabled &&
      !this.telemetryForcedOff
    );
  }

  private trackLaunchIfAllowed(): void {
    if (this.didTrackLaunch || !this.effectiveTelemetryEnabled) return;
    this.didTrackLaunch = true;
    this.signal(TelemetryEvent.appLaunched);
  }

  private ensureInitialized(): void {
    if (this.didInitialize || this.appID === null) return;
    this.client.initialize(this.appID);
    this.didInitialize = true;
  }
}
