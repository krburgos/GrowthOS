"use client";

import { Check, Lock } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CREDITS_PER_HOUR } from "@/lib/growth-mission/capacity";
import {
  ORDER_TYPE_LABEL,
  PRIORITY_CHIP,
  PRIORITY_LABEL,
  TASK_STATE_LABEL,
  orderType,
  type OrderType,
  type Task,
  type TaskState,
} from "@/lib/growth-mission/tasks";
import { initialsOf } from "@/lib/team/members";

/**
 * The small pieces every Mission Orders surface shares (client-confirmed,
 * 2026-10-14, approved mockup "Mission Orders Design"): the discipline
 * table, the Command Center and Headquarters overviews, and the order panel.
 */

export const STATE_PILL: Record<TaskState, string> = {
  active: "bg-secondary-100 text-secondary-800",
  in_progress: "bg-primary-100 text-primary-600",
  on_hold: "bg-neutral-100 text-neutral-600",
  complete: "bg-success-100 text-success-700",
};

export function StatePill({ state }: { state: TaskState }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-caption font-semibold ${STATE_PILL[state]}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {TASK_STATE_LABEL[state]}
    </span>
  );
}

/** "Must 2" for an open order; the tier alone for a completed one. */
export function PriorityChip({ task, rank }: { task: Task; rank?: number }) {
  const done = task.state === "complete";
  return (
    <span
      className={`inline-flex h-6 min-w-[52px] items-center justify-center whitespace-nowrap rounded-md px-2 text-caption font-bold tabular-nums ${
        done ? "bg-neutral-100 text-neutral-400" : PRIORITY_CHIP[task.priority]
      }`}
    >
      {PRIORITY_LABEL[task.priority]}
      {!done && rank ? ` ${rank}` : ""}
    </span>
  );
}

export function OwnerAvatar({ type, name }: { type: OrderType | null; name?: string }) {
  if (type === "growthmission") {
    return (
      <span className="flex size-[26px] shrink-0 items-center justify-center rounded-md bg-primary-950 text-[9px] font-bold text-secondary-400">
        GM
      </span>
    );
  }
  if (!type || !name) {
    return (
      <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full border border-dashed border-neutral-300 text-caption text-neutral-400">
        ?
      </span>
    );
  }
  return (
    <span
      className={`flex size-[26px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${
        type === "outsourced"
          ? "bg-gradient-to-br from-neutral-500 to-neutral-400"
          : "bg-gradient-to-br from-primary-700 to-secondary-700"
      }`}
    >
      {initialsOf(name)}
    </span>
  );
}

const TYPE_INK: Record<OrderType, string> = {
  internal: "text-neutral-400",
  outsourced: "text-neutral-600",
  growthmission: "font-semibold text-secondary-700",
};

/** Name on top, the order type beneath it. */
export function OwnerCell({ task }: { task: Task }) {
  const type = orderType(task);
  const name = type === "growthmission" ? "GrowthMission" : task.assignee?.name;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <OwnerAvatar type={type} name={name} />
      <span className="flex min-w-0 flex-col">
        <span className={`truncate text-body-sm ${type ? "text-neutral-700" : "text-neutral-400"}`}>
          {name ?? "Unassigned"}
        </span>
        {type && (
          <span className={`text-caption leading-tight ${TYPE_INK[type]}`}>
            {type === "growthmission" ? "Credits" : ORDER_TYPE_LABEL[type]}
          </span>
        )}
      </span>
    </span>
  );
}

export function orderCredits(task: Pick<Task, "hours" | "delegated">): number | null {
  return task.delegated ? task.hours * CREDITS_PER_HOUR : null;
}

/**
 * The completion checkbox. A GrowthMission order spends credits when it is
 * completed, so for anyone but CRO Leader it is dashed and locked, and
 * says why on hover, focus or tap.
 */
export function CompleteBox({
  task,
  canToggle,
  onToggle,
  size = "sm",
}: {
  task: Task;
  canToggle: boolean;
  onToggle: () => void;
  size?: "sm" | "lg";
}) {
  const done = task.state === "complete";
  const box = size === "lg" ? "size-6" : "size-5";

  if (canToggle) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
        className={`flex ${box} shrink-0 items-center justify-center rounded-md border-[1.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40 motion-reduce:transition-none ${
          done ? "border-success-600 bg-success-600 text-white" : "border-neutral-300 bg-white hover:border-secondary-500"
        }`}
      >
        {done && <Check className="size-3" strokeWidth={3} />}
      </button>
    );
  }

  if (task.delegated) {
    const credits = orderCredits(task) ?? 0;
    const text = done
      ? `Completed by GrowthMission. ${credits} credits used.`
      : `GrowthMission marks this order complete when the work is delivered. ${credits} credits are used then.`;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={text}
            onClick={(e) => e.stopPropagation()}
            className={`flex ${box} shrink-0 cursor-help items-center justify-center rounded-md border-[1.5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40 ${
              done ? "border-success-600 bg-success-100 text-success-700" : "border-dashed border-neutral-300 bg-white text-neutral-400"
            }`}
          >
            {done ? <Check className="size-3" strokeWidth={3} /> : <Lock className="size-3" />}
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-60 text-center font-medium">{text}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <span
      aria-label={done ? "Complete" : "Not complete"}
      className={`flex ${box} shrink-0 items-center justify-center rounded-md border-[1.5px] ${
        done ? "border-success-600 bg-success-600 text-white" : "border-neutral-300"
      }`}
    >
      {done && <Check className="size-3" strokeWidth={3} />}
    </span>
  );
}

/** "Dec 31", or null when there is no date. */
export function formatDue(due: string | null): string | null {
  if (!due) return null;
  return new Date(`${due}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function isOverdue(task: Pick<Task, "due_date" | "state">): boolean {
  if (!task.due_date || task.state === "complete") return false;
  return new Date(`${task.due_date}T00:00:00`) < new Date(new Date().toDateString());
}
