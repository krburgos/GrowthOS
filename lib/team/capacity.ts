/**
 * Whether a person has been given more work than their commitment covers
 * (client-confirmed, 2026-09-25). This reverses the earlier "separate for
 * now" decision of 2026-09-24, which deliberately left the roster's weekly
 * hours unconnected to anything.
 *
 * Three things were settled before building it, because each had two
 * defensible readings that gave opposite answers on the client's own data:
 *
 *   1. **The period is a quarter.** A task's `hours` is a size-of-job
 *      estimate, not a weekly schedule — a 12-hour Core Web Vitals fix is
 *      not twelve hours next week — so a weekly commitment is converted to
 *      a quarter at `weekly × 13` and compared against that. It is also
 *      the only reading that works at all for the tasks that carry no due
 *      date, and it puts capacity in the same unit as
 *      `gos_dashboard_quarter_hours`, which is how the rest of the
 *      Command Center counts.
 *   2. **The cap is the person's whole commitment**, not their
 *      per-workstream allocation, so it counts their open tasks across all
 *      fourteen workstreams. Someone doing SEO and blogging is one person
 *      with one week.
 *   3. **It warns, it does not block.** Over-allocation is frequently the
 *      truth that needs recording, and CRO Leader may be overbooking
 *      someone knowingly. Nothing in the database refuses the write.
 *
 * Only unfinished work counts. A completed task has already happened and
 * no longer competes for the hours that are left.
 */

/** A quarter is thirteen weeks, matching `currentQuarter()` in hours.ts. */
export const WEEKS_PER_QUARTER = 13;

/** Over this share of capacity a person is worth flagging before they tip. */
const TIGHT_FROM = 0.85;

export type CapacityTone = "unset" | "comfortable" | "tight" | "over";

export interface Capacity {
  /** The commitment as recorded on the roster. */
  weekly: number;
  /** What that comes to across a quarter. */
  quarterly: number;
  /** Hours of unfinished work assigned, across every workstream. */
  assigned: number;
  /** Negative once they are over. */
  remaining: number;
  /** Share of the quarter used, 0–1+. Zero when no commitment is recorded. */
  ratio: number;
  over: boolean;
  tone: CapacityTone;
}

/**
 * A person with no weekly hours recorded is "unset", never "over" — zero
 * capacity would otherwise make every assignment an overage, which would
 * bury the real ones. Most accounts start out this way.
 */
export function capacityFor(weeklyHours: number, assignedHours: number): Capacity {
  const quarterly = weeklyHours * WEEKS_PER_QUARTER;
  const remaining = quarterly - assignedHours;
  const ratio = quarterly > 0 ? assignedHours / quarterly : 0;

  let tone: CapacityTone = "comfortable";
  if (quarterly <= 0) tone = "unset";
  else if (remaining < 0) tone = "over";
  else if (ratio >= TIGHT_FROM) tone = "tight";

  return {
    weekly: weeklyHours,
    quarterly,
    assigned: assignedHours,
    remaining,
    ratio,
    over: tone === "over",
    tone,
  };
}

/** Tailwind classes per tone — one place, so board and roster agree. */
export const CAPACITY_CLASS: Record<CapacityTone, { text: string; bar: string; chip: string }> = {
  unset: { text: "text-neutral-400", bar: "bg-neutral-300", chip: "bg-neutral-100 text-neutral-500" },
  comfortable: { text: "text-neutral-500", bar: "bg-secondary-500", chip: "bg-secondary-100 text-secondary-800" },
  tight: { text: "text-warning-800", bar: "bg-warning-400", chip: "bg-warning-100 text-warning-800" },
  over: { text: "text-error-700", bar: "bg-error-500", chip: "bg-error-100 text-error-700" },
};

/** Hours read as whole numbers when they are whole ones: 12, not 12.0. */
export function formatCapacityHours(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** "51 of 325 hrs this quarter", or why we cannot say. */
export function capacityLabel(cap: Capacity): string {
  if (cap.tone === "unset") return "No weekly hours set";
  return `${formatCapacityHours(cap.assigned)} of ${formatCapacityHours(cap.quarterly)} hrs this quarter`;
}

/** The short form for a crowded row. */
export function capacityShort(cap: Capacity): string {
  if (cap.tone === "unset") return "no hours set";
  const n = cap.over ? -cap.remaining : cap.remaining;
  return `${hrs(n)} ${cap.over ? "over" : "left"}`;
}

/** "1 hr", "2 hrs", "1.5 hrs". */
function hrs(value: number): string {
  return `${formatCapacityHours(value)} ${value === 1 ? "hr" : "hrs"}`;
}
