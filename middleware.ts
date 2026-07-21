import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Content-Security-Policy — enforced in production, Report-Only in development
 * (so local HMR/eval is not blocked while violations are still reported to
 * `/api/csp-report`).
 *
 * Script policy is `script-src 'self' 'unsafe-inline'` rather than a nonce +
 * `strict-dynamic` policy: several pages (`/`, `/login`, `/register`, `/demo`,
 * `/faq`, `/privacy-policy`, `/forgot-password`, `/reset-password`) are
 * statically prerendered, so their script tags are baked at build time and
 * cannot carry a per-request nonce. A nonce + `strict-dynamic` policy makes
 * browsers ignore `'self'`/`'unsafe-inline'` and blocks Next's inline RSC
 * bootstrap (`self.__next_f.push`) on those pages — verified to break them.
 * `'self' 'unsafe-inline'` keeps them working while still blocking external and
 * injected `src` scripts, and every other directive is enforced strictly. The
 * app ships no external scripts and no app-authored executable inline scripts
 * (only Next's framework bootstrap and escaped application/ld+json data blocks).
 * Browser requests only ever reach our own origin (all `/api/*` and same-origin
 * `/_vercel/*` analytics), Supabase (auth + realtime) and TelemetryDeck;
 * Yahoo/NBP/GUS/finwire/obligacjeskarbowe are called server-side. To upgrade to
 * a strong nonce policy later, make the currently-static pages dynamic — see
 * audit/SECURITY_HEADERS_AND_BROWSER_CONTROLS.md.
 */
function buildCsp(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://nom.telemetrydeck.com https://*.ingest.de.sentry.io",
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

  const csp = buildCsp();
  // Enforce in production; keep Report-Only in development so local HMR
  // (eval/inline) is not blocked while we still collect violation reports.
  const cspHeaderName =
    process.env.NODE_ENV === "production"
      ? "Content-Security-Policy"
      : "Content-Security-Policy-Report-Only";
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(cspHeaderName, csp);

  const applyCsp = (response: NextResponse) => {
    response.headers.set(cspHeaderName, csp);
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
          // request.cookies.set rewrote the request's Cookie header; mirror it
          // onto the forwarded headers, or server components would read the
          // pre-refresh session from the stale clone.
          requestHeaders.set("cookie", request.headers.get("cookie") ?? "");
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

  // Logged-in users skip the marketing landing and land straight in their app.
  // This keeps `/` itself static — the page component does no auth work.
  if (user && pathname === "/" && !fakeSyncEnabled) {
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
    !pathname.startsWith("/demo") &&
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
