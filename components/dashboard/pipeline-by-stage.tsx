import Link from "next/link";

import { STAGE_GROUP_LABELS, type StageGroup } from "@/lib/opportunities/stages";
import { cn } from "@/lib/utils";

export interface StageCount {
  id: string;
  name: string;
  stage_group: StageGroup;
  count: number;
}

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

/**
 * App Flow §4.3 — "a compact bar/count view (not the full board)" of
 * every account-defined opportunity_stage (Backend Schema §5.5's
 * customizable-stages table, not a fixed enum), so this reflects
 * whatever stages the account has actually configured under Settings →
 * Opportunity Stages rather than a hardcoded funnel.
 */
export function PipelineByStage({ stages }: { stages: StageCount[] }) {
  const totals: Record<StageGroup, number> = { open: 0, won: 0, lost: 0 };
  for (const s of stages) totals[s.stage_group] += s.count;
  const grandTotal = totals.open + totals.won + totals.lost;
  const maxCount = Math.max(1, ...stages.map((s) => s.count));

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3.5">
        <h2 className="text-h4 text-primary-900">Pipeline by Stage</h2>
        <Link href="/opportunities" className="text-caption font-semibold text-secondary-700 hover:text-secondary-800">
          Full board
        </Link>
      </div>

      {grandTotal === 0 ? (
        <p className="px-4 py-6 text-body-sm text-neutral-500">No opportunities yet.</p>
      ) : (
        <>
          <div className="mx-4 mt-3 flex h-2.5 overflow-hidden rounded-full bg-neutral-100">
            {(["open", "won", "lost"] as StageGroup[]).map((g) =>
              totals[g] > 0 ? (
                <span key={g} className={GROUP_BAR[g]} style={{ width: `${(totals[g] / grandTotal) * 100}%` }} />
              ) : null
            )}
          </div>
          <div className="flex gap-4 px-4 pb-3 pt-2 text-caption text-neutral-500">
            {(["open", "won", "lost"] as StageGroup[]).map((g) => (
              <span key={g} className="flex items-center gap-1.5">
                <span className={cn("size-1.5 rounded-full", GROUP_DOT[g])} />
                {STAGE_GROUP_LABELS[g]} · {totals[g]}
              </span>
            ))}
          </div>

          <div className="flex flex-col pb-2">
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
        </>
      )}
    </div>
  );
}
