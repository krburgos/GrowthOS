import { HoursBar } from "@/components/gos-dashboard/hours-ui";
import { formatHours, paceTone, quarterPct, type QuarterInfo, type StepHours } from "@/lib/gos-dashboard/hours";
import { cn } from "@/lib/utils";

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3.5">
      <span className="text-caption font-medium text-neutral-500">{label}</span>
      <span className="text-h3 font-bold tabular-nums text-primary-900">
        {value} <span className="text-body-sm font-medium text-neutral-400">{unit}</span>
      </span>
    </div>
  );
}

/** Sums all 14 workstreams for the current quarter. */
export function HoursTotalsStrip({ hours, quarter }: { hours: StepHours[]; quarter: QuarterInfo }) {
  const needed = hours.reduce((s, h) => s + h.needed, 0);
  const committed = hours.reduce((s, h) => s + h.committed, 0);
  const achieved = hours.reduce((s, h) => s + h.achieved, 0);
  const outsourced = hours.filter((h) => h.outsourced).length;
  const pct = quarterPct({ committed, achieved });
  const tone = paceTone(pct, quarter.elapsedPct);

  return (
    <div className="grid grid-cols-2 rounded-lg border border-neutral-200 bg-white lg:grid-cols-[1fr_1fr_1fr_1fr_1.4fr] lg:divide-x lg:divide-neutral-100">
      <Stat label="Hours needed (all workstreams)" value={formatHours(needed)} unit="hrs" />
      <Stat label="Committed this quarter" value={formatHours(committed)} unit="hrs" />
      <Stat label="Achieved this quarter" value={formatHours(achieved)} unit="hrs" />
      <Stat label="Outsourced" value={String(outsourced)} unit={`of ${hours.length} workstreams`} />
      <div className="col-span-2 flex flex-col justify-center gap-2 border-t border-neutral-100 px-4 py-3.5 lg:col-span-1 lg:border-t-0">
        <div className="flex flex-wrap justify-between gap-1 text-caption text-neutral-500">
          <span>Quarter progress</span>
          <span>
            <b className={cn("font-semibold tabular-nums", tone === "behind" ? "text-warning-800" : "text-neutral-800")}>{pct}%</b>{" "}
            of committed · <span className="tabular-nums">{quarter.elapsedPct}%</span> of quarter elapsed
          </span>
        </div>
        <HoursBar pct={pct} elapsedPct={quarter.elapsedPct} />
      </div>
    </div>
  );
}
