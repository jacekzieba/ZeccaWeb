import * as Sentry from "@sentry/nextjs";
import { SENTRY_DSN, SENTRY_ENABLED, scrubSentryBreadcrumb, scrubSentryEvent, scrubSentrySpan } from "@/lib/sentry-options";

// Client-side Sentry. No Session Replay integration — it would record the DOM,
// which shows decrypted portfolio data. Errors only, with PII scrubbed.
Sentry.init({
  dsn: SENTRY_DSN,
  enabled: SENTRY_ENABLED,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend: (event) => scrubSentryEvent(event),
  beforeSendTransaction: (event) => scrubSentryEvent(event),
  beforeSendSpan: (span) => scrubSentrySpan(span),
  beforeBreadcrumb: (breadcrumb) => scrubSentryBreadcrumb(breadcrumb),
});

// The envelope header of a standalone INP span carries the span name as
// `trace.transaction`, built from the live span — beforeSendSpan cannot reach
// it. Rename the span at start so the selector never holds label values.
Sentry.getClient()?.on("spanStart", (span) => {
  const { op, description } = Sentry.spanToJSON(span);
  if (op?.startsWith("ui.interaction") && description) {
    span.updateName(scrubSentrySpan({ description }).description ?? description);
  }
});

// Instruments client-side navigations (App Router).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
