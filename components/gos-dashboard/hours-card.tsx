"use client";

import { Clock, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { HoursBar, OutsourcedChip } from "@/components/gos-dashboard/hours-ui";
import { PLAYBOOK_ICON } from "@/components/gos-dashboard/icon-map";
import { LogHoursDialog } from "@/components/gos-dashboard/log-hours-dialog";
import { StatusBadge } from "@/components/gos-dashboard/status-badge";
import { SHORT_TITLE, formatHours, quarterPct, type QuarterInfo, type StepHours } from "@/lib/gos-dashboard/hours";
import type { StepOverview } from "@/lib/gos-dashboard/queries";
import { initialsOf, type TeamMember } from "@/lib/team/members";

/**
 * Client-confirmed (2026-09-17), "B — Ledger": short title + status pill,
 * then Needed · Committed · Achieved side by side, the quarter bar, and the
 * Outsourced label. The whole card links to the step detail page through a
 * stretched link; "Log hours" sits above that layer so it opens the dialog.
 */
export function HoursCard({
  step,
  hours,
  quarter,
  accountId,
  canLogHours,
  assignees,
}: {
  step: StepOverview;
  hours: StepHours;
  quarter: QuarterInfo;
  accountId: string;
  canLogHours: boolean;
  /** Who is responsible for this workstream, from the Company Profile rosters. */
  assignees: { member: TeamMember; hours: number }[];
}) {
  const [open, setOpen] = useState(false);
  const pct = quarterPct(hours);
  const title = SHORT_TITLE[step.slug] ?? step.title;
  const Icon = PLAYBOOK_ICON[step.icon];

  const cells = [
    { key: "Needed", value: hours.needed, highlight: false },
    { key: "Committed", value: hours.committed, highlight: false },
    { key: "Achieved", value: hours.achieved, highlight: true },
  ];

  return (
    <div className="relative flex flex-col gap-3.5 rounded-lg border border-neutral-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-secondary-300 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0">
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
              {formatHours(c.value)}
              <span className="ml-px text-caption font-medium text-neutral-400">h</span>
            </span>
          </div>
        ))}
      </div>

      {/* Client-confirmed (2026-09-24): who is on this workstream, as an
          avatar stack with a count. Deliberately below the hours box and
          labelled in weekly hours, because the three figures above are
          quarterly - 8h/wk must not read as part of 120 hrs needed. */}
      <div className="border-t border-neutral-100 pt-3">
        <p className="mb-2 text-caption font-bold uppercase tracking-wide text-neutral-400">Assigned</p>
        {assignees.length === 0 ? (
          <p className="text-caption text-neutral-400">Nobody assigned yet</p>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="flex items-center">
              {assignees.slice(0, 4).map(({ member }, i) => (
                <span
                  key={member.id}
                  title={member.name}
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
            <span className="text-caption text-neutral-500">
              {assignees.length} {assignees.length === 1 ? "person" : "people"} ·{" "}
              {assignees.reduce((sum, a) => sum + a.hours, 0)}h/wk
            </span>
          </div>
        )}
      </div>

      {step.budgetNote && (
        <div className="flex items-center gap-1.5 rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-2.5 py-1.5 text-caption text-neutral-600">
          <Wallet className="size-3.5 shrink-0 text-neutral-500" />
          {step.budgetNote}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2">
        <HoursBar pct={pct} elapsedPct={quarter.elapsedPct} />
        <div className="flex items-center justify-between gap-2 text-caption text-neutral-500">
          <span className="tabular-nums">
            {hours.committed > 0 ? `${pct}% of this quarter's commitment` : "No hours committed this quarter"}
          </span>
          <OutsourcedChip outsourced={hours.outsourced} />
        </div>
        {canLogHours && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="relative z-10 -mb-1 inline-flex items-center gap-1.5 self-start rounded-md px-1.5 py-1 text-body-sm font-semibold text-secondary-700 hover:bg-secondary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500/40"
          >
            <Clock className="size-3.5" />
            Log hours
          </button>
        )}
      </div>

      {canLogHours && (
        <LogHoursDialog
          accountId={accountId}
          slug={step.slug}
          title={title}
          hours={hours}
          quarter={quarter}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </div>
  );
}
