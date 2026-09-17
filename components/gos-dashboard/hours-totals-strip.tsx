import { HoursBar } from "@/components/gos-dashboard/hours-ui";
import { formatHours, paceTone, quarterPct, type QuarterInfo, type StepHours } from "@/lib/gos-dashboard/hours";
import { cn } from "@/lib/utils";

function Stat({ label, value, unit, hero }: { label: string; value: string; unit: string; hero: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3.5">
      <span className={cn("text-caption font-medium", hero ? "text-white/70" : "text-neutral-500")}>{label}</span>
      <span className={cn("text-h3 font-bold tabular-nums", hero ? "text-white" : "text-primary-900")}>
        {value} <span className={cn("text-body-sm font-medium", hero ? "text-white/60" : "text-neutral-400")}>{unit}</span>
      </span>
    </div>
  );
}

/**
 * Sums all 14 workstreams for the current quarter. The "hero" variant
 * (client-confirmed 2026-09-17, "Concept B") renders translucently inside
 * the page's navy-to-teal HeroBand instead of on its own white card.
 */
export function HoursTotalsStrip({
  hours,
  quarter,
  variant = "card",
}: {
  hours: StepHours[];
  quarter: QuarterInfo;
  variant?: "card" | "hero";
}) {
  const hero = variant === "hero";
  const needed = hours.reduce((s, h) => s + h.needed, 0);
  const committed = hours.reduce((s, h) => s + h.committed, 0);
  const achieved = hours.reduce((s, h) => s + h.achieved, 0);
  const outsourced = hours.filter((h) => h.outsourced).length;
  const pct = quarterPct({ committed, achieved });
  const tone = paceTone(pct, quarter.elapsedPct);

  return (
    <div
      className={cn(
        "grid grid-cols-2 rounded-lg border lg:grid-cols-[1fr_1fr_1fr_1fr_1.4fr] lg:divide-x",
        hero ? "border-white/15 bg-white/10 lg:divide-white/15" : "border-neutral-200 bg-white lg:divide-neutral-100"
      )}
    >
      <Stat label="Hours needed (all workstreams)" value={formatHours(needed)} unit="hrs" hero={hero} />
      <Stat label="Committed this quarter" value={formatHours(committed)} unit="hrs" hero={hero} />
      <Stat label="Achieved this quarter" value={formatHours(achieved)} unit="hrs" hero={hero} />
      <Stat label="Outsourced" value={String(outsourced)} unit={`of ${hours.length} workstreams`} hero={hero} />
      <div
        className={cn(
          "col-span-2 flex flex-col justify-center gap-2 border-t px-4 py-3.5 lg:col-span-1 lg:border-t-0",
          hero ? "border-white/15" : "border-neutral-100"
        )}
      >
        <div className={cn("flex flex-wrap justify-between gap-1 text-caption", hero ? "text-white/70" : "text-neutral-500")}>
          <span>Quarter progress</span>
          <span>
            <b
              className={cn(
                "font-semibold tabular-nums",
                tone === "behind" ? (hero ? "text-warning-400" : "text-warning-800") : hero ? "text-white" : "text-neutral-800"
              )}
            >
              {pct}%
            </b>{" "}
            of committed · <span className="tabular-nums">{quarter.elapsedPct}%</span> of quarter elapsed
          </span>
        </div>
        <HoursBar pct={pct} elapsedPct={quarter.elapsedPct} className={hero ? "bg-white/20" : undefined} />
      </div>
    </div>
  );
}
