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

type Breadcrumb = {
  category?: string;
  message?: string;
  data?: Record<string, unknown>;
};

type Span = {
  description?: string;
  data?: Record<string, unknown>;
};

type ScrubbableEvent = {
  request?: {
    url?: string;
    data?: unknown;
    cookies?: unknown;
    query_string?: unknown;
    headers?: Record<string, string>;
  };
  user?: unknown;
  breadcrumbs?: Breadcrumb[];
  spans?: Span[];
};

const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:\/\//i;

function stripQuery(url: string): string {
  return url.split(/[?#]/)[0]!;
}

/** Absolute URL → origin only (Yahoo/NBP carry tickers and currencies in the
 *  path); relative path → path without query/fragment. */
function redactUrl(url: string): string {
  if (!ABSOLUTE_URL.test(url)) return stripQuery(url);
  try {
    return new URL(url).origin;
  } catch {
    return "[url]";
  }
}

const URL_FIELDS = ["url", "to", "from", "http.url", "url.full"];
const QUERY_FIELDS = ["http.query", "url.query", "http.fragment"];

function scrubUrlFields(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (QUERY_FIELDS.includes(key)) continue;
    out[key] = URL_FIELDS.includes(key) && typeof value === "string" ? redactUrl(value) : value;
  }
  return out;
}

/** Console and UI breadcrumbs can carry names and tickers (log text, element
 *  labels) — dropped. Network and navigation breadcrumbs keep only a redacted
 *  URL. Applied as `beforeBreadcrumb` and again inside `scrubSentryEvent`. */
export function scrubSentryBreadcrumb<T extends Breadcrumb>(breadcrumb: T): T | null {
  const category = breadcrumb.category ?? "";
  if (category === "console" || category.startsWith("ui.")) return null;
  if (!breadcrumb.data) return breadcrumb;
  return { ...breadcrumb, data: scrubUrlFields(breadcrumb.data) };
}

function scrubSpan<T extends Span>(span: T): T {
  const scrubbed = { ...span };
  if (scrubbed.description) {
    scrubbed.description = scrubbed.description
      .split(" ")
      .map((part) => (part.startsWith("/") || ABSOLUTE_URL.test(part) ? redactUrl(part) : part))
      .join(" ");
  }
  if (scrubbed.data) scrubbed.data = scrubUrlFields(scrubbed.data);
  return scrubbed;
}

/**
 * Strip anything that could carry user data or secrets before an event leaves
 * the process. Applied as `beforeSend` and `beforeSendTransaction` in every
 * runtime.
 */
export function scrubSentryEvent<T extends ScrubbableEvent>(event: T): T {
  if (event.request) {
    // Request bodies may contain amounts/tickers; query strings may carry
    // tokens or the `next` param; cookies/auth headers carry the session.
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.query_string;
    if (event.request.url) event.request.url = stripQuery(event.request.url);
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
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .map((crumb) => scrubSentryBreadcrumb(crumb))
      .filter((crumb): crumb is Breadcrumb => crumb !== null);
  }
  if (event.spans) event.spans = event.spans.map(scrubSpan);
  return event;
}
