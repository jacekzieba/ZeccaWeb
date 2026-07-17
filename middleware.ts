import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Content-Security-Policy in Report-Only mode. It blocks nothing yet — the
 * browser only POSTs violations to `/api/csp-report` — so we can watch real
 * traffic before switching to an enforcing `Content-Security-Policy`. Browser
 * requests only ever reach our own origin (all `/api/*`), Supabase (auth +
 * realtime) and TelemetryDeck; Yahoo/NBP/GUS/finwire/obligacjeskarbowe are
 * called server-side and need no connect-src entry. `strict-dynamic` + nonce is
 * the target script policy; `unsafe-inline`/`https:` are ignored by supporting
 * browsers and only serve as a fallback for older ones.
 */
function buildCspReportOnly(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://nom.telemetrydeck.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "report-uri /api/csp-report",
  ].join("; ");
}

export async function middleware(request: NextRequest) {
  const fakeSyncEnabled =
    process.env.NEXT_PUBLIC_FAKE_SYNC === "1" &&
    process.env.NODE_ENV !== "production";

  const nonce = btoa(crypto.randomUUID());
  const cspReportOnly = buildCspReportOnly(nonce);
  // Expose the nonce and the policy to Next on the REQUEST headers so the
  // framework stamps its own inline bootstrap scripts with the same nonce.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy-Report-Only", cspReportOnly);

  const applyCsp = (response: NextResponse) => {
    response.headers.set("Content-Security-Policy-Report-Only", cspReportOnly);
    return response;
  };

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isSeoAsset =
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/manifest.webmanifest";

  // Redirect authenticated users away from the auth pages
  if (user && (pathname === "/login" || pathname === "/register")) {
    return applyCsp(NextResponse.redirect(new URL("/dashboard", request.url)));
  }

  // Protect all app routes
  // /reset-password stays public: the recovery link may land without a session,
  // and the form itself explains how to request a fresh link.
  const isPublicApiRoute =
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/market-data/") ||
    pathname === "/api/csp-report" ||
    pathname === "/api/beta-waitlist";
  const isAppRoute =
    pathname !== "/" &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/register") &&
    !pathname.startsWith("/forgot-password") &&
    !pathname.startsWith("/reset-password") &&
    !pathname.startsWith("/privacy-policy") &&
    !pathname.startsWith("/faq") &&
    !pathname.startsWith("/auth/") &&
    !isSeoAsset &&
    !isPublicApiRoute &&
    !pathname.startsWith("/_next") &&
    pathname !== "/favicon.ico";

  if (!user && isAppRoute && !fakeSyncEnabled) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return applyCsp(NextResponse.redirect(redirectUrl));
  }

  return applyCsp(supabaseResponse);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
