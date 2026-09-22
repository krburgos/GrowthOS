import { HoursBar } from "@/components/gos-dashboard/hours-ui";
import { formatHours, paceTone, quarterPct, type QuarterInfo, type StepHours } from "@/lib/gos-dashboard/hours";
import { cn } from "@/lib/utils";

/**
 * Note every class string here that pairs a type size with a colour is
 * concatenated rather than passed through cn(). The project's type scale
 * uses custom names, which tailwind-merge does not recognise as font sizes,
 * so cn("text-h1 …", "text-white") silently drops the size — which is what
 * had these figures rendering at inherited body size despite being written
 * as text-h3. See the comment on cn() in lib/utils.ts.
 */
const labelClass = (hero: boolean) =>
  `text-caption font-semibold uppercase tracking-wide ${hero ? "text-white/55" : "text-neutral-400"}`;

const unitClass = (hero: boolean) => `text-body-sm font-medium ${hero ? "text-white/60" : "text-neutral-400"}`;

function Stat({ label, value, unit, hero }: { label: string; value: string; unit: string; hero: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 px-4 py-4">
      <span className={labelClass(hero)}>{label}</span>
      <span className="flex items-baseline gap-1.5">
        <span
          className={`text-h1 font-bold leading-none tracking-tight tabular-nums ${hero ? "text-white" : "text-primary-900"}`}
        >
          {value}
        </span>
        <span className={unitClass(hero)}>{unit}</span>
      </span>
    </div>
  );
}

/**
 * Sums all 14 workstreams for the current quarter. The "hero" variant
 * (client-confirmed 2026-09-17, "Concept B") renders translucently inside
 * the page's navy-to-teal HeroBand instead of on its own white card.
 *
 * Client-confirmed (2026-09-22): the figures are the point of the strip, so
 * they are set at h1 with the label reduced to a quiet cap above them, and
 * quarter progress becomes a figure of the same weight as the other four
 * rather than a percentage buried in a sentence.
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

  const pctColor =
    tone === "behind" ? (hero ? "text-warning-400" : "text-warning-800") : hero ? "text-white" : "text-primary-900";

  return (
    <div
      className={cn(
        "grid grid-cols-2 rounded-lg border lg:grid-cols-[1fr_1fr_1fr_1fr_1.4fr] lg:divide-x",
        hero ? "border-white/15 bg-white/10 lg:divide-white/15" : "border-neutral-200 bg-white lg:divide-neutral-100"
      )}
    >
      <Stat label="Hours required" value={formatHours(needed)} unit="hrs" hero={hero} />
      <Stat label="Committed this quarter" value={formatHours(committed)} unit="hrs" hero={hero} />
      <Stat label="Achieved this quarter" value={formatHours(achieved)} unit="hrs" hero={hero} />
      <Stat label="Outsourced" value={String(outsourced)} unit={`of ${hours.length}`} hero={hero} />
      <div
        className={cn(
          "col-span-2 flex flex-col justify-center gap-1.5 border-t px-4 py-4 lg:col-span-1 lg:border-t-0",
          hero ? "border-white/15" : "border-neutral-100"
        )}
      >
        <span className={labelClass(hero)}>Quarter progress</span>
        <span className="flex items-baseline gap-1.5">
          <span className={`text-h1 font-bold leading-none tracking-tight tabular-nums ${pctColor}`}>{pct}%</span>
          <span className={unitClass(hero)}>of committed</span>
        </span>
        <HoursBar pct={pct} elapsedPct={quarter.elapsedPct} className={hero ? "bg-white/20" : undefined} />
        <span className={`text-caption tabular-nums ${hero ? "text-white/55" : "text-neutral-400"}`}>
          {quarter.elapsedPct}% of the quarter elapsed
        </span>
      </div>
    </div>
  );
}
