/**
 * Base URL for Supabase auth redirects (OAuth callback, email links).
 *
 * We deliberately do NOT use `window.location.origin` verbatim: when the app is
 * opened inside an in-app webview (Facebook/Instagram/mail) HSTS is ignored and
 * the origin stays `http://zecca.pl`. That produces `http://…/auth/callback`,
 * which is not on Supabase's Redirect URLs allowlist — Supabase then falls back
 * to the Site URL and drops the `?code`, so login silently fails. Forcing https
 * for any non-localhost host keeps the redirect on the allowlisted canonical URL
 * while preserving localhost/preview development.
 */
export function authRedirectBase(): string {
  const { origin, hostname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") return origin;
  return origin.replace(/^http:/, "https:");
}
