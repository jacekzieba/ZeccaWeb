import type { NextConfig } from "next";

const securityHeaders = [
  // Force HTTPS. Vercel sets this too; keeping it explicit documents intent.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Clickjacking protection — the app is never meant to be framed.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Isolate the browsing context and keep other sites from pulling our
  // responses cross-origin. OAuth uses full-page redirects, not popups, so
  // COOP doesn't break sign-in.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable browser features the app does not use.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  typedRoutes: true,
  // "N" badge dev tools nakładały się na kartę w rogu ekranu podczas testów —
  // widoczne tylko w `next dev`, nigdy w produkcji, ale zasłaniały UI lokalnie.
  devIndicators: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
