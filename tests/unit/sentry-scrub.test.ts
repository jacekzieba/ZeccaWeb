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
