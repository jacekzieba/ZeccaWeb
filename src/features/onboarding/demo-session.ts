/**
 * Public demo sessions are marked with a session cookie so the server-side
 * gates (middleware + the authenticated layout) can let a signed-out visitor
 * browse the app pages on in-memory sample data. Only page routes open up —
 * `/api/*` stays behind the auth gate, and the demo never has a Supabase
 * client or a user data key, so every write path is already disabled.
 */
export const DEMO_SESSION_COOKIE = "zecca-demo";

export function startDemoSession() {
  document.cookie = `${DEMO_SESSION_COOKIE}=1; path=/; samesite=lax`;
}

export function endDemoSession() {
  document.cookie = `${DEMO_SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
