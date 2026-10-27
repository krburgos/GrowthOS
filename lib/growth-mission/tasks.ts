import type { TeamKind } from "@/lib/team/members";

/**
 * A workstream task — a to-do for a person (client-confirmed, 2026-09-25).
 *
 * Tasks replace the Suggestions & Fixes list rather than sitting beside it:
 * that list was already CRO-authored "here is what to fix" with a priority
 * and a detail line, which is a task without an owner, hours, a state or a
 * due date. The six existing suggestions were migrated across.
 *
 * Who may do what (client-confirmed, 2026-09-25, after three widenings on
 * the same day — hours, then the due date, then authorship): CRO Leader and
 * the account's own MSP Owner and Admin can all add, edit, assign and
 * retire tasks. CRO Leader still prescribes the work as a service, but the
 * account can add what it finds itself and correct what is written down.
 * Every other role reads only.
 *
 * This is now enforced by RLS alone. The prevent_task_definition_change
 * trigger that used to confine Owner/Admin to state and assignee has been
 * dropped, because with those roles holding full authorship — and no other
 * role able to update at all — it guarded nothing, and a trigger that
 * always returns NEW reads like a control that is still in force.
 *
 * The Status Report is a separate question and stays CRO-authored.
 *
 * Completing a task adds its hours to the workstream's achieved hours for
 * the quarter it was completed in, and re-opening subtracts them again. That
 * arithmetic lives in a trigger rather than here so the two can never drift.
 */

export type TaskState = "active" | "in_progress" | "on_hold" | "complete";
export type TaskPriority = "high" | "medium" | "low";

export const TASK_STATES: { value: TaskState; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "in_progress", label: "In progress" },
  { value: "on_hold", label: "On hold" },
  { value: "complete", label: "Complete" },
];

export const TASK_STATE_LABEL: Record<TaskState, string> = {
  active: "Active",
  in_progress: "In progress",
  on_hold: "On hold",
  complete: "Complete",
};


/**
 * The board's status cell fills its whole width in colour, which is the
 * thing that makes a Monday board read as a Monday board at a glance.
 * Solid backgrounds, so the text on them is white.
 */
export const TASK_STATE_CELL: Record<TaskState, string> = {
  active: "bg-secondary-500",
  in_progress: "bg-primary-500",
  on_hold: "bg-neutral-400",
  complete: "bg-success-600",
};

/**
 * ABC-123 priority, labelled Must / Should / Could (client-confirmed,
 * 2026-10-14). The stored enum stays high / medium / low, which
 * growth_mission_suggestions shares; only the words changed.
 */
export const PRIORITIES: TaskPriority[] = ["high", "medium", "low"];

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: "Must",
  medium: "Should",
  low: "Could",
};

/** The group heading's description, beside the tier name. */
export const PRIORITY_MEANING: Record<TaskPriority, string> = {
  high: "Needed to hit the goal",
  medium: "Important, not critical",
  low: "If there's room",
};

/** The priority chip: tinted ground, darker ink, one per tier. */
export const PRIORITY_CHIP: Record<TaskPriority, string> = {
  high: "bg-error-100 text-error-700",
  medium: "bg-warning-100 text-warning-800",
  low: "bg-neutral-100 text-neutral-600",
};

/**
 * Who gets an order done (client-confirmed, 2026-10-14). Only GrowthMission
 * is stored (`delegated`); Internal and Outsourced are the assignee's
 * roster kind, so an order can never disagree with the person it names.
 */
export type OrderType = "internal" | "outsourced" | "growthmission";

export const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  internal: "Internal",
  outsourced: "Outsourced",
  growthmission: "GrowthMission",
};

export interface Task {
  id: string;
  step_slug: string;
  title: string;
  detail: string | null;
  priority: TaskPriority;
  state: TaskState;
  hours: number;
  due_date: string | null;
  /** Stamped when the task first reached 'complete'; null otherwise. */
  completed_at: string | null;
  /** Delegated to GrowthMission (CRO Leader) for credits. Never has an assignee. */
  delegated: boolean;
  /** Position within its discipline and priority; the number is derived from it. */
  sort_order: number;
  created_at: string;
  assignee: { id: string; name: string; kind: TeamKind } | null;
}

/** Null when nobody owns the order yet. */
export function orderType(task: Pick<Task, "delegated" | "assignee">): OrderType | null {
  if (task.delegated) return "growthmission";
  if (!task.assignee) return null;
  return task.assignee.kind === "outsourced" ? "outsourced" : "internal";
}

/**
 * Who may tick an order complete or reopen it. A GrowthMission order spends
 * credits on completion, so only CRO Leader may (the database's
 * guard_growthmission_orders() trigger enforces the same rule).
 */
export function canToggleComplete(task: Pick<Task, "delegated">, perms: { canEdit: boolean; isCroLeader: boolean }) {
  return perms.canEdit && (!task.delegated || perms.isCroLeader);
}

/**
 * The number in "Must 2": each open order's position among the open orders
 * in the same discipline and tier, by sort_order and then age. Computed
 * rather than stored, so it can never duplicate or skip. Completed orders
 * get no number.
 */
export function rankOrders<T extends RankFields>(tasks: T[]): Map<string, number> {
  const groups = new Map<string, T[]>();
  for (const t of tasks) {
    if (t.state === "complete") continue;
    const key = `${t.step_slug}|${t.priority}`;
    const g = groups.get(key);
    if (g) g.push(t);
    else groups.set(key, [t]);
  }
  const rank = new Map<string, number>();
  for (const g of groups.values()) {
    g.sort(byPosition).forEach((t, i) => rank.set(t.id, i + 1));
  }
  return rank;
}

type RankFields = Pick<Task, "id" | "step_slug" | "priority" | "state" | "sort_order" | "created_at">;

/** Position order within one discipline and tier. */
export function byPosition(a: RankFields, b: RankFields) {
  return a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
}

/** What the Mission Card shows: progress, and whether anything is unowned. */
export function taskSummary(tasks: Task[]) {
  const done = tasks.filter((t) => t.state === "complete").length;
  return {
    total: tasks.length,
    done,
    open: tasks.length - done,
    unassigned: tasks.filter((t) => t.state !== "complete" && orderType(t) === null).length,
    hours: tasks.reduce((sum, t) => sum + t.hours, 0),
  };
}
