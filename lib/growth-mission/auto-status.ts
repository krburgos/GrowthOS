import type { PlaybookStatus } from "@/lib/growth-mission/playbook";

/**
 * Proposal (2026-11-10, UX audit, branch ux/headquarters-today): a Mission
 * Card's status worked out from work done against time elapsed, so a card
 * can't read "On Track" with nothing completed halfway through the quarter.
 *
 * Expected by today = the quarter's target × the share of the quarter gone.
 * At least 115% of that is Ahead, at least 75% On Track, below that Needs
 * Attention. In the first tenth of a quarter, or when no target is set,
 * the card keeps the status typed on its page.
 */
export function autoStatus(target: number, done: number, elapsedPct: number, typed: PlaybookStatus): PlaybookStatus {
  if (target <= 0 || elapsedPct < 10) return typed;
  const expected = (target * elapsedPct) / 100;
  const ratio = done / expected;
  if (ratio >= 1.15) return "ahead";
  if (ratio >= 0.75) return "on_track";
  return "needs_attention";
}
