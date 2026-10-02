import { describe, expect, it } from "vitest";
import { scrubSentryBreadcrumb, scrubSentryEvent } from "@/lib/sentry-options";

// Polityka prywatności obiecuje: zgłoszenia Sentry nie zawierają tickerów,
// kwot ani parametrów URL. Tickery siedzą w query (/api/market-data/quote?symbol=)
// i w ścieżkach zewnętrznych (Yahoo /v8/finance/chart/VWRL.L).

describe("scrubSentryBreadcrumb", () => {
  it("fetch do własnego API: zostaje ścieżka, znika query z tickerem", () => {
    const crumb = scrubSentryBreadcrumb({
      category: "fetch",
      data: { method: "GET", url: "/api/market-data/quote?symbol=VWRL.L&currency=EUR", status_code: 200 },
    });
    expect(crumb?.data).toEqual({ method: "GET", url: "/api/market-data/quote", status_code: 200 });
  });

  it("zewnętrzny URL: zostaje wyłącznie host", () => {
    const crumb = scrubSentryBreadcrumb({
      category: "http",
      data: { url: "https://query1.finance.yahoo.com/v8/finance/chart/VWRL.L?interval=1d" },
    });
    expect(crumb?.data?.url).toBe("https://query1.finance.yahoo.com");
  });

  it("nawigacja: bez query i fragmentu", () => {
    const crumb = scrubSentryBreadcrumb({
      category: "navigation",
      data: { from: "/instruments?q=CDR", to: "/auth/callback?code=abc#x" },
    });
    expect(crumb?.data).toEqual({ from: "/instruments", to: "/auth/callback" });
  });

  it("konsola i kliknięcia UI są odrzucane (mogą nieść nazwy i tickery)", () => {
    expect(scrubSentryBreadcrumb({ category: "console", message: "quote failed for VWRL.L" })).toBeNull();
    expect(scrubSentryBreadcrumb({ category: "ui.click", message: 'button[aria-label="Usuń VWRL.L"]' })).toBeNull();
  });
});

describe("scrubSentryEvent", () => {
  it("czyści request, breadcrumbs i spany transakcji", () => {
    const event = scrubSentryEvent({
      request: {
        url: "https://zecca.app/api/market-data/search?q=VWRL",
        query_string: "q=VWRL",
        data: { amount: 1 },
        headers: { cookie: "x", "user-agent": "ua" },
      },
      user: { id: "u" },
      breadcrumbs: [
        { category: "console", message: "VWRL.L" },
        { category: "fetch", data: { url: "/api/market-data/quote?symbol=VWRL.L" } },
      ],
      spans: [
        {
          op: "http.client",
          description: "GET https://query1.finance.yahoo.com/v8/finance/chart/VWRL.L?range=5d",
          data: {
            url: "https://query1.finance.yahoo.com/v8/finance/chart/VWRL.L",
            "http.query": "?range=5d",
            "url.full": "https://query1.finance.yahoo.com/v8/finance/chart/VWRL.L?range=5d",
            "http.method": "GET",
          },
        },
        { op: "http.client", description: "GET /api/market-data/quote?symbol=CDR.WA", data: { "http.query": "?symbol=CDR.WA" } },
      ],
    });

    expect(event.request).toEqual({ url: "https://zecca.app/api/market-data/search", headers: { "user-agent": "ua" } });
    expect(event.user).toBeUndefined();
    expect(event.breadcrumbs).toEqual([{ category: "fetch", data: { url: "/api/market-data/quote" } }]);
    expect(event.spans?.[0]).toEqual({
      op: "http.client",
      description: "GET https://query1.finance.yahoo.com",
      data: {
        url: "https://query1.finance.yahoo.com",
        "url.full": "https://query1.finance.yahoo.com",
        "http.method": "GET",
      },
    });
    expect(event.spans?.[1]).toEqual({ op: "http.client", description: "GET /api/market-data/quote", data: {} });
    expect(JSON.stringify(event)).not.toMatch(/VWRL|CDR/);
  });
});

// Ślady wydajności (tracesSampleRate 0.1): Next ustawia na spanie głównym
// `http.target: req.url` (z query), instrumentacja undici dokłada `url.path`
// i `url.query` dla zapytań do Yahoo/NBP/obligacji, a nazwy transakcji
// i opisy spanów niosą surowe URL-e. Nic z tego nie może wyjść z procesu.
const PORTFOLIO_ID = "0b8c2f4e-1d3a-4c5b-9e6f-7a8b9c0d1e2f";
const LEAK = /VWRL|CDR|vanguard|edo0136|usd|2024-01|0b8c2f4e|\?/i;

describe("scrubSentryEvent — ślady wydajności", () => {
  it("transakcja serwerowa: nazwa, trace data i spany fetch bez query i tickerów", () => {
    const event = scrubSentryEvent({
      type: "transaction",
      transaction: "GET /api/market-data/quote?symbol=VWRL.AS",
      contexts: {
        trace: {
          op: "http.server",
          data: {
            "http.method": "GET",
            "http.target": "/api/market-data/quote?symbol=VWRL.AS",
            "next.span_name": "GET /api/market-data/quote?symbol=VWRL.AS",
            "next.span_type": "BaseServer.handleRequest",
            "http.status_code": 200,
          },
        },
      },
      request: {
        url: "https://zecca.app/api/market-data/quote?symbol=VWRL.AS",
        query_string: [["symbol", "VWRL.AS"]],
        headers: { referer: `https://zecca.app/portfolios/${PORTFOLIO_ID}?tab=positions` },
      },
      spans: [
        {
          op: "http.client",
          description: "GET https://query1.finance.yahoo.com/v8/finance/chart/VWRL.AS?interval=1d",
          data: {
            "http.request.method": "GET",
            "url.full": "https://query1.finance.yahoo.com/v8/finance/chart/VWRL.AS?interval=1d&range=5d",
            "url.path": "/v8/finance/chart/VWRL.AS",
            "url.query": "?interval=1d&range=5d",
            "url.scheme": "https",
            "server.address": "query1.finance.yahoo.com",
          },
        },
        {
          op: "http.client",
          description: "GET https://query1.finance.yahoo.com/v1/finance/search",
          data: {
            "url.full": "https://query1.finance.yahoo.com/v1/finance/search?q=vanguard&quotesCount=10",
            "url.path": "/v1/finance/search",
            "url.query": "?q=vanguard&quotesCount=10",
          },
        },
        {
          op: "http.client",
          description: "GET https://api.nbp.pl/api/exchangerates/rates/a/usd/2024-01-01/2024-01-10/",
          data: { "url.path": "/api/exchangerates/rates/a/usd/2024-01-01/2024-01-10/" },
        },
        {
          op: "http.client",
          description: "GET https://www.obligacjeskarbowe.pl/oferta-obligacji/obligacje-10-letnie-edo/edo0136/",
          data: { "url.path": "/oferta-obligacji/obligacje-10-letnie-edo/edo0136/" },
        },
      ],
    });

    expect(event.transaction).toBe("GET /api/market-data/quote");
    expect(event.contexts?.trace?.data).toEqual({
      "http.method": "GET",
      "http.target": "/api/market-data/quote",
      "next.span_name": "GET /api/market-data/quote",
      "next.span_type": "BaseServer.handleRequest",
      "http.status_code": 200,
    });
    expect(event.request).toEqual({
      url: "https://zecca.app/api/market-data/quote",
      headers: { referer: "https://zecca.app/portfolios/:id" },
    });
    expect(event.spans?.[0]).toEqual({
      op: "http.client",
      description: "GET https://query1.finance.yahoo.com",
      data: {
        "http.request.method": "GET",
        "url.full": "https://query1.finance.yahoo.com",
        "url.path": "/v8/finance/chart/:symbol",
        "url.scheme": "https",
        "server.address": "query1.finance.yahoo.com",
      },
    });
    expect(event.spans?.[2]?.data).toEqual({ "url.path": "/api/exchangerates/rates/a/:currency" });
    expect(event.spans?.[3]?.data).toEqual({ "url.path": "/oferta-obligacji/:family/:series" });
    expect(JSON.stringify(event)).not.toMatch(LEAK);
  });

  it("transakcja przeglądarki: nawigacja do portfela, fetch wyszukiwarki i breadcrumbs", () => {
    const event = scrubSentryEvent({
      type: "transaction",
      transaction: `/portfolios/${PORTFOLIO_ID}`,
      contexts: { trace: { op: "navigation", data: { "sentry.source": "url", "http.url": `/portfolios/${PORTFOLIO_ID}?tab=x` } } },
      request: {
        url: `https://zecca.app/portfolios/${PORTFOLIO_ID}?tab=x`,
        headers: { Referer: "https://zecca.app/instruments?q=VWRL", "User-Agent": "ua" },
      },
      spans: [
        {
          op: "http.client",
          description: "GET /api/market-data/search?q=Vanguard FTSE",
          data: {
            url: "/api/market-data/search?q=Vanguard%20FTSE",
            "http.url": "https://zecca.app/api/market-data/search?q=Vanguard%20FTSE",
            "http.query": "?q=Vanguard%20FTSE",
            "http.method": "GET",
          },
        },
        { op: "resource.script", description: "/_next/static/chunks/main-app.js" },
      ],
      breadcrumbs: [
        { category: "navigation", data: { from: `/portfolios/${PORTFOLIO_ID}?tab=x`, to: "/instruments?q=VWRL" } },
        { category: "xhr", data: { method: "GET", url: "/api/market-data/quote/VWRL.AS?currency=EUR", status_code: 200 } },
      ],
    });

    expect(event.transaction).toBe("/portfolios/:id");
    expect(event.request?.url).toBe("https://zecca.app/portfolios/:id");
    expect(event.request?.headers).toEqual({ Referer: "https://zecca.app/instruments", "User-Agent": "ua" });
    expect(event.spans?.[0]).toEqual({
      op: "http.client",
      description: "GET /api/market-data/search",
      data: { url: "/api/market-data/search", "http.url": "https://zecca.app", "http.method": "GET" },
    });
    expect(event.spans?.[1]?.description).toBe("/_next/static/chunks/main-app.js");
    expect(event.breadcrumbs).toEqual([
      { category: "navigation", data: { from: "/portfolios/:id", to: "/instruments" } },
      { category: "xhr", data: { method: "GET", url: "/api/market-data/quote/:param", status_code: 200 } },
    ]);
    expect(JSON.stringify(event)).not.toMatch(LEAK);
  });

  it("zdarzenie błędu: request.url, transakcja i trace data bez query i identyfikatorów", () => {
    const event = scrubSentryEvent({
      transaction: `GET /portfolios/${PORTFOLIO_ID}?tab=positions&symbol=VWRL.AS`,
      request: { url: `https://zecca.app/portfolios/${PORTFOLIO_ID}?tab=positions&symbol=VWRL.AS` },
      contexts: { trace: { data: { "http.target": `/portfolios/${PORTFOLIO_ID}?symbol=CDR.WA`, "http.route": "/portfolios/[id]" } } },
    });

    expect(event.transaction).toBe("GET /portfolios/:id");
    expect(event.request?.url).toBe("https://zecca.app/portfolios/:id");
    expect(event.contexts?.trace?.data).toEqual({ "http.target": "/portfolios/:id", "http.route": "/portfolios/:id" });
    expect(JSON.stringify(event)).not.toMatch(LEAK);
  });
});
