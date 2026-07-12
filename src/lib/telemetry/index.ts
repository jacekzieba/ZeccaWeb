import {
  createEphemeralAnonymousId,
  NoopTelemetryClient,
  TelemetryDeckClient,
  type TelemetryClient,
} from "./telemetry-client";
import { TelemetryService } from "./telemetry-service";

export { TelemetryEvent, type TelemetryEventName } from "./events";
export { telemetrySnakeCased, telemetryRowBucket } from "./params";
export {
  TelemetryService,
  type TelemetryGateSettings,
} from "./telemetry-service";
export type { TelemetryClient } from "./telemetry-client";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";
const BUILD = process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev";
// App IDs are public identifiers. Keep the environment override for separate
// staging apps, while making the supplied production integration work by
// default.
const APP_ID =
  process.env.NEXT_PUBLIC_TELEMETRYDECK_APP_ID ??
  "0B524246-D7D6-4A77-9685-129DE5604015";

/** True when signals must be suppressed: e2e/fake-sync runs and explicit opt-out. */
function isForcedOff(): boolean {
  return (
    process.env.NEXT_PUBLIC_TELEMETRY_DISABLED === "1" ||
    process.env.NEXT_PUBLIC_FAKE_SYNC === "1"
  );
}

function createClient(): TelemetryClient {
  if (typeof window === "undefined" || !APP_ID) return new NoopTelemetryClient();
  return new TelemetryDeckClient(createEphemeralAnonymousId(), {
    testMode:
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1",
  });
}

let singleton: TelemetryService | null = null;

/** Browser-wide telemetry service. Safe to call during SSR — returns an
 * instance backed by a noop client until a real browser session exists. */
export function getTelemetryService(): TelemetryService {
  if (singleton) return singleton;
  singleton = new TelemetryService({
    appID: APP_ID,
    client: createClient(),
    buildInfo: { platform: "web", appVersion: APP_VERSION, build: BUILD },
    forcedOff: isForcedOff(),
  });
  return singleton;
}
