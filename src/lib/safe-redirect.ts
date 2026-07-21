/** Returns `next` only when it is a safe same-origin relative path, else `fallback`. */
export function safeRelativePath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next) return fallback;
  // Backslashes and ASCII control chars (incl. tab/newline) are folded/stripped
  // into a `//authority` by URL parsers, so reject them before the prefix checks.
  if (/[\x00-\x20\\]/.test(next)) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}
