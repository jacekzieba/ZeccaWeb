import * as Sentry from "@sentry/nextjs";
import { SENTRY_DSN, SENTRY_ENABLED, scrubSentryEvent } from "@/lib/sentry-options";

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: SENTRY_ENABLED,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend: (event) => scrubSentryEvent(event),
});
