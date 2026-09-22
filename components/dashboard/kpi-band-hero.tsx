"use client";

import { useState } from "react";

import { RecordsDialog } from "@/components/gos-dashboard/kpi-records-dialog";
import { CountUp } from "@/components/ui/count-up";
import {
  KPI_BOXES,
  activeOpportunities,
  boxTotal,
  type KpiBox,
  type KpiBoxKey,
  type KpiSource,
} from "@/lib/gos-dashboard/kpi-band";

/**
 * The KPI band as it appears inside the Homepage's hero (client-confirmed,
 * 2026-09-22, from the approved mockup "A"), replacing the "This week" tiles
 * that used to sit there.
 *
 * It is a separate component from the Command Center's band rather than a
 * variant of it, because almost nothing survives the change of ground:
 *
 * - The two panels are built from the hero's own translucent white, the same
 *   material as the profile chips above them, so the band reads as part of
 *   the hero rather than a card dropped onto it. The Command Center's solid
 *   navy and teal header bars would muddy against the gradient.
 * - Figures sit in white, and the three toned boxes move to their light
 *   steps: success-400 and warning-400 read on navy where the 700/800 steps
 *   used on the white page would disappear.
 * - Lost is left out here (client-confirmed): the Homepage opens the day,
 *   and a closed-lost count is not what it is for. The Command Center still
 *   shows it, so nothing is hidden - it is a question of what this page
 *   leads with.
 * - There is no "Edit mapping" control. Which statuses and stages feed each
 *   box stays a Command Center decision.
 *
 * Clicking a figure opens the same records dialog as the Command Center.
 */
const OMITTED_ON_HOMEPAGE: KpiBoxKey[] = ["lost"];

const TONE_CLASS: Record<string, string> = {
  won: "text-success-400",
  ghosted: "text-warning-400",
  lost: "text-white/60",
  default: "text-white",
};

function Panel({
  title,
  boxes,
  sources,
  onOpen,
  columns,
  children,
}: {
  title: string;
  boxes: KpiBox[];
  sources: KpiSource[];
  onOpen: (box: KpiBox) => void;
  columns: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-white/10 bg-white/5">
      <div className="flex items-center gap-2 border-b border-white/10 px-3.5 py-2">
        <span aria-hidden="true" className="h-3.5 w-[3px] shrink-0 rounded-full bg-secondary-500" />
        <h3 className="text-body-sm font-semibold text-white">{title}</h3>
        {children}
      </div>
      <div className={`grid flex-1 ${columns}`}>
        {boxes.map((box, i) => (
          <button
            key={box.key}
            type="button"
            onClick={() => onOpen(box)}
            className={`flex min-w-0 flex-col items-center justify-center gap-1.5 px-2 pb-4 pt-3.5 text-center transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-secondary-300 ${
              i > 0 ? "border-l border-white/10" : ""
            }`}
          >
            <span className="text-caption font-semibold uppercase tracking-wide text-white/55">{box.label}</span>
            <CountUp
              value={boxTotal(sources, box.key)}
              className={`text-h1 font-bold leading-none tracking-tight tabular-nums ${TONE_CLASS[box.tone ?? "default"]}`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function KpiBandHero({ accountId, sources }: { accountId: string; sources: KpiSource[] }) {
  const [openBox, setOpenBox] = useState<KpiBox | null>(null);
  const shown = KPI_BOXES.filter((b) => !OMITTED_ON_HOMEPAGE.includes(b.key));
  const prospects = shown.filter((b) => b.group === "prospects");
  const pipeline = shown.filter((b) => b.group === "pipeline");

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[3fr_4fr]">
      <Panel
        title="Prospects"
        boxes={prospects}
        sources={sources}
        onOpen={setOpenBox}
        columns="grid-cols-3"
      />
      <Panel
        title="Opportunities"
        boxes={pipeline}
        sources={sources}
        onOpen={setOpenBox}
        columns="grid-cols-2 sm:grid-cols-4"
      >
        <span
          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-caption font-semibold text-white/85"
          title="Every stage except Won, Lost and Lost Resurrected"
        >
          Active
          <CountUp value={activeOpportunities(sources)} className="font-bold tabular-nums text-white" />
        </span>
      </Panel>

      <RecordsDialog accountId={accountId} box={openBox} sources={sources} onClose={() => setOpenBox(null)} />
    </div>
  );
}
