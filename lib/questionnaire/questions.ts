export type QuestionType = "number" | "text" | "yesno" | "select" | "scale";

export interface QuestionDef {
  key: string;
  label: string;
  type: QuestionType;
  options?: string[];
}

export interface SectionDef {
  key: string;
  name: string;
  icon: "building" | "users" | "target" | "megaphone" | "magnet" | "globe" | "grad" | "gear";
  questions: QuestionDef[];
}

/**
 * Client-confirmed (2026-09-15) — sourced verbatim from
 * "docs/Growth Solution Questionnaire for MSPs.docx" (8 sections, 75
 * questions). Question `key`s are stable identifiers for the jsonb
 * `answers` blob on growth_questionnaire_responses — renaming a label
 * here is safe, changing a `key` orphans any already-saved answers for
 * it, so treat keys as append-only. Each question's `type` is a
 * client-confirmed classification (yes/no, number, free text, a choice,
 * or the one 1–4 scale question) matching how it reads in the source
 * document, not literally present in the doc itself.
 */
export const QUESTIONNAIRE_SECTIONS: SectionDef[] = [
  {
    key: "overview",
    name: "Company Overview",
    icon: "building",
    questions: [
      { key: "overview_locations", label: "How many locations do you manage?", type: "number" },
      { key: "overview_employees", label: "How many employees in your organization?", type: "number" },
      { key: "overview_target_market", label: "What market do you like to focus on?", type: "text" },
      { key: "overview_verticals", label: "Do you focus on any specific verticals?", type: "yesno" },
      { key: "overview_demographic_profile", label: "Can you clearly articulate the demographic profile of your target market and niches?", type: "yesno" },
      { key: "overview_market_research", label: "Have you conducted market research to determine market size and share?", type: "yesno" },
      { key: "overview_decision_makers", label: "Have you identified decision-makers and influencers and defined the problems you solve better than competitors?", type: "yesno" },
      { key: "overview_hvc_defined", label: "Have you defined what an HVC (high-value client) is and developed strategies to attract them?", type: "yesno" },
    ],
  },
  {
    key: "sales_team",
    name: "Sales Team & Structure",
    icon: "users",
    questions: [
      { key: "sales_team_count", label: "How many sales professionals are being managed?", type: "number" },
      { key: "sales_team_planned_hires", label: "How many sales professionals are you planning to hire?", type: "number" },
      { key: "sales_team_hunters_or_farmers", label: "Are your sales professionals hunters or farmers?", type: "select", options: ["Hunters", "Farmers", "Both"] },
      { key: "sales_team_manage_after_sale", label: "Are your sales professionals required to manage clients after the initial sale?", type: "yesno" },
      { key: "sales_team_has_ams_vcios", label: "Do you have account managers or vCIOs to manage additional sales to existing clients?", type: "yesno" },
      { key: "sales_team_am_count", label: "How many account managers (AMs) do you have?", type: "number" },
      { key: "sales_team_bdr_count", label: "How many Business Development Reps (BDRs) do you have?", type: "number" },
      { key: "sales_team_duties_list", label: "Do you have a duties and responsibilities list for sales professionals?", type: "yesno" },
    ],
  },
  {
    key: "sales_strategy",
    name: "Sales Strategy & Execution",
    icon: "target",
    questions: [
      { key: "strategy_documented_plan", label: "Do you have a documented sales plan?", type: "yesno" },
      { key: "strategy_swot", label: "Have you ever conducted a SWOT of your Sales Organization or Sales Process?", type: "yesno" },
      { key: "strategy_playbook", label: "Do you have a documented Sales Playbook for qualifying and closing prospects?", type: "yesno" },
      { key: "strategy_fme_quota", label: "What is your sales professional's monthly FME (First Meeting Ever) quota?", type: "number" },
      { key: "strategy_rep_quota", label: "What is the quota for Sales Reps?", type: "text" },
      { key: "strategy_cold_calls", label: "How many cold calls on average do the sales professionals conduct?", type: "number" },
      { key: "strategy_visits_to_close", label: "How many visits does it take to close a managed services deal?", type: "number" },
      { key: "strategy_average_mrr", label: "What is the average MRR for your managed services agreements?", type: "number" },
      { key: "strategy_deals_per_month", label: "How many managed services deals do you close on average per month?", type: "number" },
      { key: "strategy_kpi_dashboard", label: "Are you using a KPI dashboard to manage sales professionals' activities?", type: "yesno" },
      { key: "strategy_quarterly_counseling", label: "Are you conducting written performance counseling quarterly for sales professionals?", type: "yesno" },
      { key: "strategy_role_play", label: "Do you conduct role play training sessions with your sales professionals?", type: "yesno" },
      { key: "strategy_solutions_trained", label: "Are your sales professionals trained in all your solutions?", type: "yesno" },
      { key: "strategy_personal_marketing_plans", label: "Do you have personal marketing plans for your sales professionals?", type: "yesno" },
    ],
  },
  {
    key: "marketing",
    name: "Marketing Systems & Campaigns",
    icon: "megaphone",
    questions: [
      { key: "marketing_tried_outside_help", label: "Have you tried an outside sales, marketing, coach and/or consultant?", type: "yesno" },
      { key: "marketing_outside_help_score", label: "Outside coach or marketing score 1 to 4.", type: "scale" },
      { key: "marketing_plan_1_3_months", label: "Do you have a marketing plan (1–3 months out) outlining campaigns, brand assets, systems, and activities for short- and long-term goals?", type: "yesno" },
      { key: "marketing_budget", label: "Do you have a marketing budget (10–11% of topline revenue) and know how to invest it for ROI?", type: "yesno" },
      { key: "marketing_documented_goals", label: "Have you created, documented, and shared specific goals for new client acquisition (NCA), sales, and marketing to support your overall growth goals?", type: "yesno" },
      { key: "marketing_backward_math_funnel", label: "Have you done backward math to set funnel goals (raw leads, MQLs, SQLs, clients acquired) to define leading KPIs?", type: "yesno" },
      { key: "marketing_repeatable_systems", label: "Are you developing repeatable, strategic marketing and sales systems?", type: "yesno" },
      { key: "marketing_drip_campaigns", label: "Do you have online and offline drip campaigns to nurture prospects?", type: "yesno" },
      { key: "marketing_weekly_nurture_emails", label: "Are you sending weekly drip/nurture emails to unconverted leads?", type: "yesno" },
      { key: "marketing_funnel_offers_ctas", label: "Do you have top-of-funnel offers and middle-of-funnel CTAs to book appointments?", type: "yesno" },
    ],
  },
  {
    key: "leadgen",
    name: "Lead Generation & CRM",
    icon: "magnet",
    questions: [
      { key: "leadgen_mqc_list_size", label: "How large is your MQC (Marketing Qualified Contacts) list?", type: "number" },
      { key: "leadgen_mql_count", label: "How many MQLs (Marketing Qualified Leads) do you have?", type: "number" },
      { key: "leadgen_hyper_responsive_list", label: "Are you building and maintaining a hyper-responsive list of your target market?", type: "yesno" },
      { key: "leadgen_farm_list", label: "Are you constantly adding qualified prospects to your Farm List to meet NCA goals?", type: "yesno" },
      { key: "leadgen_crm_active_use", label: "Do you actively use your CRM to track notes, leads, conversations, and pipeline activities?", type: "yesno" },
      { key: "leadgen_crm_tagging_discipline", label: "Are you disciplined about tagging CRM records correctly for segmentation and campaign targeting?", type: "yesno" },
      { key: "leadgen_crm_name", label: "Which CRM (Customer Relationship Management) are you using?", type: "text" },
      { key: "leadgen_psa_name", label: "Which PSA (Professional Service Automation) are you using?", type: "text" },
    ],
  },
  {
    key: "digital",
    name: "Digital Presence & Content",
    icon: "globe",
    questions: [
      { key: "digital_webinars", label: "Are you conducting webinars?", type: "yesno" },
      { key: "digital_uses_linkedin", label: "Are you using LinkedIn?", type: "yesno" },
      { key: "digital_company_linkedin_page", label: "Do you have a company LinkedIn Page?", type: "yesno" },
      { key: "digital_linkedin_followers", label: "How many followers does your LinkedIn page have?", type: "number" },
      { key: "digital_strong_linkedin_profiles", label: "Do you and your sales team have strong LinkedIn profiles with full business info and endorsements?", type: "yesno" },
      { key: "digital_social_monitoring", label: "Is someone on your team actively monitoring social media daily?", type: "yesno" },
      { key: "digital_marketing_collateral", label: "Do you have marketing collateral?", type: "yesno" },
      { key: "digital_copy_communicates_clearly", label: "Does your copy/design instantly communicate what you do and who you serve?", type: "yesno" },
      { key: "digital_ongoing_seo", label: "Do you have ongoing SEO and marketing to drive quality traffic to your site?", type: "yesno" },
      { key: "digital_uses_analytics", label: "Do you use analytics to evaluate your website's performance based on facts?", type: "yesno" },
      { key: "digital_ranks_first_on_search", label: "Does your website and social media appear first when someone searches for your company?", type: "yesno" },
      { key: "digital_social_updated_weekly", label: "Are all social media pages complete and updated multiple times a week?", type: "yesno" },
      { key: "digital_google_business_profile", label: "Do you have a well-maintained Google Business Profile with reviews and weekly posts?", type: "yesno" },
    ],
  },
  {
    key: "training",
    name: "Training & Development",
    icon: "grad",
    questions: [
      { key: "training_sales_training_frequency", label: "How often are you conducting sales training (not vendor training) for sales professionals?", type: "text" },
      { key: "training_leadership_training_frequency", label: "How often is leadership training conducted for the sales organization?", type: "text" },
      { key: "training_disc_profiles", label: "Have all the sales professionals completed a DISC profile?", type: "yesno" },
      { key: "training_ssi_tests", label: "Have all the sales professionals completed Sales Skills Index (SSI) tests?", type: "yesno" },
    ],
  },
  {
    key: "operations",
    name: "Operations & Support",
    icon: "gear",
    questions: [
      { key: "ops_csr_roadmap", label: "Do you use a CSR Client Solution roadmap/heatmap?", type: "yesno" },
      { key: "ops_business_reviews", label: "Do you do regularly scheduled business reviews?", type: "yesno" },
      { key: "ops_live_phone_script", label: "Do you answer phones live and follow a scripted process for inbound leads?", type: "yesno" },
      { key: "ops_marketing_supports_sales", label: "Does your marketing team fully support sales with lists, campaigns, scripts, and materials?", type: "yesno" },
      { key: "ops_weekly_kpi_review", label: "Are you tracking and reviewing funnel metrics and campaign KPIs weekly with your team?", type: "yesno" },
      { key: "ops_backward_planning_leads", label: "Do you have a marketing plan based on backward planning to generate sufficient inbound leads?", type: "yesno" },
      { key: "ops_database_scrubbing_frequency", label: "How often do you run your database through scrubbing for quality?", type: "text" },
      { key: "ops_hits_targets", label: "Do you have a professional sales department that consistently hits targets?", type: "yesno" },
      { key: "ops_leadership_building_team", label: "Is your sales leadership actively building the team in both performance and headcount?", type: "yesno" },
      { key: "ops_clear_quotas_coaching", label: "Do you have clear activity and sales quotas and actively coach your team?", type: "yesno" },
    ],
  },
];

export const TOTAL_QUESTION_COUNT = QUESTIONNAIRE_SECTIONS.reduce((sum, s) => sum + s.questions.length, 0);

export function countAnswered(answers: Record<string, unknown>): number {
  let count = 0;
  for (const section of QUESTIONNAIRE_SECTIONS) {
    for (const q of section.questions) {
      const v = answers[q.key];
      if (v !== null && v !== undefined && v !== "") count++;
    }
  }
  return count;
}

export function isComplete(answers: Record<string, unknown>): boolean {
  return countAnswered(answers) === TOTAL_QUESTION_COUNT;
}
