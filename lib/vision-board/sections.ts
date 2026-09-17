export type FieldType = "text" | "list";

export interface FieldDef {
  key: string;
  label: string;
  help?: string;
  type: FieldType;
  /** "text" fields render as a textarea when true, a single-line input otherwise. */
  multiline?: boolean;
  /** "list" fields only — a list counts as answered once it has at least this many items. */
  minItems?: number;
  maxItems?: number;
  placeholder?: string;
}

export interface SectionDef {
  key: string;
  name: string;
  icon: "heart" | "target" | "flag" | "megaphone" | "eye" | "calendar" | "alert" | "bars" | "trenddown" | "pen";
  hint?: string;
  fields: FieldDef[];
}

/**
 * Client-confirmed addition (2026-09-16) — the GOS Vision Board,
 * sourced from "GrowthOS Vision Board Dev Questions.docx" (9 numbered
 * sections + a Leadership Sign-Off). One row per account; answers live
 * in a single `jsonb` column keyed by a stable field key here, not one
 * column per field — same shape as growth_questionnaire_responses and
 * for the same reason (the source document can change without a
 * migration).
 *
 * The doc's "Ideal Customer Profile" sub-section is deliberately not a
 * field here — client-confirmed (2026-09-16) it's read-only, populated
 * from the account's GOS Solution Questionnaire answers instead of
 * captured again. The 5-question "Leadership Commitment" self-check is
 * also not stored: it's a reflection prompt for the team, not a
 * deliverable, so it renders as static guidance ahead of the sign-off
 * fields rather than persisted checkboxes.
 */
export const VISION_BOARD_SECTIONS: SectionDef[] = [
  {
    key: "values",
    name: "Core Values",
    icon: "heart",
    hint: "The non-negotiable principles that guide how your company operates — hiring, promotions, client interactions. Avoid generic buzzwords; use behaviors you can actually observe.",
    fields: [
      { key: "values_list", label: "Your Core Values", type: "list", minItems: 3, maxItems: 7, placeholder: "e.g. Radical Ownership" },
    ],
  },
  {
    key: "focus",
    name: "Core Focus",
    icon: "target",
    fields: [
      { key: "focus_purpose", label: "Your Purpose", help: "Why does your organization exist?", type: "text", multiline: true },
      { key: "focus_niche", label: "Your Niche", help: "What do you do better than most competitors?", type: "text", multiline: true },
    ],
  },
  {
    key: "target10",
    name: "Your 10-Year Target",
    icon: "flag",
    hint: "The single most important goal your company wants to achieve within the next ten years. Ambitious, inspiring, measurable, simple to communicate.",
    fields: [{ key: "target10_text", label: "Your 10-Year Target", type: "text", multiline: true }],
  },
  {
    key: "marketing",
    name: "Your Marketing Strategy",
    icon: "megaphone",
    fields: [
      { key: "unique_1", label: "Unique #1", type: "text", multiline: true },
      { key: "unique_2", label: "Unique #2", type: "text", multiline: true },
      { key: "unique_3", label: "Unique #3", type: "text", multiline: true },
      { key: "process_stages", label: "Major Stages of Your Client Journey", help: "In order — e.g. Discover, Assess, Design, Implement, Optimize", type: "list", minItems: 2, placeholder: "e.g. Discover" },
      { key: "guarantee_text", label: "Your Guarantee", help: "A commitment that reduces risk and increases buyer confidence", type: "text", multiline: true },
    ],
  },
  {
    key: "picture3",
    name: "Your 3-Year Picture",
    icon: "eye",
    hint: "It's exactly three years from today. Describe your company as if you've already achieved your goals — present tense.",
    fields: [
      { key: "picture3_revenue", label: "Annual Revenue", type: "text" },
      { key: "picture3_gross_profit", label: "Gross Profit", type: "text" },
      { key: "picture3_net_profit", label: "Net Profit", type: "text" },
      { key: "picture3_mrr", label: "MRR", type: "text" },
      { key: "picture3_team", label: "Team", type: "text", multiline: true },
      { key: "picture3_clients", label: "Clients", type: "text", multiline: true },
      { key: "picture3_market_position", label: "Market Position", type: "text", multiline: true },
      { key: "picture3_operations", label: "Operations", type: "text", multiline: true },
    ],
  },
  {
    key: "plan1",
    name: "Your 1-Year Plan",
    icon: "calendar",
    hint: "What must happen in the next 12 months to stay on track toward your 3-Year Picture? Focus on outcomes, not activities.",
    fields: [
      { key: "plan1_revenue_goal", label: "Revenue Goal", type: "text" },
      { key: "plan1_gross_profit_goal", label: "Gross Profit Goal", type: "text" },
      { key: "plan1_net_profit_goal", label: "Net Profit Goal", type: "text" },
      { key: "plan1_mrr_goal", label: "MRR Goal", type: "text" },
      { key: "plan1_new_client_goal", label: "New Client Acquisition Goal", type: "text" },
      { key: "plan1_priorities", label: "Top Annual Priorities", help: "Up to 7 — the most important goals only", type: "list", minItems: 1, maxItems: 7, placeholder: "e.g. Launch 24/7 SOC" },
    ],
  },
  {
    key: "obstacles",
    name: "Issues, Obstacles & Growth Challenges",
    icon: "alert",
    hint: "What could prevent you from hitting your 1-Year Plan? Be honest — think People, Process, Technology, Sales & Marketing, and Market Conditions.",
    fields: [{ key: "obstacles_list", label: "Your Top Obstacles", type: "list", minItems: 1, placeholder: "e.g. Hiring senior engineers fast enough" }],
  },
  {
    key: "metrics",
    name: "Critical Business Metrics",
    icon: "bars",
    hint: "The 5–15 numbers your leadership team should review every week or month — e.g. MRR, New Clients Acquired, CSAT, Gross Margin, Proposal Close Rate.",
    fields: [{ key: "metrics_list", label: "Our Most Important Metrics", type: "list", minItems: 5, maxItems: 15, placeholder: "e.g. MRR" }],
  },
  {
    key: "barrier",
    name: "Growth Barrier Analysis",
    icon: "trenddown",
    hint: "If you had to double revenue within the next 36 months, what would stop you? This often reveals the most important growth opportunity in the business.",
    fields: [{ key: "barrier_text", label: "The Biggest Barrier to Our Growth Is", type: "text", multiline: true }],
  },
  {
    key: "signoff",
    name: "Leadership Sign-Off",
    icon: "pen",
    hint: "GrowthOS works best when leadership is aligned. Before signing off, confirm the team agrees with these answers.",
    fields: [
      { key: "signoff_name", label: "Name", type: "text" },
      { key: "signoff_title", label: "Title", type: "text" },
      { key: "signoff_date", label: "Date", type: "text" },
    ],
  },
];

export const TOTAL_FIELD_COUNT = VISION_BOARD_SECTIONS.reduce((sum, s) => sum + s.fields.length, 0);

function fieldAnswered(field: FieldDef, value: unknown): boolean {
  if (field.type === "list") {
    return Array.isArray(value) && value.length >= (field.minItems ?? 1);
  }
  return typeof value === "string" && value.trim() !== "";
}

export function countAnswered(answers: Record<string, unknown>): number {
  let count = 0;
  for (const section of VISION_BOARD_SECTIONS) {
    for (const field of section.fields) {
      if (fieldAnswered(field, answers[field.key])) count++;
    }
  }
  return count;
}

export function isComplete(answers: Record<string, unknown>): boolean {
  return countAnswered(answers) === TOTAL_FIELD_COUNT;
}
