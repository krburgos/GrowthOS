"use client";

import { useDroppable } from "@dnd-kit/core";

import { OpportunityCard, type OpportunityCardData } from "@/components/opportunities/opportunity-card";
import { STAGE_GROUP_HEADER_CLASSES, type OpportunityStageRow } from "@/lib/opportunities/stages";
import { cn } from "@/lib/utils";

export function KanbanColumn({
  stage,
  opportunities,
}: {
  stage: OpportunityStageRow;
  opportunities: OpportunityCardData[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div className="flex w-[280px] shrink-0 flex-col gap-2">
      <div className={cn("rounded-md px-3 py-2 text-caption", STAGE_GROUP_HEADER_CLASSES[stage.stage_group])}>
        {stage.name}
        <span className="ml-1.5 opacity-70">{opportunities.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-24 flex-col gap-2 rounded-md p-1 transition-colors",
          isOver && "bg-secondary-50"
        )}
      >
        {opportunities.map((opp) => (
          <OpportunityCard key={opp.id} opportunity={opp} />
        ))}
      </div>
    </div>
  );
}
