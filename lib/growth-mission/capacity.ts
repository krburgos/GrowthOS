import { ADVOCATE_DASH_SLUG } from "@/lib/advocate-dash/targets";
import { EMPTY_HOURS, type QuarterInfo, type StepHours } from "@/lib/growth-mission/hours";
import { PLAYBOOK_STEPS } from "@/lib/growth-mission/playbook";
import { WEEKS_PER_QUARTER } from "@/lib/team/capacity";
import type { TeamMember } from "@/lib/team/members";

/**
 * Mission Capacity (client-confirmed, 2026-10-13, approved mockup "Mission
 * Dashboards" v5). Pure functions, so the Command Center, Headquarters,
 * the discipline page and the PDF all count the same way.
 */

/** 25 credits buy one hour; one credit is $1 at $25 an hour. */
export const CREDITS_PER_HOUR = 25;

/** The fields of a mission order these figures read. */
export interface CapacityTask {
  step_slug: string;
  hours: number;
  state: string;
  due_date: string | null;
  completed_at: string | null;
  /** A GrowthMission order — the only kind that spends credits. */
  delegated: boolean;
}

export interface CreditAllotment {
  /** First of a month, ISO date. */
  effective_month: string;
  monthly_credits: number;
}

export interface MissionCapacity {
  hours: { required: number; available: number; completed: number };
  credits: {
    required: number;
    /** Null until CRO Leader has set an allotment for the account. */
    available: number | null;
    used: number;
    /** The allotment in force this month, for the Set credits dialog. */
    monthly: number | null;
  };
}

/**
 * Whether an order's hours belong to this quarter's Hours Required.
 *
 * An order belongs to the quarter it is due in. An undated one is treated
 * as due at the end of the current quarter, which is the default the
 * database now gives every new order. Orders due in an earlier quarter
 * carry forward while unfinished (client-confirmed): the work still has
 * to happen. One that is then finished this quarter stays counted, or
 * Hours Completed could exceed Hours Required for the same work.
 */
export function isRequiredThisQuarter(task: CapacityTask, q: QuarterInfo): boolean {
  const due = task.due_date ?? q.end;
  if (due >= q.start && due < q.nextStart) return true;
  if (due < q.start) return task.state !== "complete" || isCompletedThisQuarter(task, q);
  return false;
}

export function isCompletedThisQuarter(task: CapacityTask, q: QuarterInfo): boolean {
  if (task.state !== "complete" || !task.completed_at) return false;
  const day = task.completed_at.slice(0, 10);
  return day >= q.start && day < q.nextStart;
}

/** Per-discipline Required / Committed / Completed, for the Mission Cards and the discipline page. */
export function stepHoursFor(
  tasks: CapacityTask[],
  team: TeamMember[],
  outsourced: Record<string, boolean>,
  q: QuarterInfo
): Record<string, StepHours> {
  const result: Record<string, StepHours> = {};
  for (const shape of PLAYBOOK_STEPS) {
    result[shape.slug] = { ...EMPTY_HOURS, outsourced: outsourced[shape.slug] ?? false };
  }
  for (const task of tasks) {
    const h = result[task.step_slug];
    if (!h) continue;
    if (isRequiredThisQuarter(task, q)) h.required += task.hours;
    if (isCompletedThisQuarter(task, q)) h.completed += task.hours;
  }
  for (const member of team) {
    for (const a of member.assignments) {
      const h = result[a.step_slug];
      if (h) h.committed += a.weekly_hours * WEEKS_PER_QUARTER;
    }
  }
  return result;
}

/** The allotment in force for a month: the latest row on or before it. */
function allotmentFor(month: string, sorted: CreditAllotment[]): number {
  let value = 0;
  for (const row of sorted) {
    if (row.effective_month <= month) value = row.monthly_credits;
    else break;
  }
  return value;
}

function monthStart(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

/**
 * The whole account's Mission Capacity for the quarter.
 *
 * Credits are a running balance (client-confirmed): every month from the
 * first allotment up to and including this one adds its allotment, and
 * every hour completed since that first month spends 25. Nothing resets at
 * the quarter, so unused credits roll over. Work completed before credits
 * were first set is not charged against them.
 *
 * Client-confirmed (2026-10-14): only GrowthMission orders spend credits.
 * Internal and Outsourced work is the account's own, so credits Required,
 * Used and the balance read delegated orders alone, while the hours
 * figures still count every order.
 */
export function missionCapacity(
  tasks: CapacityTask[],
  team: TeamMember[],
  allotments: CreditAllotment[],
  q: QuarterInfo,
  now = new Date()
): MissionCapacity {
  // AdvocateDash is measured in drop-bys and carries no hours.
  const hourTasks = tasks.filter((t) => t.step_slug !== ADVOCATE_DASH_SLUG);
  const required = hourTasks.filter((t) => isRequiredThisQuarter(t, q)).reduce((s, t) => s + t.hours, 0);
  const completed = hourTasks.filter((t) => isCompletedThisQuarter(t, q)).reduce((s, t) => s + t.hours, 0);
  const available = team.reduce((s, m) => s + m.weekly_hours, 0) * WEEKS_PER_QUARTER;

  const creditTasks = hourTasks.filter((t) => t.delegated);
  const creditHoursRequired = creditTasks.filter((t) => isRequiredThisQuarter(t, q)).reduce((s, t) => s + t.hours, 0);
  const creditHoursUsed = creditTasks.filter((t) => isCompletedThisQuarter(t, q)).reduce((s, t) => s + t.hours, 0);

  const sorted = [...allotments].sort((a, b) => a.effective_month.localeCompare(b.effective_month));
  let creditsAvailable: number | null = null;
  let monthly: number | null = null;
  if (sorted.length > 0) {
    const thisMonth = monthStart(now);
    const first = sorted[0].effective_month;
    let granted = 0;
    const cursor = new Date(`${first}T00:00:00Z`);
    while (monthStart(cursor) <= thisMonth) {
      granted += allotmentFor(monthStart(cursor), sorted);
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    const spentHours = creditTasks
      .filter((t) => t.state === "complete" && t.completed_at && t.completed_at.slice(0, 10) >= first)
      .reduce((s, t) => s + t.hours, 0);
    creditsAvailable = granted - spentHours * CREDITS_PER_HOUR;
    monthly = allotmentFor(thisMonth, sorted);
  }

  return {
    hours: { required, available, completed },
    credits: {
      required: creditHoursRequired * CREDITS_PER_HOUR,
      available: creditsAvailable,
      used: creditHoursUsed * CREDITS_PER_HOUR,
      monthly,
    },
  };
}
