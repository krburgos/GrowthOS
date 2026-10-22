"use client";

import { CalendarRange, Pencil } from "lucide-react";
import { useState, type ReactNode } from "react";

import { CreditsDialog } from "@/components/growth-mission/credits-dialog";
import { SectionHeading } from "@/components/shell/section-heading";
import { InfoTip } from "@/components/ui/info-tip";
import type { MissionCapacity as Capacity } from "@/lib/growth-mission/capacity";
import { formatWhole, type QuarterInfo } from "@/lib/growth-mission/hours";

/**
 * Mission Capacity (client-confirmed, 2026-10-13, approved mockup "Mission
 * Dashboards" v5), replacing the Workstream hours strip. Hours on one side,
 * credits on the other, three figures each:
 *
 *   Hours   Required · Available · Completed
 *   Credits Required · Available · Used
 *
 * Built the same way as Mission Progress beneath it - a white card on the
 * navy band, quiet label rows, rules drawn by a 1px gap over a tinted
 * ground - so the two read as one system. Each figure is a label and a
 * number only; what it means is in its info tooltip. An amber warning sits
 * beside Available when it falls short of Required.
 *
 * The quarter appears once, on this section's own label line, rather than
 * also as a pill at the top of the page (client-confirmed - it was saying
 * the same thing twice).
 *
 * "band" is the Command Center's single card; "panels" is Headquarters',
 * two white panels matching that page's Mission Progress panels.
 *
 * Type-size classes are concatenated rather than passed through cn(): the
 * project's custom type scale is invisible to tailwind-merge, which would
 * silently drop the size (see the comment on cn() in lib/utils.ts).
 */

const TIPS = {
  hoursRequired: "Hours on mission orders due this quarter, across every discipline.",
  hoursAvailable: "Every team member's weekly hours from the Company Profile, × 13 weeks.",
  hoursCompleted: "Hours on mission orders completed this quarter.",
  // No hourly rate in the app's copy (client-confirmed, 2026-10-22).
  creditsRequired: "Credits for the GrowthMission orders due this quarter. Internal and Outsourced orders use no credits.",
  creditsAvailable: "Credits left to spend: monthly allotments plus anything rolled over, minus credits used.",
  creditsUsed: "Credits for the GrowthMission orders CRO Leader confirmed complete this quarter.",
  creditsUnset: "CRO Leader hasn't set credits for this account yet.",
};

interface Figure {
  /** Full label, used on wide screens and in the tooltip's accessible name. */
  label: string;
  /** Under its Hours / Credits heading the noun is implied, so narrow screens drop it. */
  short: string;
  value: string;
  unit?: string;
  tip: string;
  /** Set when this figure is short of what is required. */
  shortfall?: string;
}

function figures(c: Capacity) {
  const h = c.hours;
  const cr = c.credits;
  // Shortfalls are worked out on the rounded figures, so the tooltip
  // always matches the two numbers shown on screen.
  const r = Math.round;
  const hoursShort = Math.max(0, r(h.required) - r(h.available));
  const creditsShort = cr.available != null ? Math.max(0, r(cr.required) - r(cr.available)) : 0;

  const hours: Figure[] = [
    { label: "Hours required", short: "Required", value: formatWhole(h.required), unit: "hrs", tip: TIPS.hoursRequired },
    {
      label: "Hours available",
      short: "Available",
      value: formatWhole(h.available),
      unit: "hrs",
      tip: TIPS.hoursAvailable,
      shortfall: hoursShort
        ? `${formatWhole(hoursShort)} hours short. This quarter's mission orders need ${formatWhole(h.required)} hours and ${formatWhole(h.available)} are available.`
        : undefined,
    },
    { label: "Hours completed", short: "Completed", value: formatWhole(h.completed), unit: "hrs", tip: TIPS.hoursCompleted },
  ];
  const credits: Figure[] = [
    { label: "Credits required", short: "Required", value: formatWhole(cr.required), tip: TIPS.creditsRequired },
    {
      label: "Credits available",
      short: "Available",
      value: cr.available != null ? formatWhole(cr.available) : "—",
      tip: cr.available != null ? TIPS.creditsAvailable : TIPS.creditsUnset,
      shortfall: creditsShort
        ? `${formatWhole(creditsShort)} credits short. This quarter's mission orders need ${formatWhole(cr.required)} credits and ${formatWhole(cr.available!)} are available.`
        : undefined,
    },
    { label: "Credits used", short: "Used", value: formatWhole(cr.used), tip: TIPS.creditsUsed },
  ];
  return { hours, credits };
}

/**
 * One figure. Its value row has a fixed height so a shortfall icon, which
 * is taller than the unit text beside a number, cannot push one cell's
 * number lower than its neighbours'.
 */
function Cell({ f, size, fullLabel }: { f: Figure; size: "display" | "h1"; fullLabel: boolean }) {
  const valueClass =
    size === "display"
      ? "text-h1 sm:text-display font-bold leading-none tracking-tight tabular-nums text-primary-900"
      : "text-h1 font-bold leading-none tracking-tight tabular-nums text-primary-900";
  return (
    <div className="flex min-w-0 flex-col items-center justify-center gap-1.5 bg-white px-2 pb-5 pt-4 text-center">
      <span className="inline-flex items-center gap-1 text-caption font-semibold uppercase tracking-wide text-neutral-400">
        {fullLabel ? (
          <>
            <span className="sm:hidden">{f.short}</span>
            <span className="hidden sm:inline">{f.label}</span>
          </>
        ) : (
          f.short
        )}
        <InfoTip text={f.tip} label={`About ${f.label}`} />
      </span>
      <span className={`flex items-center gap-1.5 ${size === "display" ? "h-7 sm:h-9" : "h-7"}`}>
        <span className="flex items-baseline gap-1">
          <span className={valueClass}>{f.value}</span>
          {f.unit && <span className="text-body-sm font-medium text-neutral-400">{f.unit}</span>}
        </span>
        {f.shortfall && <InfoTip tone="warning" text={f.shortfall} label={`${f.label}: shortfall`} />}
      </span>
    </div>
  );
}

function QuarterPill({ quarter }: { quarter: QuarterInfo }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/10 px-3 py-1 text-body-sm font-semibold text-white">
      <CalendarRange className="size-4" />
      {quarter.label} · {quarter.range}
    </span>
  );
}

/** Same height whether or not "Set credits" is present, so both halves' rules line up. */
const GROUP_LABEL =
  "flex h-10 items-center gap-2 overflow-hidden border-b border-neutral-300 px-3.5 text-caption font-bold uppercase tracking-wide";

export function MissionCapacity({
  accountId,
  capacity,
  quarter,
  canSetCredits,
  variant,
  focusSlot,
}: {
  accountId: string;
  capacity: Capacity;
  quarter: QuarterInfo;
  canSetCredits: boolean;
  variant: "band" | "panels";
  /** The Command Center's Focus button (section-switcher.tsx); band only. */
  focusSlot?: ReactNode;
}) {
  const [creditsOpen, setCreditsOpen] = useState(false);
  const { hours, credits } = figures(capacity);

  const setCredits = canSetCredits ? (
    <button
      type="button"
      onClick={() => setCreditsOpen(true)}
      className="ml-auto inline-flex items-center gap-1 rounded text-caption font-semibold normal-case tracking-normal text-secondary-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500"
    >
      <Pencil className="size-3.5" />
      Set credits
    </button>
  ) : null;

  return (
    /* The Command Center's version is its own navy section with the same
       SectionHeading as Mission Progress (client-confirmed, 2026-10-13),
       the quarter sitting on its right as a quiet caption the way "Live
       from the CRM" does there. Headquarters keeps the label line and pill
       its Mission Progress label matches. */
    <Wrapper variant={variant}>
      {variant === "band" ? (
        <SectionHeading title="Mission Capacity" tone="dark">
          <span className="inline-flex items-center gap-1 text-caption text-white/55">
            <CalendarRange className="size-3.5" />
            {quarter.label} · {quarter.range}
          </span>
          {focusSlot}
        </SectionHeading>
      ) : (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <p className="text-caption font-semibold uppercase tracking-wide text-white/55">Mission Capacity</p>
          <QuarterPill quarter={quarter} />
        </div>
      )}

      {variant === "band" ? (
        <div className="grid grid-cols-1 overflow-hidden rounded-lg bg-white shadow-raised lg:grid-cols-2">
          <div>
            <div className={`${GROUP_LABEL} text-primary-900`}>
              <span aria-hidden="true" className="h-3.5 w-[3px] shrink-0 rounded-full bg-primary-700" />
              Hours
            </div>
            <div className="grid grid-cols-3 gap-px bg-neutral-300">
              {hours.map((f) => (
                <Cell key={f.label} f={f} size="display" fullLabel />
              ))}
            </div>
          </div>
          <div className="border-t border-neutral-300 lg:border-l lg:border-t-0">
            <div className={`${GROUP_LABEL} text-secondary-800`}>
              <span aria-hidden="true" className="h-3.5 w-[3px] shrink-0 rounded-full bg-secondary-500" />
              Credits
              {setCredits}
            </div>
            <div className="grid grid-cols-3 gap-px bg-neutral-300">
              {credits.map((f) => (
                <Cell key={f.label} f={f} size="display" fullLabel />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {[
            { title: "Hours", figs: hours, action: null },
            { title: "Credits", figs: credits, action: setCredits },
          ].map((p) => (
            <div key={p.title} className="flex flex-col overflow-hidden rounded-lg bg-white shadow-raised">
              <div className="flex h-10 items-center gap-2 border-b border-neutral-100 px-3.5">
                <span aria-hidden="true" className="h-3.5 w-[3px] shrink-0 rounded-full bg-secondary-500" />
                <h3 className="text-body-sm font-semibold text-primary-900">{p.title}</h3>
                {p.action}
              </div>
              <div className="grid flex-1 grid-cols-3 gap-px bg-neutral-100">
                {p.figs.map((f) => (
                  <Cell key={f.label} f={f} size="h1" fullLabel={false} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {canSetCredits && (
        <CreditsDialog accountId={accountId} capacity={capacity} open={creditsOpen} onOpenChange={setCreditsOpen} />
      )}
    </Wrapper>
  );
}

/** The band is a navy section of its own, matching MissionProgress exactly; the panels sit inside a block that already has one. */
function Wrapper({ variant, children }: { variant: "band" | "panels"; children: ReactNode }) {
  // `mission-capacity` is where the top bar's credits pill links to
  // (client-confirmed, 2026-10-14, "Navigation and Credits" B).
  if (variant === "panels") return <div id="mission-capacity" className="scroll-mt-4">{children}</div>;
  return (
    <section
      id="mission-capacity"
      className="flex scroll-mt-4 flex-col gap-3 rounded-xl p-4 shadow-lift md:p-5 bg-[linear-gradient(135deg,var(--color-primary-900),var(--color-primary-700)_60%,var(--color-secondary-800))]"
    >
      {children}
    </section>
  );
}
