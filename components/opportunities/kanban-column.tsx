"use client";

import { useDroppable } from "@dnd-kit/core";

import { OpportunityCard, type OpportunityCardData } from "@/components/opportunities/opportunity-card";
import { STAGE_GROUP_HEADER_CLASSES, type OpportunityStageRow } from "@/lib/opportunities/stages";
import { cn } from "@/lib/utils";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/**
 * Client-confirmed redesign ("Concept B — Value-forward board"): the
 * header now also shows the column's total open value and the stage's
 * win probability (a single number, since every opportunity in a
 * column shares the same stage) — not an "average," since there's
 * nothing to average within one stage.
 */
export function KanbanColumn({
  stage,
  opportunities,
}: {
  stage: OpportunityStageRow;
  opportunities: OpportunityCardData[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const columnTotal = opportunities.reduce((sum, o) => sum + (o.value ?? 0), 0);

  return (
    <div className="flex w-[280px] shrink-0 flex-col gap-2">
      <div
        className={cn(
          "flex flex-col gap-0.5 rounded-md px-3 py-2 text-caption font-semibold",
          STAGE_GROUP_HEADER_CLASSES[stage.stage_group]
        )}
      >
        <div className="flex items-center justify-between">
          {stage.name}
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/70 px-1.5 text-[11px] font-semibold tabular-nums">
            {opportunities.length}
          </span>
        </div>
        <span className="text-[11px] font-medium tabular-nums opacity-75">
          {currency.format(columnTotal)} · {stage.win_probability}%
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-24 flex-col gap-2 rounded-md p-1 transition-colors",
          isOver && "bg-secondary-50 ring-1 ring-inset ring-secondary-200"
        )}
      >
        {opportunities.map((opp) => (
          <OpportunityCard key={opp.id} opportunity={opp} />
        ))}
      </div>
    </div>
  );
}
