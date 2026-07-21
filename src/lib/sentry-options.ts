// Shared Sentry configuration for client, server and edge runtimes.
// Zecca is zero-knowledge: error telemetry must NEVER carry portfolio data
// (amounts, tickers), account emails, tokens, cookies or request bodies.

/**
 * Sentry DSN. Publishable (ships to the browser), so it is safe in source; the
 * env var lets staging/preview point at a different Sentry project. EU-region
 * ingest (Germany) — keeps error data in the EU.
 */
export const SENTRY_DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN ??
  "https://c68aa0bc9e43c6edb9ec70a34007a60a@o4511774819876864.ingest.de.sentry.io/4511774826561616";

/** Only send events from real production builds (no dev/test noise). */
export const SENTRY_ENABLED = process.env.NODE_ENV === "production";

type ScrubbableEvent = {
  request?: {
    data?: unknown;
    cookies?: unknown;
    query_string?: unknown;
    headers?: Record<string, string>;
  };
  user?: unknown;
};

/**
 * Strip anything that could carry user data or secrets before an event leaves
 * the process. Applied as `beforeSend` in every runtime.
 */
export function scrubSentryEvent<T extends ScrubbableEvent>(event: T): T {
  if (event.request) {
    // Request bodies may contain amounts/tickers; query strings may carry
    // tokens or the `next` param; cookies/auth headers carry the session.
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.query_string;
    if (event.request.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.Authorization;
      delete event.request.headers.cookie;
      delete event.request.headers.Cookie;
      delete event.request.headers.apikey;
    }
  }
  // We never set a Sentry user; drop it defensively in case an integration does.
  delete event.user;
  return event;
}
