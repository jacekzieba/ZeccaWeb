import { NextResponse, type NextRequest } from "next/server";
import { rateLimitResponse } from "@/market-data/rate-limit";

export const runtime = "nodejs";

// Collects Content-Security-Policy-Report-Only violations during the observation
// phase. Browsers POST here (report-uri) with a JSON body; we log the blocked
// directive/URI so real violations from our own code can be triaged before the
// policy is switched to enforcing. Kept unauthenticated (the browser sends no
// session) but rate-limited so it can't be used to flood logs.
export async function POST(request: NextRequest) {
  const limited = rateLimitResponse(request, { namespace: "csp-report", max: 30 });
  if (limited) return limited;

  try {
    const body = (await request.json().catch(() => null)) as
      | { "csp-report"?: Record<string, unknown> }
      | Record<string, unknown>
      | null;
    const report = (body && "csp-report" in body ? body["csp-report"] : body) as
      | Record<string, unknown>
      | null;

    if (report) {
      console.warn("CSP violation", {
        documentUri: report["document-uri"] ?? report["documentURL"],
        violatedDirective: report["violated-directive"] ?? report["effectiveDirective"],
        blockedUri: report["blocked-uri"] ?? report["blockedURL"],
      });
    }
  } catch {
    // A malformed report must never surface as an error to the browser.
  }

  // 204: nothing to return to the reporting browser.
  return new NextResponse(null, { status: 204 });
}
