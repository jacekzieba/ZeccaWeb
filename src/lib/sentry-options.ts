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
  transaction?: string;
  request?: {
    url?: string;
    data?: unknown;
    cookies?: unknown;
    query_string?: unknown;
    headers?: Record<string, string>;
  };
  contexts?: { trace?: { data?: Record<string, unknown> } };
  user?: unknown;
  breadcrumbs?: Breadcrumb[];
  spans?: Span[];
};

const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:\/\//i;

function stripQuery(url: string): string {
  return url.split(/[?#]/)[0]!;
}

// Path segments that carry a ticker, bond series, currency, date or record id.
// External shapes come from src/market-data/providers (they surface as the
// `url.path` span attribute); our own pages/routes as `http.target`,
// transaction names and navigation breadcrumbs.
const DYNAMIC_PATH_SEGMENTS: [RegExp, string][] = [
  [/^\/v8\/finance\/chart\/.*/, "/v8/finance/chart/:symbol"], // Yahoo
  [/^\/api\/exchangerates\/rates\/([a-z]+)\/.*/i, "/api/exchangerates/rates/$1/:currency"], // NBP (+ dates)
  [/^\/oferta-obligacji\/.*/, "/oferta-obligacji/:family/:series"], // obligacjeskarbowe.pl
  [/^\/api\/market-data\/([a-z-]+)\/.*/, "/api/market-data/$1/:param"],
  [/^\/portfolios\/[^/]+/, "/portfolios/:id"],
  [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id"],
];

function scrubPath(path: string): string {
  return DYNAMIC_PATH_SEGMENTS.reduce((out, [pattern, placeholder]) => out.replace(pattern, placeholder), stripQuery(path));
}

/** Absolute URL → origin only (Yahoo/NBP carry tickers and currencies in the
 *  path); relative path → path without query/fragment and dynamic segments. */
function redactUrl(url: string): string {
  if (!ABSOLUTE_URL.test(url)) return scrubPath(url);
  try {
    return new URL(url).origin;
  } catch {
    return "[url]";
  }
}

/** Our own page URL (request.url, Referer): keep origin and the scrubbed path. */
function redactPageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.origin + scrubPath(parsed.pathname);
  } catch {
    return redactUrl(url);
  }
}

/** Span names, transaction names and attributes like `next.span_name` are
 *  "<prefix> <url>" ("GET /api/…?symbol=X", "render route (app) /portfolios/[id]").
 *  Everything from the first URL-looking token on is treated as the URL, so
 *  an unencoded space in a query cannot smuggle a ticker past the scrubber. */
function scrubText(text: string): string {
  const match = /(^|\s)(\/|[a-z][a-z0-9+.-]*:\/\/)/i.exec(text);
  if (!match) return text;
  const urlStart = match.index + match[1]!.length;
  return text.slice(0, urlStart) + redactUrl(text.slice(urlStart));
}

const URL_FIELDS = ["url", "to", "from"];
const URL_ATTRIBUTE = /^(url|http|net|next)\./;
const QUERY_FIELDS = ["http.query", "url.query", "http.fragment"];

function scrubUrlFields(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (QUERY_FIELDS.includes(key)) continue;
    const isUrlField = URL_FIELDS.includes(key) || URL_ATTRIBUTE.test(key);
    out[key] = isUrlField && typeof value === "string" ? scrubText(value) : value;
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
  if (scrubbed.description) scrubbed.description = scrubText(scrubbed.description);
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
    if (event.request.url) event.request.url = redactPageUrl(event.request.url);
    if (event.request.headers) {
      for (const name of ["referer", "Referer"]) {
        const referer = event.request.headers[name];
        if (referer) event.request.headers[name] = redactPageUrl(referer);
      }
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
  // Traces: Next names the root span "GET <req.url>" and puts the raw URL in
  // `http.target`; both land in the transaction name and the trace context.
  if (event.transaction) event.transaction = scrubText(event.transaction);
  const trace = event.contexts?.trace;
  if (trace?.data) trace.data = scrubUrlFields(trace.data);
  return event;
}
