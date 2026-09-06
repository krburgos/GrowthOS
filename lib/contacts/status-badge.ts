/**
 * Design System §8.3 — status categories are keyed by name against the
 * Backend Schema §7.5 defaults; any other name (i.e. a custom status)
 * defaults to "neutral", exactly as §8.3 specifies.
 */
const IN_PROGRESS = new Set(["mqc", "mql", "engaged"]);
const POSITIVE = new Set(["existing client"]);
const NEGATIVE = new Set(["not a fit", "unsub - call only", "scrub"]);

export function statusBadgeVariant(name: string): "neutral" | "info" | "success" | "error" {
  const key = name.trim().toLowerCase();
  if (POSITIVE.has(key)) return "success";
  if (NEGATIVE.has(key)) return "error";
  if (IN_PROGRESS.has(key)) return "info";
  return "neutral";
}
