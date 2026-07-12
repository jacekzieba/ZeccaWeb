import TelemetryDeck from "@telemetrydeck/sdk";

// SDK-agnostic seam, mirroring native `TelemetryClient`. The service talks only
// to this interface, so tests inject a mock and dev/SSR uses the noop.
export interface TelemetryClient {
  initialize(appID: string): void;
  signal(name: string, parameters: Record<string, string>): void;
}

/** Sends nothing. Used in tests, during SSR, and when no app ID is configured. */
export class NoopTelemetryClient implements TelemetryClient {
  initialize(): void {}
  signal(): void {}
}

/**
 * Wraps the TelemetryDeck JS SDK. `clientUser` exists only for this browser
 * session; the SDK hashes it before sending. It is NOT the Supabase user id.
 */
export class TelemetryDeckClient implements TelemetryClient {
  private td: TelemetryDeck | null = null;
  private readonly clientUser: string;
  private readonly testMode: boolean;

  constructor(clientUser: string, options: { testMode?: boolean } = {}) {
    this.clientUser = clientUser;
    this.testMode = options.testMode ?? false;
  }

  initialize(appID: string): void {
    if (this.td) return;
    this.td = new TelemetryDeck({
      appID,
      clientUser: this.clientUser,
      testMode: this.testMode,
    });
  }

  signal(name: string, parameters: Record<string, string>): void {
    // Fire-and-forget: telemetry must never block or throw into the UI.
    void this.td?.signal(name, parameters).catch(() => {});
  }
}

/**
 * A fresh, in-memory identifier. Deliberately never written to cookies,
 * localStorage, sessionStorage, or IndexedDB so product telemetry itself does
 * not need a cookie-consent banner.
 */
export function createEphemeralAnonymousId(): string {
  return crypto.randomUUID();
}
