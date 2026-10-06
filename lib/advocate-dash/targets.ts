/**
 * AdvocateDash targets — the drop-by list (client-confirmed, 2026-10-05).
 *
 * Pure types and helpers only, so client components can import this without
 * pulling the Supabase server client into the browser bundle. The reads live
 * in lib/advocate-dash/queries.ts, which is server-only — the same split
 * lib/gos-dashboard/tasks.ts and queries.ts already use, and for the same
 * reason: that boundary was crossed once and shipped a server client to the
 * browser.
 *
 * A target is one drop-by: who is being visited, where, by which advocate,
 * what state it is in, the letter that was delivered, and the VictoryVisit
 * report filed afterwards. The list is a running one — there is deliberately
 * no quarter, unlike every hours-measured workstream.
 */

import type { TeamKind, TeamMember } from "@/lib/team/members";

/**
 * The one workstream that runs on targets rather than tasks and hours. Named
 * here so the pages that branch on it do not spell the slug by hand.
 */
export const ADVOCATE_DASH_SLUG = "advocate-dash";

export type TargetStatus = "assigned" | "scheduled" | "completed";

export const TARGET_STATUSES: { value: TargetStatus; label: string }[] = [
  { value: "assigned", label: "Assigned" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
];

export const TARGET_STATUS_LABEL: Record<TargetStatus, string> = {
  assigned: "Assigned",
  scheduled: "Scheduled",
  completed: "Completed",
};

/**
 * Solid fills with white text, matching the task sheet's status palette so
 * the two sheets read as the same product. The progression is deliberate:
 * neutral for "nobody has booked it yet", the brand cyan once it is on a
 * calendar, green once the drop-by has happened.
 */
export const TARGET_STATUS_CELL: Record<TargetStatus, string> = {
  assigned: "bg-neutral-400",
  scheduled: "bg-secondary-500",
  completed: "bg-success-600",
};

/** Sort order for the Status column — the lifecycle, not the alphabet. */
export const TARGET_STATUS_ORDER: Record<TargetStatus, number> = {
  assigned: 0,
  scheduled: 1,
  completed: 2,
};

/** The letter actually delivered to a target, uploaded per target. */
export interface TargetLetter {
  path: string;
  name: string | null;
  size: number | null;
  uploadedAt: string | null;
}

export interface AdvocateTarget {
  id: string;
  target_name: string;
  company_name: string | null;
  address: string | null;
  status: TargetStatus;
  /** The date the drop-by is booked for; null until scheduled. */
  scheduled_for: string | null;
  /** Manual visit order, lowest first. Ties fall back to insertion order. */
  sort_order: number;
  completed_on: string | null;
  advocate: { id: string; name: string; kind: TeamKind } | null;
  letter: TargetLetter | null;
  /** Null until somebody opens the form; `submitted` once signed off. */
  report: { id: string; submitted_at: string | null; sections_done: number } | null;
  photo_count: number;
}

/**
 * What the Mission Card shows instead of the hours triad (client-confirmed,
 * 2026-10-05): this workstream is measured in drop-bys.
 *
 * `targets` is the whole list rather than the ones still outstanding, so the
 * three figures read as a total and two of its parts. Keeping Completed as
 * its own cell is the point — it is the number the service is judged on.
 */
export function targetSummary(targets: AdvocateTarget[]) {
  const scheduled = targets.filter((t) => t.status === "scheduled").length;
  const completed = targets.filter((t) => t.status === "completed").length;
  return {
    targets: targets.length,
    scheduled,
    completed,
    /** Completed drop-bys with no report filed yet — the card's warning. */
    awaitingReport: targets.filter(
      (t) => t.status === "completed" && !t.report?.submitted_at
    ).length,
    unassigned: targets.filter((t) => t.status !== "completed" && !t.advocate).length,
  };
}

/**
 * Who is on this workstream, for the Mission Card's avatar row.
 *
 * The shared `membersForStep` cannot answer this: it counts people declared
 * against a workstream in the Company Profile plus anyone holding *tasks*
 * in it, and AdvocateDash has no tasks. Reading only the declared list is
 * exactly the bug that once made every card say "Nobody assigned" while
 * every row had an owner, so this counts advocates on targets the same way
 * and merges the two.
 *
 * `hours` is 0 throughout and is only here to match the card's existing
 * prop shape — this workstream has no hours. A caller must not total it.
 */
export function advocatesForCard(
  team: TeamMember[],
  targets: AdvocateTarget[],
  slug = ADVOCATE_DASH_SLUG
): { member: TeamMember; hours: number; declared: boolean }[] {
  const counts = new Map<string, number>();
  for (const target of targets) {
    if (!target.advocate) continue;
    counts.set(target.advocate.id, (counts.get(target.advocate.id) ?? 0) + 1);
  }

  const declared = team.filter((m) => m.assignments.some((a) => a.step_slug === slug));
  const declaredIds = new Set(declared.map((m) => m.id));

  // Declared members first, in roster order; then anyone known only from
  // the targets they carry, busiest first.
  const fromTargets = team
    .filter((m) => !declaredIds.has(m.id) && counts.has(m.id))
    .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));

  return [
    ...declared.map((member) => ({ member, hours: 0, declared: true })),
    ...fromTargets.map((member) => ({ member, hours: 0, declared: false })),
  ];
}

/**
 * A Google Maps link for the address column (client-confirmed). Built from
 * a search query rather than coordinates, because the address is one free
 * text line as somebody would write it on the paper form.
 */
export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/** "5 Jul 2026" — the Done column wants a date, not a timestamp. */
export function formatTargetDate(value: string | null): string {
  if (!value) return "—";
  // Date-only strings are parsed as UTC, so read the parts back out rather
  // than letting a negative local offset roll the day backwards.
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** How the row sorts for a given column. */
export function targetSortValue(target: AdvocateTarget, key: TargetSortKey): string | number {
  switch (key) {
    case "target":
      return `${target.target_name} ${target.company_name ?? ""}`.toLowerCase();
    case "address":
      return (target.address ?? "").toLowerCase();
    case "advocate":
      return (target.advocate?.name ?? "").toLowerCase();
    case "status":
      return TARGET_STATUS_ORDER[target.status];
    case "done":
      // Unvisited targets sort last in ascending order rather than first.
      return target.completed_on ?? "9999-12-31";
  }
}

export type TargetSortKey = "target" | "address" | "advocate" | "status" | "done";
