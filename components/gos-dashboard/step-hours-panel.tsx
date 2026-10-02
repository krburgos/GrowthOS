"use client";

import { Clock } from "lucide-react";
import { useState, type ReactNode } from "react";

import { HoursBar, OutsourcedChip } from "@/components/gos-dashboard/hours-ui";
import { LogHoursDialog } from "@/components/gos-dashboard/log-hours-dialog";
import { Button } from "@/components/ui/button";
import { SHORT_TITLE, formatHours, quarterPct, type QuarterInfo, type StepHours } from "@/lib/gos-dashboard/hours";

export function StepHoursPanel({
  accountId,
  slug,
  hours,
  quarter,
  canLogHours,
  reportSlot,
}: {
  accountId: string;
  slug: string;
  hours: StepHours;
  quarter: QuarterInfo;
  canLogHours: boolean;
  /**
   * The workstream's report, rendered on this panel's header line
   * (client-confirmed, 2026-10-02). It had its own full-width card, which
   * spent a whole row of the page on one filename. Passed in as a slot
   * rather than imported here so this panel stays a presentation component,
   * the same way StepHeader takes its overview slot.
   */
  reportSlot?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pct = quarterPct(hours);
  const title = SHORT_TITLE[slug] ?? slug;

  const stats = [
    { label: "Hours needed to complete", value: hours.needed },
    { label: "Committed this quarter", value: hours.committed },
    { label: "Achieved this quarter", value: hours.achieved },
    { label: "Still to go overall", value: Math.max(0, hours.needed - hours.achieved) },
  ];

  return (
    <section className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-100 px-5 py-3">
        <h2 className="shrink-0 text-h4 text-primary-900">
          Hours <span className="font-normal text-neutral-400">· {quarter.label}</span>
        </h2>
        {/* The report sits between the title and the actions, so one line
            carries everything about this workstream that is not a number. */}
        {reportSlot}
        <div className="ml-auto flex items-center gap-3">
          <OutsourcedChip outsourced={hours.outsourced} />
          {canLogHours && (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Clock className="mr-1.5 size-3.5" />
              Log hours
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 sm:divide-x sm:divide-neutral-100">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-0.5 px-5 py-3.5">
            <span className="text-caption text-neutral-500">{s.label}</span>
            <span className="text-h3 font-bold tabular-nums text-primary-900">
              {formatHours(s.value)} <span className="text-body-sm font-medium text-neutral-400">hrs</span>
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-neutral-100 px-5 py-3.5">
        <div className="flex flex-wrap justify-between gap-1 text-caption text-neutral-500">
          <span>
            <b className="font-semibold tabular-nums text-neutral-800">{pct}%</b> of this quarter&apos;s commitment
          </span>
          <span className="tabular-nums">{quarter.elapsedPct}% of the quarter elapsed</span>
        </div>
        <HoursBar pct={pct} elapsedPct={quarter.elapsedPct} />
      </div>

      {canLogHours && (
        <LogHoursDialog
          accountId={accountId}
          slug={slug}
          title={title}
          hours={hours}
          quarter={quarter}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </section>
  );
}
