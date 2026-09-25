/**
 * The Company Profile's two team rosters (client-confirmed, 2026-09-24).
 *
 * "Sales & Marketing" is the account's own staff; "Outsourced" is a third
 * party delivering a workstream, which may be CRO Leader or anyone else.
 * Both carry the same four things — name, title, areas of responsibility,
 * weekly hours — so they are one table with a `kind`, not two.
 *
 * `name` is a single free field on purpose (client-confirmed), so a row can
 * read "Rosa Pineda · Northlight Events" as easily as a person alone.
 *
 * These hours were originally kept apart from the Command Center's
 * (client-confirmed, "separate for now", 2026-09-24). That was reversed on
 * 2026-09-25: a person's weekly commitment is now read as thirteen weeks of
 * capacity and measured against the unfinished task hours they carry across
 * all fourteen workstreams — see lib/team/capacity.ts, which records why the
 * period is a quarter and why it warns rather than blocks.
 *
 * The per-workstream allocations below are still unenforced against that
 * commitment: the allocated figure is shown so it is visible, and that is
 * all. Only the task load is measured.
 */

export type TeamKind = "in_house" | "outsourced";

export interface TeamAssignment {
  step_slug: string;
  weekly_hours: number;
}

export interface TeamMember {
  id: string;
  kind: TeamKind;
  name: string;
  title: string | null;
  weekly_hours: number;
  sort_order: number;
  assignments: TeamAssignment[];
}

export const TEAM_KIND_LABEL: Record<TeamKind, string> = {
  in_house: "Sales & Marketing",
  outsourced: "Outsourced",
};

/** Hours already spread across this person's workstreams. */
export function allocatedHours(member: Pick<TeamMember, "assignments">): number {
  return member.assignments.reduce((sum, a) => sum + a.weekly_hours, 0);
}

/**
 * Everyone on one workstream, in roster order, both kinds together.
 *
 * Counts two things (client-confirmed fix, 2026-09-25): people declared
 * against the workstream in the Company Profile, and people who simply
 * hold tasks in it on the Command Center board. Reading only the first
 * made every Mission Card say "Nobody assigned yet" while sixty-seven
 * tasks had owners. `hours` is the declared weekly figure and is 0 for
 * someone known only from their tasks, so a caller totalling it must not
 * present the sum as everybody's commitment.
 */
export function membersForStep(
  members: TeamMember[],
  slug: string,
  stepTasks?: Record<string, Record<string, { open: number; total: number; hours: number }>>
): { member: TeamMember; hours: number; declared: boolean }[] {
  return members
    .map((member) => {
      const assignment = member.assignments.find((a) => a.step_slug === slug);
      if (assignment) return { member, hours: assignment.weekly_hours, declared: true };
      const tally = stepTasks?.[member.id]?.[slug];
      if (tally && tally.total > 0) return { member, hours: 0, declared: false };
      return null;
    })
    .filter((x): x is { member: TeamMember; hours: number; declared: boolean } => x !== null);
}

export function initialsOf(name: string): string {
  const parts = name.replace(/·.*$/, "").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "")).toUpperCase();
}
