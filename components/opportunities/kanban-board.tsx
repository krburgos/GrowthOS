"use client";

import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { useState } from "react";
import { toast } from "sonner";

import { KanbanColumn } from "@/components/opportunities/kanban-column";
import type { OpportunityCardData } from "@/components/opportunities/opportunity-card";
import { OPPORTUNITY_STAGES, type OpportunityStage } from "@/lib/opportunities/stages";
import { createClient } from "@/lib/supabase/client";

export interface BoardOpportunity extends OpportunityCardData {
  stage: OpportunityStage;
}

/**
 * App Flow §4.5, E1 — Opportunity Board. dnd-kit (Tech Stack Lockfile
 * §3.5), horizontal scroll rather than column compression, drag
 * persists the new stage immediately.
 */
export function KanbanBoard({ opportunities: initial }: { opportunities: BoardOpportunity[] }) {
  const [opportunities, setOpportunities] = useState(initial);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const opportunityId = active.id as string;
    const newStage = over.id as OpportunityStage;
    const current = opportunities.find((o) => o.id === opportunityId);
    if (!current || current.stage === newStage) return;

    const previousStage = current.stage;
    setOpportunities((prev) =>
      prev.map((o) => (o.id === opportunityId ? { ...o, stage: newStage } : o))
    );

    const supabase = createClient();
    const { error } = await supabase
      .from("opportunities")
      .update({ stage: newStage })
      .eq("id", opportunityId);

    if (error) {
      setOpportunities((prev) =>
        prev.map((o) => (o.id === opportunityId ? { ...o, stage: previousStage } : o))
      );
      toast.error(error.message);
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {OPPORTUNITY_STAGES.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            opportunities={opportunities.filter((o) => o.stage === stage)}
          />
        ))}
      </div>
    </DndContext>
  );
}
