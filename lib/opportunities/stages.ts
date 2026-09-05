/**
 * Client-confirmed deviation from Backend Schema §5.1/§5.5 and Design
 * System §8.4 — opportunity stages are no longer a fixed 13-value enum.
 * Each account manages its own stages (Settings → Opportunity Stages,
 * Owner/Admin only), stored in the opportunity_stages table. Every stage
 * still carries one of three semantic groups so the Kanban board's
 * column coloring and closed_at logic keep working against an arbitrary
 * custom stage name, the same way the old fixed enum's groups did.
 */
export type StageGroup = "open" | "won" | "lost";

export interface OpportunityStageRow {
  id: string;
  name: string;
  stage_group: StageGroup;
  sort_order: number;
}

/** Design System §8.4 column header treatment per group. */
export const STAGE_GROUP_HEADER_CLASSES: Record<StageGroup, string> = {
  open: "bg-secondary-50 text-secondary-800",
  won: "bg-success-50 text-success-800",
  lost: "bg-neutral-100 text-neutral-600",
};

export const STAGE_GROUP_BADGE_VARIANT: Record<StageGroup, "success" | "neutral" | "info"> = {
  open: "info",
  won: "success",
  lost: "neutral",
};

export const STAGE_GROUP_LABELS: Record<StageGroup, string> = {
  open: "Open",
  won: "Won",
  lost: "Lost",
};
