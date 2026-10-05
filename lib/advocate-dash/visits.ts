/**
 * My Visits — the Advocate's field screen (client-confirmed, 2026-10-05).
 *
 * Pure grouping and ordering, so the client component can import it. The
 * reads stay in lib/advocate-dash/queries.ts.
 *
 * This screen answers one question an Advocate asks while standing in a car
 * park: what am I doing next, and what do I still owe. So the buckets are
 * not the three target states — they are degrees of "needs me now".
 */

import type { AdvocateTarget } from "@/lib/advocate-dash/targets";

export type VisitBucketKey = "overdue" | "today" | "upcoming" | "unscheduled" | "owed" | "done";

export interface VisitBucket {
  key: VisitBucketKey;
  title: string;
  /** Shown under the title when the bucket has rows. */
  hint?: string;
  targets: AdvocateTarget[];
}

/** Today as `YYYY-MM-DD` in the viewer's own timezone, not UTC. */
export function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * A completed drop-by whose report has not been submitted. This is the
 * Advocate's actual debt — the report is the deliverable, so a visit made
 * and never written up is worth more of their attention than one still to
 * make.
 */
export function owesReport(target: AdvocateTarget): boolean {
  return target.status === "completed" && !target.report?.submitted_at;
}

/**
 * Buckets in the order the screen shows them. Empty buckets are dropped by
 * the caller rather than here, so the ordering stays declarative.
 *
 * A completed visit missing its report is pulled out of "done" regardless
 * of when it happened — otherwise it would sink down the list behind more
 * recent work and never get written up.
 */
export function bucketVisits(targets: AdvocateTarget[], today = todayKey()): VisitBucket[] {
  const byDateThenAdded = (a: AdvocateTarget, b: AdvocateTarget) => {
    const ad = a.scheduled_for ?? "";
    const bd = b.scheduled_for ?? "";
    if (ad !== bd) return ad < bd ? -1 : 1;
    return a.target_name.localeCompare(b.target_name);
  };

  const open = targets.filter((t) => t.status !== "completed");

  return [
    {
      key: "overdue",
      title: "Missed",
      hint: "Scheduled before today and still not done",
      targets: open
        .filter((t) => t.scheduled_for !== null && t.scheduled_for < today)
        .sort(byDateThenAdded),
    },
    {
      key: "today",
      title: "Today",
      targets: open.filter((t) => t.scheduled_for === today).sort(byDateThenAdded),
    },
    {
      key: "upcoming",
      title: "Coming up",
      targets: open
        .filter((t) => t.scheduled_for !== null && t.scheduled_for > today)
        .sort(byDateThenAdded),
    },
    {
      key: "unscheduled",
      title: "Not booked in yet",
      hint: "Assigned to you with no date set",
      targets: open.filter((t) => t.scheduled_for === null).sort(byDateThenAdded),
    },
    {
      key: "owed",
      title: "Report owed",
      hint: "Visited, but the report is not submitted",
      targets: targets
        .filter(owesReport)
        .sort((a, b) => (b.completed_on ?? "").localeCompare(a.completed_on ?? "")),
    },
    {
      key: "done",
      title: "Done",
      targets: targets
        .filter((t) => t.status === "completed" && !owesReport(t))
        .sort((a, b) => (b.completed_on ?? "").localeCompare(a.completed_on ?? "")),
    },
  ];
}

/** "Mon 5 Oct" — a field screen wants the weekday, not the year. */
export function formatVisitDay(value: string | null): string | null {
  if (!value) return null;
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** The next address worth opening in Maps: the soonest thing still to do. */
export function nextStop(buckets: VisitBucket[]): AdvocateTarget | null {
  for (const key of ["today", "overdue", "upcoming", "unscheduled"] as VisitBucketKey[]) {
    const bucket = buckets.find((b) => b.key === key);
    const withAddress = bucket?.targets.find((t) => t.address);
    if (withAddress) return withAddress;
  }
  return null;
}
