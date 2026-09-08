"use client";

import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";

import { KanbanColumn } from "@/components/opportunities/kanban-column";
import type { OpportunityCardData } from "@/components/opportunities/opportunity-card";
import { Input } from "@/components/ui/input";
import type { OpportunityStageRow } from "@/lib/opportunities/stages";
import { createClient } from "@/lib/supabase/client";

export interface BoardOpportunity extends OpportunityCardData {
  stage_id: string;
  closed_at: string | null;
}

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function isThisMonth(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

/**
 * App Flow §4.5, E1 — Opportunity Board. dnd-kit (Tech Stack Lockfile
 * §3.5), horizontal scroll rather than column compression, drag
 * persists the new stage immediately. Columns are the account's own
 * opportunity_stages rows (client-confirmed customizable, replacing the
 * old fixed 13-stage enum), ordered by sort_order.
 *
 * Client-confirmed redesign ("Concept B — Value-forward board," Kanban
 * mockup review): a client-side search filters by contact/company name
 * (matches the same pattern as Lists Index); a stat strip above the
 * board shows Open Pipeline, Weighted Forecast (Σ open deal value ×
 * its stage's win probability — the first real use of that field,
 * added to Opportunity Stages earlier), and Won This Month (closed_at
 * falling in the current calendar month — there's no other
 * period-filtering concept anywhere in the app yet to match). Dragging
 * a card updates its local win_probability/closed_at optimistically
 * too, not just stage_id, so the stat strip and the card's own
 * probability pill stay correct immediately, before the server
 * round-trip completes.
 */
export function KanbanBoard({
  stages,
  opportunities: initial,
}: {
  stages: OpportunityStageRow[];
  opportunities: BoardOpportunity[];
}) {
  const [opportunities, setOpportunities] = useState(initial);
  const [query, setQuery] = useState("");
  const sortedStages = [...stages].sort((a, b) => a.sort_order - b.sort_order);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const opportunityId = active.id as string;
    const newStageId = over.id as string;
    const current = opportunities.find((o) => o.id === opportunityId);
    if (!current || current.stage_id === newStageId) return;

    const previous = current;
    const newStage = stages.find((s) => s.id === newStageId);
    const closedAt =
      newStage?.stage_group === "won" || newStage?.stage_group === "lost" ? new Date().toISOString() : null;
    setOpportunities((prev) =>
      prev.map((o) =>
        o.id === opportunityId
          ? { ...o, stage_id: newStageId, win_probability: newStage?.win_probability ?? o.win_probability, closed_at: closedAt }
          : o
      )
    );

    const supabase = createClient();
    const { error } = await supabase
      .from("opportunities")
      .update({ stage_id: newStageId, closed_at: closedAt })
      .eq("id", opportunityId);

    if (error) {
      setOpportunities((prev) => prev.map((o) => (o.id === opportunityId ? previous : o)));
      toast.error(getFriendlyErrorMessage(error));
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return opportunities;
    return opportunities.filter(
      (o) => o.contact_name.toLowerCase().includes(q) || (o.company_name ?? "").toLowerCase().includes(q)
    );
  }, [opportunities, query]);

  const stageGroupOf = (stageId: string) => stages.find((s) => s.id === stageId)?.stage_group;
  const openDeals = filtered.filter((o) => stageGroupOf(o.stage_id) === "open");
  const openPipeline = openDeals.reduce((sum, o) => sum + (o.value ?? 0), 0);
  const weightedForecast = openDeals.reduce((sum, o) => sum + (o.value ?? 0) * (o.win_probability / 100), 0);
  const wonThisMonth = filtered
    .filter((o) => stageGroupOf(o.stage_id) === "won" && isThisMonth(o.closed_at))
    .reduce((sum, o) => sum + (o.value ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full max-w-xs self-end">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search deals…"
          className="pl-9"
          aria-label="Search opportunities"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-neutral-200 bg-white p-3.5">
          <p className="text-h4 font-bold tabular-nums text-primary-900">{currency.format(openPipeline)}</p>
          <p className="text-caption text-neutral-500">Open Pipeline · {openDeals.length} deals</p>
        </div>
        <div className="rounded-lg border border-secondary-100 bg-gradient-to-br from-secondary-50 to-white p-3.5">
          <p className="text-h4 font-bold tabular-nums text-secondary-800">{currency.format(weightedForecast)}</p>
          <p className="text-caption text-neutral-500">Weighted Forecast (probability-adjusted)</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-3.5">
          <p className="text-h4 font-bold tabular-nums text-primary-900">{currency.format(wonThisMonth)}</p>
          <p className="text-caption text-neutral-500">Won This Month</p>
        </div>
      </div>

      <DndContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {sortedStages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              opportunities={filtered.filter((o) => o.stage_id === stage.id)}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
