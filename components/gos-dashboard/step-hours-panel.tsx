"use client";

import { Clock } from "lucide-react";
import { useState } from "react";

import { HoursBar, LogHoursDialog, OutsourcedChip } from "@/components/gos-dashboard/log-hours-dialog";
import { useMockup } from "@/components/gos-dashboard/mockup-store";
import { Button } from "@/components/ui/button";
import { SHORT_TITLE, quarterPct } from "@/lib/gos-dashboard/hours-mockup";

export function StepHoursPanel({ slug, canLogHours }: { slug: string; canLogHours: boolean }) {
  const { hours, quarter } = useMockup();
  const [open, setOpen] = useState(false);
  const h = hours[slug];
  const pct = quarterPct(h);
  const title = SHORT_TITLE[slug] ?? slug;
  const remaining = Math.max(0, h.needed - h.achieved);

  return (
    <section className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-5 py-3">
        <h2 className="text-h4 text-primary-900">Hours · {quarter.label}</h2>
        <div className="flex items-center gap-3">
          <OutsourcedChip outsourced={h.outsourced} />
          {canLogHours && (
            <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
              <Clock className="mr-1.5 size-3.5" />
              Log hours
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 divide-neutral-100 sm:grid-cols-4 sm:divide-x">
        {[
          { k: "Hours needed to complete", v: h.needed },
          { k: "Committed this quarter", v: h.committed },
          { k: "Achieved this quarter", v: h.achieved },
          { k: "Still to go (overall)", v: remaining },
        ].map((s) => (
          <div key={s.k} className="flex flex-col gap-0.5 px-5 py-3.5">
            <span className="text-caption text-neutral-500">{s.k}</span>
            <span className="text-h3 font-bold tabular-nums text-primary-900">
              {s.v} <span className="text-body-sm font-medium text-neutral-400">hrs</span>
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

      <LogHoursDialog slug={slug} title={title} open={open} onOpenChange={setOpen} />
    </section>
  );
}
