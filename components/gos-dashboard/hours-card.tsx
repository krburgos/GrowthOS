"use client";

import { Clock, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PLAYBOOK_ICON } from "@/components/gos-dashboard/icon-map";
import { HoursBar, LogHoursDialog, OutsourcedChip } from "@/components/gos-dashboard/log-hours-dialog";
import { useMockup } from "@/components/gos-dashboard/mockup-store";
import { StatusBadge } from "@/components/gos-dashboard/status-badge";
import { SHORT_TITLE, quarterPct } from "@/lib/gos-dashboard/hours-mockup";
import type { PlaybookStep } from "@/lib/gos-dashboard/playbook";

/**
 * Branch-only mockup card. The whole card links to the step's detail page
 * via a stretched link; "Log hours" sits above that link layer so it opens
 * the dialog instead of navigating.
 */
export function HoursCard({ step, canLogHours }: { step: PlaybookStep; canLogHours: boolean }) {
  const { hours, cardStyle, quarter } = useMockup();
  const [open, setOpen] = useState(false);
  const h = hours[step.slug];
  const pct = quarterPct(h);
  const title = SHORT_TITLE[step.slug] ?? step.title;
  const Icon = PLAYBOOK_ICON[step.icon];

  return (
    <div className="group relative flex flex-col gap-3.5 rounded-lg border border-neutral-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-secondary-300 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0">
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

      {cardStyle === "stack" ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-h3 font-bold leading-none tabular-nums text-primary-900">
              {h.achieved} <span className="text-body-sm font-medium text-neutral-400">/ {h.committed} hrs</span>
            </span>
            <span className="text-caption font-semibold tabular-nums text-neutral-600">{pct}%</span>
          </div>
          <HoursBar pct={pct} elapsedPct={quarter.elapsedPct} />
          <span className="text-caption text-neutral-400">Achieved of committed this quarter</span>
        </div>
      ) : (
        <div className="grid grid-cols-3 overflow-hidden rounded-md border border-neutral-100">
          {[
            { k: "Needed", v: h.needed },
            { k: "Committed", v: h.committed },
            { k: "Achieved", v: h.achieved, hl: true },
          ].map((c, i) => (
            <div key={c.k} className={`flex flex-col px-2.5 py-2 ${i > 0 ? "border-l border-neutral-100" : ""} ${c.hl ? "bg-secondary-50" : ""}`}>
              <span className="text-[10.5px] font-semibold uppercase tracking-wide text-neutral-400">{c.k}</span>
              <span className="text-h4 font-bold tabular-nums text-primary-900">
                {c.v}
                <span className="ml-px text-caption font-medium text-neutral-400">h</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {step.budgetNote && (
        <div className="flex items-center gap-1.5 rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-2.5 py-1.5 text-caption text-neutral-600">
          <Wallet className="size-3.5 shrink-0 text-neutral-500" />
          {step.budgetNote}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2 border-t border-neutral-100 pt-3">
        {cardStyle === "stack" ? (
          <>
            <div className="flex items-center justify-between gap-2 text-body-sm">
              <span className="text-neutral-500">Hours needed to complete</span>
              <span className="font-semibold tabular-nums text-neutral-800">{h.needed} hrs</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-body-sm">
              <span className="text-neutral-500">Outsourced</span>
              <OutsourcedChip outsourced={h.outsourced} />
            </div>
          </>
        ) : (
          <>
            <HoursBar pct={pct} elapsedPct={quarter.elapsedPct} />
            <div className="flex items-center justify-between gap-2 text-caption text-neutral-500">
              <span className="tabular-nums">{pct}% of this quarter&apos;s commitment</span>
              <OutsourcedChip outsourced={h.outsourced} />
            </div>
          </>
        )}
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

      <LogHoursDialog slug={step.slug} title={title} open={open} onOpenChange={setOpen} />
    </div>
  );
}
