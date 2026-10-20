"use client";

import { Radio } from "lucide-react";
import { useState, type ReactNode } from "react";

import { RecordsDialog } from "@/components/growth-mission/kpi-records-dialog";
import { SectionHeading } from "@/components/shell/section-heading";
import { CountUp } from "@/components/ui/count-up";
import { InfoTip } from "@/components/ui/info-tip";
import { KPI_BOXES, boxTotal, type KpiBox, type KpiSource } from "@/lib/growth-mission/kpi-band";

/**
 * Mission Progress (client-confirmed, 2026-10-13), formerly the
 * "GrowthMission KPI Dashboard" band on the Command Center and the "KPI
 * Dashboard" panels on Headquarters. Both now render from this one file,
 * so the boxes and their rules cannot drift apart between the two pages.
 *
 * What changed from the KPI band:
 * - Opportunities is Total (labelled "Active" until 2026-10-14) · Interested · In progress · Quoted · Won
 *   (stage rules in lib/growth-mission/kpi-band.ts). Active is first, in a
 *   wider cell on a cyan tint, because it is the figure to see first;
 *   Ghosted and Lost no longer have boxes of their own.
 * - "Edit mapping" is gone: the boxes follow fixed stage rules.
 * - Each figure shows its label and number only. What it counts is in an
 *   info tooltip, and a click still opens the records behind it.
 *
 * Active keeps the same type size as the others rather than a one-off
 * larger one, since the design system's scale tops out at display; the
 * wider cell, the tint and the colour carry the emphasis instead.
 *
 * Type-size classes are concatenated rather than passed through cn() -
 * see the comment on cn() in lib/utils.ts.
 */

const TONE_CLASS: Record<string, string> = {
  won: "text-success-700",
  active: "text-secondary-800",
  default: "text-primary-900",
};

/** Active spans both columns on phones, where the other four sit two by two. */
const OPPS_GRID = "grid-cols-2 sm:grid-cols-[1.35fr_repeat(4,minmax(0,1fr))]";

function Cell({
  box,
  sources,
  onOpen,
  size,
}: {
  box: KpiBox;
  sources: KpiSource[];
  onOpen: (box: KpiBox) => void;
  size: "display" | "h1";
}) {
  const active = box.tone === "active";
  return (
    <div
      className={`relative flex min-w-0 flex-col items-center justify-center gap-1.5 px-2 pb-5 pt-4 text-center ${
        active ? "col-span-2 bg-secondary-50 sm:col-span-1" : "bg-white"
      }`}
    >
      {/* The whole cell opens the records; the info icon sits above that
          layer so it opens its tooltip instead. */}
      <button
        type="button"
        onClick={() => onOpen(box)}
        aria-label={`${box.label}: show records`}
        className={`absolute inset-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-secondary-500 ${
          active ? "hover:bg-secondary-100/60" : "hover:bg-neutral-50"
        }`}
      />
      <span
        className={`pointer-events-none relative inline-flex items-center gap-1 text-caption font-semibold uppercase tracking-wide ${
          active ? "text-secondary-800" : "text-neutral-400"
        }`}
      >
        {box.label}
        <span className="pointer-events-auto inline-flex">
          <InfoTip text={box.tip} label={`About ${box.label}`} />
        </span>
      </span>
      <CountUp
        value={boxTotal(sources, box.key)}
        className={`pointer-events-none relative ${
          size === "display" ? "text-h1 sm:text-display" : "text-h1"
        } font-bold leading-none tracking-tight tabular-nums ${TONE_CLASS[box.tone ?? "default"]}`}
      />
    </div>
  );
}

const prospects = KPI_BOXES.filter((b) => b.group === "prospects");
const pipeline = KPI_BOXES.filter((b) => b.group === "pipeline");

/** Same fixed height on both halves, so the rule under the two titles is level. */
const GROUP_LABEL =
  "flex h-10 items-center gap-2 overflow-hidden border-b border-neutral-300 px-3.5 text-caption font-bold uppercase tracking-wide";

/** The Command Center's band: its own navy section, one white card. */
export function MissionProgress({
  accountId,
  sources,
  focusSlot,
}: {
  accountId: string;
  sources: KpiSource[];
  /** The Command Center's Focus button (section-switcher.tsx). */
  focusSlot?: ReactNode;
}) {
  const [openBox, setOpenBox] = useState<KpiBox | null>(null);

  return (
    <section className="flex flex-col gap-3 rounded-xl p-4 shadow-lift md:p-5 bg-[linear-gradient(135deg,var(--color-primary-900),var(--color-primary-700)_60%,var(--color-secondary-800))]">
      <SectionHeading title="Mission Progress" tone="dark">
        <span className="inline-flex items-center gap-1 text-caption text-white/55">
          <Radio className="size-3.5" />
          Live from the CRM
        </span>
        {focusSlot}
      </SectionHeading>

      <div className="grid grid-cols-1 overflow-hidden rounded-lg bg-white shadow-raised lg:grid-cols-[2fr_6fr]">
        <div>
          <div className={`${GROUP_LABEL} text-primary-900`}>
            <span aria-hidden="true" className="h-3.5 w-[3px] shrink-0 rounded-full bg-primary-700" />
            Prospects
          </div>
          <div className="grid grid-cols-2 gap-px bg-neutral-300">
            {prospects.map((b) => (
              <Cell key={b.key} box={b} sources={sources} onOpen={setOpenBox} size="display" />
            ))}
          </div>
        </div>
        <div className="border-t border-neutral-300 lg:border-l lg:border-t-0">
          <div className={`${GROUP_LABEL} text-secondary-800`}>
            <span aria-hidden="true" className="h-3.5 w-[3px] shrink-0 rounded-full bg-secondary-500" />
            Opportunities
          </div>
          <div className={`grid ${OPPS_GRID} gap-px bg-neutral-300`}>
            {pipeline.map((b) => (
              <Cell key={b.key} box={b} sources={sources} onOpen={setOpenBox} size="display" />
            ))}
          </div>
        </div>
      </div>

      <RecordsDialog accountId={accountId} box={openBox} sources={sources} onClose={() => setOpenBox(null)} />
    </section>
  );
}

/** Headquarters' version: two white panels inside that page's navy block. */
export function MissionProgressPanels({ accountId, sources }: { accountId: string; sources: KpiSource[] }) {
  const [openBox, setOpenBox] = useState<KpiBox | null>(null);

  const panel = (title: string, boxes: KpiBox[], grid: string) => (
    <div className="flex flex-col overflow-hidden rounded-lg bg-white shadow-raised">
      <div className="flex h-10 items-center gap-2 border-b border-neutral-100 px-3.5">
        <span aria-hidden="true" className="h-3.5 w-[3px] shrink-0 rounded-full bg-secondary-500" />
        <h3 className="text-body-sm font-semibold text-primary-900">{title}</h3>
      </div>
      <div className={`grid flex-1 ${grid} gap-px bg-neutral-100`}>
        {boxes.map((b) => (
          <Cell key={b.key} box={b} sources={sources} onOpen={setOpenBox} size="h1" />
        ))}
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[2fr_5fr]">
      {panel("Prospects", prospects, "grid-cols-2")}
      {panel("Opportunities", pipeline, OPPS_GRID)}
      <RecordsDialog accountId={accountId} box={openBox} sources={sources} onClose={() => setOpenBox(null)} />
    </div>
  );
}
