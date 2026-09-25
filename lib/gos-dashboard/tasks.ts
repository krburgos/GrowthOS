import type { TeamKind } from "@/lib/team/members";

/**
 * A workstream task — a to-do for a person (client-confirmed, 2026-09-25).
 *
 * Tasks replace the Suggestions & Fixes list rather than sitting beside it:
 * that list was already CRO-authored "here is what to fix" with a priority
 * and a detail line, which is a task without an owner, hours, a state or a
 * due date. The six existing suggestions were migrated across.
 *
 * Who may do what: only CRO Leader creates, edits or archives a task —
 * they prescribe the work. MSP Owner and Admin may change its state and
 * who it is assigned to, because marking work done is not the same as
 * prescribing it, and completing a task moves achieved hours, which those
 * roles already control. A database trigger enforces that split; the UI
 * only mirrors it.
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
