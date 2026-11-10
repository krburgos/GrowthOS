"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";

import { PLAYBOOK_ICON } from "@/components/growth-mission/icon-map";
import { StatusBadge } from "@/components/growth-mission/status-badge";
import { autoStatus } from "@/lib/growth-mission/auto-status";
import { SHORT_TITLE, formatWhole, type StepHours } from "@/lib/growth-mission/hours";
import type { StepOverview } from "@/lib/growth-mission/queries";
import { taskSummary, type Task } from "@/lib/growth-mission/tasks";

/**
 * A Mission Card on the Command Center.
 *
 * History: "B — Ledger" (2026-09-17), Required · Committed · Completed
 * (2026-10-13), kept as small as possible (2026-10-13).
 *
 * Proposal (2026-11-10, UX audit, branch ux/headquarters-today — awaiting
 * approval, not on main): compact. Title and status, one figure ("12 of
 * 34 h done") with its bar, and the one thing that needs somebody: overdue
 * orders, else unassigned ones, else how many are open. The status is
 * worked out from hours done against the quarter elapsed (auto-status.ts).
 * Committed hours and the people stay on the card's own page.
 */
export function HoursCard({
  step,
  hours,
  tasks,
  dropbys,
  elapsedPct,
}: {
  step: StepOverview;
  hours: StepHours;
  /** This workstream's tasks, summarised on the card. */
  tasks: Task[];
  /** AdvocateDash only (2026-10-05): measured in drop-bys rather than hours. */
  dropbys?: { targets: number; scheduled: number; completed: number; awaitingReport: number };
  /** Share of the current quarter gone, for the automatic status. */
  elapsedPct: number;
}) {
  const title = SHORT_TITLE[step.slug] ?? step.title;
  const Icon = PLAYBOOK_ICON[step.icon];
  const t = taskSummary(tasks);
  const today = new Date().toISOString().slice(0, 10);
  const overdue = tasks.filter((x) => x.state !== "complete" && x.due_date !== null && x.due_date < today).length;

  const target = dropbys ? dropbys.targets : hours.required;
  const done = dropbys ? dropbys.completed : hours.completed;
  const status = autoStatus(target, done, elapsedPct, step.status);
  const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;

  return (
    <div className="relative flex flex-col gap-3 rounded-lg bg-white p-4 shadow-raised transition-all hover:-translate-y-0.5 hover:shadow-xl motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
          <Icon className="size-[18px]" />
        </span>
        <h3 className="min-w-0 flex-1 text-body font-semibold leading-snug text-primary-900">
          <Link
            href={`/growth-mission/${step.slug}`}
            className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-secondary-500"
          >
            {title}
          </Link>
        </h3>
        <StatusBadge status={status} />
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-body-sm text-neutral-600">
          <b className="font-bold tabular-nums text-primary-900">
            {dropbys ? done : formatWhole(done)} of {dropbys ? target : `${formatWhole(target)} h`}
          </b>{" "}
          {dropbys ? "drop-bys done" : "done"}
        </p>
        <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-secondary-600 transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex min-h-6 items-center">
        {dropbys ? (
          dropbys.awaitingReport > 0 ? (
            <Flag tone="amber">{dropbys.awaitingReport} awaiting a report</Flag>
          ) : (
            <span className="text-caption text-neutral-500">{dropbys.scheduled} scheduled</span>
          )
        ) : overdue > 0 ? (
          <Flag tone="red">{overdue} overdue</Flag>
        ) : t.unassigned > 0 ? (
          <Flag tone="amber">{t.unassigned} unassigned</Flag>
        ) : t.total === 0 ? (
          <span className="text-caption text-neutral-400">No mission orders yet</span>
        ) : (
          <span className="text-caption tabular-nums text-neutral-500">
            {t.open} open · {t.done} of {t.total} done
          </span>
        )}
      </div>
    </div>
  );
}

function Flag({ tone, children }: { tone: "red" | "amber"; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-semibold ${
        tone === "red" ? "bg-error-100 text-error-700" : "bg-warning-100 text-warning-800"
      }`}
    >
      <CircleAlert className="size-3" />
      {children}
    </span>
  );
}
