/**
 * Where to send someone after signing in, taken from a `next` parameter.
 * Only paths on this site count — "/contacts/123", never "https://…" or
 * "//elsewhere" — so a crafted link can't hand a fresh session to another
 * site. Anything else falls back to `fallback`.
 */
export function safeNext(raw: string | null | undefined, fallback = "/headquarters"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}
