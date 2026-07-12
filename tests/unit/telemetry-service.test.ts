import { beforeEach, describe, expect, it } from "vitest";
import {
  TelemetryEvent,
  TelemetryService,
  type TelemetryClient,
  type TelemetryGateSettings,
} from "@/lib/telemetry";

type SentSignal = { name: string; parameters: Record<string, string> };

class MockTelemetryClient implements TelemetryClient {
  initialized: string | null = null;
  signals: SentSignal[] = [];

  initialize(appID: string): void {
    this.initialized = appID;
  }

  signal(name: string, parameters: Record<string, string>): void {
    this.signals.push({ name, parameters });
  }
}

const APP_ID = "TEST-APP-ID";

function makeService(client: TelemetryClient, forcedOff = false) {
  return new TelemetryService({
    appID: APP_ID,
    client,
    buildInfo: { platform: "web", appVersion: "1.2.3", build: "abc123" },
    forcedOff,
  });
}

const enabled: TelemetryGateSettings = {
  telemetryEnabled: true,
  syncMode: "supabase",
};

describe("TelemetryService", () => {
  let client: MockTelemetryClient;

  beforeEach(() => {
    client = new MockTelemetryClient();
  });

  it("emits app_launched once telemetry is enabled, only once", () => {
    const service = makeService(client);
    service.bootstrap(enabled);
    service.update(enabled); // second update must not re-launch

    const launches = client.signals.filter(
      (s) => s.name === TelemetryEvent.appLaunched,
    );
    expect(launches).toHaveLength(1);
    expect(client.initialized).toBe(APP_ID);
  });

  it("stays silent when telemetry is disabled", () => {
    const service = makeService(client);
    service.bootstrap({ ...enabled, telemetryEnabled: false });
    service.signal(TelemetryEvent.dashboardViewed);

    expect(client.signals).toHaveLength(0);
    expect(client.initialized).toBeNull();
  });

  it("does not require a blocking privacy acknowledgement", () => {
    const service = makeService(client);
    service.bootstrap(enabled);
    service.signal(TelemetryEvent.dashboardViewed);

    expect(client.signals.map((signal) => signal.name)).toContain(
      TelemetryEvent.dashboardViewed,
    );
  });

  it("respects the forcedOff kill switch (e2e/UI tests)", () => {
    const service = makeService(client, true);
    service.bootstrap(enabled);
    service.signal(TelemetryEvent.dashboardViewed);

    expect(client.signals).toHaveLength(0);
  });

  it("attaches the common metadata to every signal", () => {
    const service = makeService(client);
    service.bootstrap(enabled);
    service.signal(TelemetryEvent.dashboardViewed, { screen: "dashboard" });

    const viewed = client.signals.find(
      (s) => s.name === TelemetryEvent.dashboardViewed,
    );
    expect(viewed?.parameters).toMatchObject({
      platform: "web",
      app_version: "1.2.3",
      build: "abc123",
      sync_mode: "supabase",
      organization: "com.jacekzieba",
      screen: "dashboard",
    });
  });

  it("opens telemetry when the user enables it in settings", () => {
    const service = makeService(client);
    service.bootstrap({ ...enabled, telemetryEnabled: false });
    expect(client.signals).toHaveLength(0);

    service.update(enabled);
    expect(
      client.signals.map((s) => s.name),
    ).toContain(TelemetryEvent.appLaunched);
  });

  it("never sends financial keys in the payload", () => {
    const service = makeService(client);
    service.bootstrap(enabled);
    service.signal(TelemetryEvent.transactionAdded, {
      type: "buy",
      entry_method: "manual",
    });

    const forbidden = [
      "amount",
      "value",
      "price",
      "symbol",
      "ticker",
      "email",
      "user_id",
      "portfolio_id",
    ];
    for (const sent of client.signals) {
      for (const key of forbidden) {
        expect(Object.keys(sent.parameters)).not.toContain(key);
      }
    }
  });

  it("sends nothing when no app ID is configured", () => {
    const service = new TelemetryService({
      appID: null,
      client,
      buildInfo: { platform: "web", appVersion: "1.2.3", build: "abc123" },
    });
    service.bootstrap(enabled);
    service.signal(TelemetryEvent.dashboardViewed);

    expect(client.signals).toHaveLength(0);
    expect(client.initialized).toBeNull();
  });
});
