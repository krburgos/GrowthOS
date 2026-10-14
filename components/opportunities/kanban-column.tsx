"use client";

import { useDroppable } from "@dnd-kit/core";

import { OpportunityCard, type OpportunityCardData } from "@/components/opportunities/opportunity-card";
import { usdShort } from "@/lib/companies/value";
import { STAGE_GROUP_HEADER_CLASSES, type OpportunityStageRow } from "@/lib/opportunities/stages";
import { cn } from "@/lib/utils";

/**
 * Client-confirmed, this exact stage only (2026-09-08): the literal
 * "Lost" column reads error-100/error-700 (light red) instead of the
 * shared Lost/Stalled neutral-grey — the client wants "Lost"
 * specifically to read as a dead end on the board, same as the
 * Settings → Opportunity Stages screen already does. Keyed by stage
 * **name**, not group membership: "Lost Resurrected" shares the Lost
 * group but keeps the neutral header, since only the literal "Lost"
 * stage should turn red. `STAGE_GROUP_HEADER_CLASSES` (shared with any
 * future consumer) is untouched; this is a local, name-keyed override.
 */
function headerClasses(stage: OpportunityStageRow): string {
  if (stage.name.trim().toLowerCase() === "lost") return "bg-error-100 text-error-700";
  return STAGE_GROUP_HEADER_CLASSES[stage.stage_group];
}

/**
 * Client-confirmed redesign ("Concept B — Value-forward board"): the
 * header now also shows the column's total open value and the stage's
 * win probability (a single number, since every opportunity in a
 * column shares the same stage) — not an "average," since there's
 * nothing to average within one stage.
 *
 * Client-confirmed (2026-10-14): the total is Prospect Value (the client's
 * company-size formula), not the typed deal value, and the column sits on
 * a light blue tray so the white cards separate from the page.
 */
export function KanbanColumn({
  stage,
  opportunities,
}: {
  stage: OpportunityStageRow;
  opportunities: OpportunityCardData[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const columnTotal = opportunities.reduce((sum, o) => sum + o.prospect_value, 0);
  const open = stage.stage_group === "open";

  return (
    <div className="flex w-[272px] shrink-0 snap-start flex-col gap-2 rounded-xl border border-primary-100 bg-primary-50 p-2 lg:snap-align-none">
      <div
        className={cn(
          "flex flex-col gap-0.5 rounded-md px-3 py-2 text-caption font-semibold",
          headerClasses(stage)
        )}
      >
        <div className="flex items-center justify-between">
          {stage.name}
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/70 px-1.5 text-[11px] font-semibold tabular-nums">
            {opportunities.length}
          </span>
        </div>
        <span className="text-[11px] font-medium tabular-nums opacity-75">
          {usdShort(columnTotal)} Prospect Value{open ? ` · ${stage.win_probability}% win` : ""}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-24 max-h-[70vh] flex-col gap-2 overflow-y-auto rounded-md p-1 transition-colors",
          isOver && "bg-secondary-50 ring-1 ring-inset ring-secondary-200"
        )}
      >
        {opportunities.map((opp) => (
          <OpportunityCard key={opp.id} opportunity={opp} open={open} />
        ))}
      </div>
    </div>
  );
}
