"use client";

import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { useState } from "react";
import { toast } from "sonner";

import { KanbanColumn } from "@/components/opportunities/kanban-column";
import type { OpportunityCardData } from "@/components/opportunities/opportunity-card";
import type { OpportunityStageRow } from "@/lib/opportunities/stages";
import { createClient } from "@/lib/supabase/client";

export interface BoardOpportunity extends OpportunityCardData {
  stage_id: string;
}

/**
 * App Flow §4.5, E1 — Opportunity Board. dnd-kit (Tech Stack Lockfile
 * §3.5), horizontal scroll rather than column compression, drag
 * persists the new stage immediately. Columns are the account's own
 * opportunity_stages rows (client-confirmed customizable, replacing the
 * old fixed 13-stage enum), ordered by sort_order.
 */
export function KanbanBoard({
  stages,
  opportunities: initial,
}: {
  stages: OpportunityStageRow[];
  opportunities: BoardOpportunity[];
}) {
  const [opportunities, setOpportunities] = useState(initial);
  const sortedStages = [...stages].sort((a, b) => a.sort_order - b.sort_order);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const opportunityId = active.id as string;
    const newStageId = over.id as string;
    const current = opportunities.find((o) => o.id === opportunityId);
    if (!current || current.stage_id === newStageId) return;

    const previousStageId = current.stage_id;
    const newStage = stages.find((s) => s.id === newStageId);
    setOpportunities((prev) =>
      prev.map((o) => (o.id === opportunityId ? { ...o, stage_id: newStageId } : o))
    );

    const supabase = createClient();
    const { error } = await supabase
      .from("opportunities")
      .update({
        stage_id: newStageId,
        closed_at: newStage?.stage_group === "won" || newStage?.stage_group === "lost" ? new Date().toISOString() : null,
      })
      .eq("id", opportunityId);

    if (error) {
      setOpportunities((prev) =>
        prev.map((o) => (o.id === opportunityId ? { ...o, stage_id: previousStageId } : o))
      );
      toast.error(error.message);
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {sortedStages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            opportunities={opportunities.filter((o) => o.stage_id === stage.id)}
          />
        ))}
      </div>
    </DndContext>
  );
}
