import type { StepTaskTally } from "@/lib/gos-dashboard/queries";
import type { TeamMember } from "@/lib/team/members";

/**
 * What a person is doing on a workstream, from both directions
 * (client-confirmed fix, 2026-09-25).
 *
 * There are two notions of "who works on this workstream" and they are
 * deliberately kept apart:
 *
 *   - **Declared** — a row in `account_team_assignments`, set in the
 *     Company Profile. It is a *plan*, and it is the only thing that can
 *     carry planned weekly hours for a workstream.
 *   - **From tasks** — the person has tasks in that workstream on the
 *     Command Center board. It is what has actually landed on them.
 *
 * Only the first was being read, so a person with tasks in ten workstreams
 * and no declared assignment showed as doing nothing — "None yet" on the
 * roster, and "Nobody assigned yet" on every Mission Card.
 *
 * They are merged for display but never silently reconciled: declaring an
 * assignment from a task would invent a plan with zero hours and make the
 * distinction meaningless. The client's standing preference on these two
 * sources is to keep both and let them disagree, so the UI marks which is
 * which instead of picking a winner.
 */
export interface Involvement {
  step_slug: string;
  /** Planned weekly hours, or null when this came only from tasks. */
  declaredHours: number | null;
  /** Unfinished tasks here, and the hours they carry. */
  openTasks: number;
  totalTasks: number;
  taskHours: number;
}

export function isDeclared(i: Involvement): boolean {
  return i.declaredHours !== null;
}

/**
 * Every workstream a person touches, declared first (they carry hours and
 * are the deliberate statement), then the ones known only from tasks.
 */
export function involvementFor(
  member: TeamMember,
  stepTasks: Record<string, StepTaskTally> | undefined
): Involvement[] {
  const tasks = stepTasks ?? {};
  const declared = new Set(member.assignments.map((a) => a.step_slug));

  const fromPlan: Involvement[] = member.assignments.map((a) => {
    const t = tasks[a.step_slug];
    return {
      step_slug: a.step_slug,
      declaredHours: a.weekly_hours,
      openTasks: t?.open ?? 0,
      totalTasks: t?.total ?? 0,
      taskHours: t?.hours ?? 0,
    };
  });

  const fromTasks: Involvement[] = Object.entries(tasks)
    .filter(([slug]) => !declared.has(slug))
    .map(([slug, t]) => ({
      step_slug: slug,
      declaredHours: null,
      openTasks: t.open,
      totalTasks: t.total,
      taskHours: t.hours,
    }))
    // Busiest first, so the workstream someone is most buried in reads first.
    .sort((a, b) => b.openTasks - a.openTasks || b.totalTasks - a.totalTasks);

  return [...fromPlan, ...fromTasks];
}

/** How many workstreams a person touches at all, either way. */
export function involvementCount(
  member: TeamMember,
  stepTasks: Record<string, StepTaskTally> | undefined
): number {
  return involvementFor(member, stepTasks).length;
}
