"use client";

import { CircleAlert, Wallet } from "lucide-react";
import Link from "next/link";

import { OutsourcedChip } from "@/components/gos-dashboard/hours-ui";
import { PLAYBOOK_ICON } from "@/components/gos-dashboard/icon-map";
import { StatusBadge } from "@/components/gos-dashboard/status-badge";
import { SHORT_TITLE, formatHours, type StepHours } from "@/lib/gos-dashboard/hours";
import type { StepOverview } from "@/lib/gos-dashboard/queries";
import { taskSummary, type Task } from "@/lib/gos-dashboard/tasks";
import { initialsOf, type TeamMember } from "@/lib/team/members";

/**
 * Client-confirmed (2026-09-17), "B — Ledger": short title + status pill,
 * then Needed · Committed · Achieved side by side, and the Outsourced
 * label. The quarter bar and Log hours left on 2026-10-05 (client-
 * confirmed): the bar measured achieved against committed, so with no
 * commitment recorded it read empty under a caption saying exactly that,
 * on every card. Logging hours stays on the workstream page. The whole card links to the step detail page through a
 * stretched link; "Log hours" sits above that layer so it opens the dialog.
 */
export function HoursCard({
  step,
  hours,
  assignees,
  tasks,
  dropbys,
}: {
  step: StepOverview;
  hours: StepHours;
  /**
   * Who is on this workstream: people declared against it in the Company
   * Profile, plus anyone simply holding tasks in it (client-confirmed fix,
   * 2026-09-25 — reading only the declared list made every card say
   * "Nobody assigned" while the tasks all had owners).
   */
  assignees: { member: TeamMember; hours: number; declared: boolean }[];
  /** This workstream's tasks, summarised on the card. */
  tasks: Task[];
  /**
   * AdvocateDash only (client-confirmed, 2026-10-05). That workstream is
   * measured in drop-bys rather than hours, so when this is present the
   * card counts targets instead of showing the hours triad and the task
   * progress. Absent on the other fifteen, which are unchanged.
   */
  dropbys?: { targets: number; scheduled: number; completed: number; awaitingReport: number };
}) {
  const title = SHORT_TITLE[step.slug] ?? step.title;
  const Icon = PLAYBOOK_ICON[step.icon];

  const t = taskSummary(tasks);

  // The progress line counts whichever unit this workstream runs on.
  const total = dropbys ? dropbys.targets : t.total;
  const done = dropbys ? dropbys.completed : t.done;

  const cells = dropbys
    ? [
        { key: "Targets", value: dropbys.targets, highlight: false },
        { key: "Scheduled", value: dropbys.scheduled, highlight: false },
        { key: "Completed", value: dropbys.completed, highlight: true },
      ]
    : [
        { key: "Needed", value: hours.needed, highlight: false },
        { key: "Committed", value: hours.committed, highlight: false },
        { key: "Achieved", value: hours.achieved, highlight: true },
      ];

  return (
    /* Client-confirmed (2026-10-01): the card now sits on a navy panel, so
       it drops its border — white against navy is already a hard edge, and
       the old hover-border-cyan cue is invisible without one. Depth and the
       hover cue both come from shadow instead. */
    <div className="relative flex flex-col gap-3.5 rounded-lg bg-white p-4 shadow-raised transition-all hover:-translate-y-0.5 hover:shadow-xl motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
          <Icon className="size-[18px]" />
        </span>
        <h3 className="min-w-0 flex-1 text-body font-semibold leading-snug text-primary-900">
          <Link
            href={`/gos-dashboard/${step.slug}`}
            className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-secondary-500"
          >
            {title}
          </Link>
        </h3>
        <StatusBadge status={step.status} />
      </div>

      <div className="grid grid-cols-3 overflow-hidden rounded-md border border-neutral-100">
        {cells.map((c, i) => (
          <div
            key={c.key}
            className={`flex flex-col items-center px-2.5 py-2 text-center ${i > 0 ? "border-l border-neutral-100" : ""} ${c.highlight ? "bg-secondary-50" : ""}`}
          >
            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-neutral-400">{c.key}</span>
            <span className="text-h4 font-bold tabular-nums text-primary-900">
              {dropbys ? c.value : formatHours(c.value)}
              {/* No unit on a count of visits — "12h" would be a lie. */}
              {!dropbys && <span className="ml-px text-caption font-medium text-neutral-400">h</span>}
            </span>
          </div>
        ))}
      </div>

      {/* Client-confirmed (2026-09-25): the card stays a summary. It answers
          "is anything happening on this workstream, and who has it" - the
          tasks themselves live on the step page, one click away. */}
      <div className="border-t border-neutral-100 pt-3">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p className="text-caption font-bold uppercase tracking-wide text-neutral-400">
            {dropbys ? "Drop-bys" : "Tasks"}
          </p>
          {total > 0 && (
            <p className="text-caption font-semibold tabular-nums text-primary-900">
              {done} of {total} done
            </p>
          )}
        </div>

        {total === 0 ? (
          <p className="text-caption text-neutral-400">{dropbys ? "No targets yet" : "No tasks yet"}</p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-secondary-600 transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: `${Math.round((done / total) * 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              {assignees.length === 0 ? (
                <span className="text-caption text-neutral-400">Nobody assigned</span>
              ) : (
                <div className="flex items-center">
                  {assignees.slice(0, 4).map(({ member, declared }, i) => (
                    <span
                      key={member.id}
                      title={
                        declared
                          ? member.name
                          : `${member.name} — has ${dropbys ? "drop-bys" : "tasks"} here, not assigned in the Company Profile`
                      }
                      className={`flex size-6 items-center justify-center rounded-full border-2 border-white text-[9px] font-bold text-white ${
                        member.kind === "outsourced"
                          ? "bg-gradient-to-br from-neutral-500 to-neutral-400"
                          : "bg-gradient-to-br from-primary-700 to-secondary-700"
                      } ${i > 0 ? "-ml-1.5" : ""}`}
                    >
                      {initialsOf(member.name)}
                    </span>
                  ))}
                  {assignees.length > 4 && (
                    <span className="-ml-1.5 flex size-6 items-center justify-center rounded-full border-2 border-white bg-neutral-200 text-[9px] font-bold text-neutral-600">
                      +{assignees.length - 4}
                    </span>
                  )}
                </div>
              )}
              {/* The one thing on the card that needs somebody to act. For
                  AdvocateDash that is a visit made but never written up —
                  the report is the deliverable, so an unfiled one is the
                  gap worth flagging, not an estimate of hours left. */}
              {dropbys ? (
                dropbys.awaitingReport > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning-100 px-2 py-0.5 text-caption font-semibold text-warning-800">
                    <CircleAlert className="size-3" />
                    {dropbys.awaitingReport} awaiting a report
                  </span>
                )
              ) : t.unassigned > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-warning-100 px-2 py-0.5 text-caption font-semibold text-warning-800">
                  <CircleAlert className="size-3" />
                  {t.unassigned} unassigned
                </span>
              ) : (
                t.open > 0 && (
                  <span className="text-caption tabular-nums text-neutral-500">
                    {formatHours(t.hours)}h of work
                  </span>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {step.budgetNote && (
        <div className="flex items-center gap-1.5 rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-2.5 py-1.5 text-caption text-neutral-600">
          <Wallet className="size-3.5 shrink-0 text-neutral-500" />
          {step.budgetNote}
        </div>
      )}

      <div className="mt-auto flex items-center justify-end">
        <OutsourcedChip outsourced={hours.outsourced} />
      </div>
    </div>
  );
}
