import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const securityHeaders = [
  // Force HTTPS. Vercel sets this too; keeping it explicit documents intent.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Clickjacking protection — the app is never meant to be framed.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable browser features the app does not use.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  typedRoutes: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withSentryConfig(nextConfig, {
  org: "zecca",
  project: "zecca",
  // Quiet build logs outside CI. Source-map upload needs SENTRY_AUTH_TOKEN (set
  // in Vercel env) — the build still succeeds without it, just without readable
  // stack traces.
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
