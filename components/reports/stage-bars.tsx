import type { StageCount } from "@/components/dashboard/pipeline-by-stage";
import { STAGE_GROUP_LABELS, type StageGroup } from "@/lib/opportunities/stages";
import { cn } from "@/lib/utils";

const GROUP_BAR: Record<StageGroup, string> = {
  open: "bg-secondary-500",
  won: "bg-success-500",
  lost: "bg-neutral-300",
};
const GROUP_DOT: Record<StageGroup, string> = {
  open: "bg-secondary-500",
  won: "bg-success-500",
  lost: "bg-neutral-400",
};

/** Reports' Opportunities by Stage section — same bars/data shape as the Dashboard's PipelineByStage, without its own card chrome (ReportCard supplies that here). */
export function StageBars({ stages }: { stages: StageCount[] }) {
  const totals: Record<StageGroup, number> = { open: 0, won: 0, lost: 0 };
  for (const s of stages) totals[s.stage_group] += s.count;
  const grandTotal = totals.open + totals.won + totals.lost;
  const maxCount = Math.max(1, ...stages.map((s) => s.count));

  if (grandTotal === 0) {
    return <p className="px-4 py-6 text-body-sm text-neutral-500">No opportunities yet.</p>;
  }

  return (
    <div className="max-h-64 overflow-y-auto">
      <div className="flex gap-4 px-4 pt-3.5 pb-2 text-caption text-neutral-500">
        {(["open", "won", "lost"] as StageGroup[]).map((g) => (
          <span key={g} className="flex items-center gap-1.5">
            <span className={cn("size-1.5 rounded-full", GROUP_DOT[g])} />
            {STAGE_GROUP_LABELS[g]} · {totals[g]}
          </span>
        ))}
      </div>
      <div className="flex flex-col pb-3">
        {stages.map((s) => (
          <div key={s.id} className="flex items-center gap-2.5 px-4 py-1.5">
            <span className={cn("size-1.5 shrink-0 rounded-full", GROUP_DOT[s.stage_group])} />
            <span className="w-40 shrink-0 truncate text-caption text-neutral-600">{s.name}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
              <span
                className={cn("block h-full rounded-full", GROUP_BAR[s.stage_group])}
                style={{ width: `${(s.count / maxCount) * 100}%` }}
              />
            </span>
            <span className="w-5 shrink-0 text-right text-caption tabular-nums text-neutral-500">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
