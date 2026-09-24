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
 * These hours are deliberately **not** connected to the Command Center's
 * (client-confirmed, "separate for now"): this is weekly intent, while
 * gos_dashboard_quarter_hours records what was committed and achieved in a
 * quarter. Nothing is enforced between a person's weekly commitment and the
 * sum of their assignments either — the allocated figure is shown so it is
 * visible, and that is all.
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

/** Everyone assigned to one workstream, in roster order, both kinds together. */
export function membersForStep(members: TeamMember[], slug: string): { member: TeamMember; hours: number }[] {
  return members
    .map((member) => {
      const assignment = member.assignments.find((a) => a.step_slug === slug);
      return assignment ? { member, hours: assignment.weekly_hours } : null;
    })
    .filter((x): x is { member: TeamMember; hours: number } => x !== null);
}

export function initialsOf(name: string): string {
  const parts = name.replace(/·.*$/, "").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "")).toUpperCase();
}
