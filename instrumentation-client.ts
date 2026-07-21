import * as Sentry from "@sentry/nextjs";
import { SENTRY_DSN, SENTRY_ENABLED, scrubSentryEvent } from "@/lib/sentry-options";

// Client-side Sentry. No Session Replay integration — it would record the DOM,
// which shows decrypted portfolio data. Errors only, with PII scrubbed.
Sentry.init({
  dsn: SENTRY_DSN,
  enabled: SENTRY_ENABLED,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend: (event) => scrubSentryEvent(event),
});

// Instruments client-side navigations (App Router).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
