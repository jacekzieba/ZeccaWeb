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
  message?: string;
  exception?: { values?: { value?: string }[] };
  request?: {
    url?: string;
    data?: unknown;
    cookies?: unknown;
    query_string?: unknown;
    headers?: Record<string, string>;
  };
  contexts?: { trace?: { data?: Record<string, unknown> }; nextjs?: Record<string, unknown> };
  user?: unknown;
  breadcrumbs?: Breadcrumb[];
  spans?: Span[];
};

const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:\/\//i;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

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
  [UUID, ":id"],
];

function scrubPath(path: string): string {
  const withoutQuery = path.split(/[?#]/)[0]!;
  return DYNAMIC_PATH_SEGMENTS.reduce((out, [pattern, placeholder]) => out.replace(pattern, placeholder), withoutQuery);
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

/** Our own page URL (request.url): keep origin and the scrubbed path. */
function redactPageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.origin + scrubPath(parsed.pathname);
  } catch {
    return redactUrl(url);
  }
}

// Element selectors (INP span names, lcp.element, cls.source.N) embed the
// values of aria-label/title/alt/name — the app puts symbols there. Sentry
// truncates long selectors, so the closing `"]` may be missing. Quotes inside
// a value are not escaped, so the value ends only at a `"]` followed by the
// next attribute, a child combinator or the end of the selector.
const SELECTOR_ATTRIBUTE = /\[(aria-label|title|alt|name)="(?:(?!"\](?:\[| > |$))[\s\S])*(?:"\])?/g;
// A URL token: absolute or a path starting a word. Once a query/fragment
// starts, the rest of the line goes with it, so an unencoded space in a query
// ("?q=Vanguard FTSE") cannot smuggle a phrase past the scrubber.
const URL_IN_TEXT = /(^|\s)((?:[a-z][a-z0-9+.-]*:\/\/|\/)[^\s?#]*)(?:[?#].*)?/gim;

/** One scrubber for every string Sentry may send: names, descriptions,
 *  attributes, messages. */
function scrubString(text: string): string {
  return text
    .replace(SELECTOR_ATTRIBUTE, "[$1]")
    .replace(URL_IN_TEXT, (_match, prefix: string, url: string) => prefix + redactUrl(url))
    .replace(UUID, ":id");
}

const QUERY_FIELDS = ["http.query", "url.query", "http.fragment"];
// Request headers: next-url, next-router-state-tree and x-now-route-matches
// carry portfolio ids, referer the full previous URL. Only these survive.
const ALLOWED_HEADERS = ["user-agent", "accept", "accept-language", "content-type"];
const HEADER_ATTRIBUTE = /^http\.(?:request|response)\.header\.(.+)$/;

function scrubValue(value: unknown): unknown {
  if (typeof value === "string") return scrubString(value);
  if (Array.isArray(value)) return value.map(scrubValue);
  if (value && typeof value === "object") return scrubUrlFields(value as Record<string, unknown>);
  return value;
}

function scrubUrlFields(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (QUERY_FIELDS.includes(key)) continue;
    const header = HEADER_ATTRIBUTE.exec(key);
    // Sentry zapisuje nazwy nagłówków w atrybutach z podkreślnikiem (user_agent).
    if (header && !ALLOWED_HEADERS.includes(header[1]!.toLowerCase().replace(/_/g, "-"))) continue;
    out[key] = scrubValue(value);
  }
  return out;
}

/** Console and UI breadcrumbs can carry names and tickers (log text, element
 *  labels) — dropped. Network and navigation breadcrumbs keep only a redacted
 *  URL. Applied as `beforeBreadcrumb` and again inside `scrubSentryEvent`. */
export function scrubSentryBreadcrumb<T extends Breadcrumb>(breadcrumb: T): T | null {
  const category = breadcrumb.category ?? "";
  if (category === "console" || category.startsWith("ui.")) return null;
  const scrubbed = { ...breadcrumb };
  if (typeof scrubbed.message === "string") scrubbed.message = scrubString(scrubbed.message);
  if (scrubbed.data) scrubbed.data = scrubUrlFields(scrubbed.data);
  return scrubbed;
}

/** Scrubs a span's name and attributes. Used for transaction child spans and
 *  as `beforeSendSpan` — standalone spans (INP web vitals) are sent in their
 *  own envelope and never pass through `beforeSendTransaction`. */
export function scrubSentrySpan<T extends Span>(span: T): T {
  const scrubbed = { ...span };
  if (typeof scrubbed.description === "string") scrubbed.description = scrubString(scrubbed.description);
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
    if (typeof event.request.url === "string") event.request.url = redactPageUrl(event.request.url);
    else delete event.request.url;
    const headers = event.request.headers;
    if (headers) {
      for (const name of Object.keys(headers)) {
        if (!ALLOWED_HEADERS.includes(name.toLowerCase())) delete headers[name];
      }
    }
  }
  // We never set a Sentry user; drop it defensively in case an integration does.
  delete event.user;
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .map((crumb) => scrubSentryBreadcrumb(crumb))
      .filter((crumb): crumb is Breadcrumb => crumb !== null);
  }
  if (event.spans) event.spans = event.spans.map(scrubSentrySpan);
  // Traces: Next names the root span "GET <req.url>" and puts the raw URL in
  // `http.target`; both land in the transaction name and the trace context.
  if (typeof event.transaction === "string") event.transaction = scrubString(event.transaction);
  if (typeof event.message === "string") event.message = scrubString(event.message);
  for (const exception of event.exception?.values ?? []) {
    if (typeof exception.value === "string") exception.value = scrubString(exception.value);
  }
  const contexts = event.contexts;
  if (contexts?.trace?.data) contexts.trace.data = scrubUrlFields(contexts.trace.data);
  // captureRequestError copies Next's req.url (with query) into request_path.
  if (contexts?.nextjs) contexts.nextjs = scrubUrlFields(contexts.nextjs);
  return event;
}
