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

/** Tailwind classes per state — one place, so the card and the list agree. */
export const TASK_STATE_CLASS: Record<TaskState, string> = {
  active: "bg-secondary-100 text-secondary-800",
  in_progress: "bg-primary-100 text-primary-700",
  on_hold: "bg-neutral-100 text-neutral-500",
  complete: "bg-success-100 text-success-700",
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
 * Rows are grouped by priority rather than by state, so "what to do next"
 * reads top to bottom. State is a column, which keeps it changeable in
 * place without moving the row out from under the pointer.
 */
export const TASK_PRIORITY_GROUPS: {
  value: TaskPriority;
  label: string;
  bar: string;
  text: string;
}[] = [
  { value: "high", label: "High priority", bar: "border-l-error-500", text: "text-error-700" },
  { value: "medium", label: "Medium priority", bar: "border-l-warning-400", text: "text-warning-800" },
  { value: "low", label: "Low priority", bar: "border-l-neutral-300", text: "text-neutral-600" },
];

export const TASK_PRIORITY_CLASS: Record<TaskPriority, string> = {
  high: "bg-error-100 text-error-700",
  medium: "bg-warning-100 text-warning-800",
  low: "bg-neutral-100 text-neutral-500",
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
  assignee: { id: string; name: string; kind: TeamKind } | null;
}

/** What the Mission Card shows: progress, and whether anything is unowned. */
export function taskSummary(tasks: Task[]) {
  const done = tasks.filter((t) => t.state === "complete").length;
  return {
    total: tasks.length,
    done,
    open: tasks.length - done,
    unassigned: tasks.filter((t) => t.state !== "complete" && !t.assignee).length,
    hours: tasks.reduce((sum, t) => sum + t.hours, 0),
  };
}
