/**
 * Backend Schema §5.1 — opportunity_stage enum, literal left-to-right
 * pipeline order. Design System §8.4 — the 13 stages group into three
 * semantic buckets for column header coloring.
 */
export const OPPORTUNITY_STAGES = [
  "identified_interest",
  "discovery_scheduled",
  "discovery_completed",
  "solution_alignment",
  "proposal_development",
  "proposal_delivered",
  "negotiation",
  "verbal_commitment",
  "contract_sent",
  "closed_won",
  "closed_lost",
  "ghosted",
  "on_hold",
] as const;

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

export const STAGE_LABELS: Record<OpportunityStage, string> = {
  identified_interest: "Identified Interest",
  discovery_scheduled: "Discovery Scheduled",
  discovery_completed: "Discovery Completed",
  solution_alignment: "Solution Alignment",
  proposal_development: "Proposal Development",
  proposal_delivered: "Proposal Delivered",
  negotiation: "Negotiation",
  verbal_commitment: "Verbal Commitment",
  contract_sent: "Contract Sent",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
  ghosted: "Ghosted",
  on_hold: "On Hold",
};

export type StageGroup = "open" | "won" | "lost";

const OPEN_STAGES: OpportunityStage[] = [
  "identified_interest",
  "discovery_scheduled",
  "discovery_completed",
  "solution_alignment",
  "proposal_development",
  "proposal_delivered",
  "negotiation",
  "verbal_commitment",
  "contract_sent",
];
const LOST_STAGES: OpportunityStage[] = ["closed_lost", "ghosted", "on_hold"];

export function stageGroup(stage: OpportunityStage): StageGroup {
  if (stage === "closed_won") return "won";
  if (LOST_STAGES.includes(stage)) return "lost";
  return "open";
}

/** Design System §8.4 column header treatment per group. */
export const STAGE_GROUP_HEADER_CLASSES: Record<StageGroup, string> = {
  open: "bg-secondary-50 text-secondary-800",
  won: "bg-success-50 text-success-800",
  lost: "bg-neutral-100 text-neutral-600",
};
