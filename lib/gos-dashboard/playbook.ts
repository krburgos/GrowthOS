/**
 * GrowthOS Dashboard (GOS Dashboard) — mockup-only, client-confirmed
 * addition (2026-09-16). Sourced from "GrowthOS Playbook - Dev Plan.docx":
 * 4 phases, 14 numbered steps, each with its own Duties and KPIs. The doc
 * only spells out a "GrowthOS Dashboard" sub-shape (status report,
 * suggestions/fixes list, progress tracker) for step 1 (SEO) and step 2
 * (GEO) — client-confirmed (2026-09-16) the other 12 steps stay simpler
 * (Duties + KPIs only, no report/suggestions/tracker tabs).
 *
 * This is presentation-only: every number, status, and tracker value below
 * is illustrative sample data (client-confirmed 2026-09-16), not read from
 * any real integration. Nothing here is persisted — there's no backend
 * table for this yet, deliberately, since this pass is mockups only.
 */

export type PlaybookStatus = "on_track" | "ahead" | "needs_attention";

export const STATUS_LABEL: Record<PlaybookStatus, string> = {
  on_track: "On Track",
  ahead: "Ahead of Schedule",
  needs_attention: "Needs Attention",
};

export interface KpiStat {
  label: string;
  value: string;
  target?: string;
}

export interface SuggestionItem {
  title: string;
  priority: "high" | "medium" | "low";
  detail: string;
}

export interface TrackerItem {
  label: string;
  percentComplete: number;
}

export type IconKey =
  | "search"
  | "sparkles"
  | "pen-tool"
  | "share2"
  | "layout"
  | "target"
  | "database"
  | "mail"
  | "settings"
  | "trending-up"
  | "star"
  | "calendar-days"
  | "phone"
  | "clipboard-check";

export interface PlaybookStep {
  slug: string;
  number: number;
  phase: 1 | 2 | 3 | 4;
  title: string;
  icon: IconKey;
  responsible?: string;
  budgetNote?: string;
  status: PlaybookStatus;
  headline: KpiStat;
  duties: string[];
  kpis: KpiStat[];
  /** Only SEO and GEO carry this — the doc's own "GrowthOS Dashboard" sub-shape. */
  dashboard?: {
    statusReport: { summary: string; stats: KpiStat[] };
    suggestions: SuggestionItem[];
    tracker: TrackerItem[];
  };
}

export const PLAYBOOK_PHASES: { phase: 1 | 2 | 3 | 4; name: string; goal: string }[] = [
  { phase: 1, name: "Foundation & Visibility", goal: "Establish visibility, fix discoverability gaps, and build the baseline for outbound." },
  { phase: 2, name: "Pipeline & Outbound Engine", goal: "Build predictable outbound pipeline and define the ICP." },
  { phase: 3, name: "Authority, Trust & Demand Creation", goal: "Build credibility and increase inbound demand." },
  { phase: 4, name: "SDR Outreach & Sales Execution", goal: "Build consistent outbound activity and convert intent into meetings." },
];

export const PLAYBOOK_STEPS: PlaybookStep[] = [
  {
    slug: "seo",
    number: 1,
    phase: 1,
    title: "SEO — Search Engine Optimization",
    icon: "search",
    status: "on_track",
    headline: { label: "Organic traffic (90 days)", value: "+31%" },
    duties: [
      "Full SEO audit (technical, on-page, off-page)",
      "Keyword strategy aligned to ICP",
      "On-page optimization (titles, headers, metadata, internal links)",
      "Technical SEO fixes (speed, indexing, schema, mobile)",
      "Backlink strategy (authority building)",
      "Local SEO optimization (GBP, citations, NAP consistency)",
      "Monthly SEO reporting & insights",
    ],
    kpis: [
      { label: "Organic traffic growth", value: "+31%", target: "+20–40% by Month 3" },
      { label: "New ranking keywords", value: "16/mo", target: "+10–20/mo" },
      { label: "Domain Authority", value: "+1.4/qtr", target: "+1–2/qtr" },
      { label: "Technical SEO errors reduced", value: "72%", target: "80% reduction" },
      { label: "Top 3 rankings, core keywords", value: "2 of 5", target: "3–5 by Month 6" },
    ],
    dashboard: {
      statusReport: {
        summary:
          "Technical audit and on-page fixes are complete across all service pages. Backlink outreach is ramping; two core keywords have cracked the top 3 with three more tracking toward it this quarter.",
        stats: [
          { label: "Organic sessions", value: "8,420/mo", target: "6,400/mo baseline" },
          { label: "Indexed pages", value: "142", target: "148 total" },
          { label: "Avg. page speed (mobile)", value: "2.1s", target: "< 2.5s" },
        ],
      },
      suggestions: [
        { title: "Fix 14 pages with duplicate meta descriptions", priority: "high", detail: "Flagged in the latest crawl — affects 3 core service pages." },
        { title: "Add schema markup to the Careers page", priority: "medium", detail: "Only page on the site still missing structured data." },
        { title: "Consolidate two overlapping blog posts targeting the same keyword", priority: "low", detail: "Cannibalization risk for \"managed IT services\" queries." },
      ],
      tracker: [
        { label: "Complete backlink outreach batch 2", percentComplete: 65 },
        { label: "Local citation cleanup (12 directories)", percentComplete: 90 },
        { label: "Core Web Vitals remediation", percentComplete: 40 },
      ],
    },
  },
  {
    slug: "geo",
    number: 2,
    phase: 1,
    title: "GEO — Generative Engine Optimization",
    icon: "sparkles",
    responsible: "Claude, Lance & Vernon",
    status: "on_track",
    headline: { label: "AI summary accuracy", value: "88%" },
    duties: [
      "Structure content for AI parsing (headings, bullets, FAQs)",
      "Implement schema markup (LocalBusiness, Service, FAQ, Reviews)",
      "Quarterly content refresh for AI accuracy",
      "Optimize for AI engines (ChatGPT, Perplexity, Google AI Overviews, Bing AI)",
      "Monitor AI citations and summary accuracy",
      "Improve local GEO visibility (GEO grids, GBP optimization)",
      "Publish authoritative, fact-based content AI engines can cite",
      "Correct AI inaccuracies with targeted content updates",
    ],
    kpis: [
      { label: "AI citation frequency", value: "+14% MoM", target: "+10–20% MoM" },
      { label: "AI summary accuracy", value: "88%", target: "85–95%" },
      { label: "GEO grid visibility", value: "68% green", target: "60–80% green" },
      { label: "Schema coverage", value: "94%", target: "100% of service pages" },
      { label: "Content freshness", value: "73%", target: "80% updated in 90 days" },
      { label: "GBP engagement", value: "+19% MoM", target: "+15–25% MoM" },
    ],
    dashboard: {
      statusReport: {
        summary:
          "AI engines are citing us correctly for most service queries. Two service pages still return outdated pricing language in AI summaries and are queued for a content refresh this week.",
        stats: [
          { label: "Tracked AI citations", value: "112/mo", target: "vs. 98/mo last month" },
          { label: "Pages with FAQ schema", value: "38 of 42", target: "42 total" },
          { label: "GBP AI Overview appearances", value: "61%", target: "of tracked queries" },
        ],
      },
      suggestions: [
        { title: "Correct outdated pricing language on 2 service pages", priority: "high", detail: "AI Overviews are citing a retired pricing tier." },
        { title: "Add FAQ schema to the remaining 4 service pages", priority: "medium", detail: "Closes the schema coverage gap to 100%." },
        { title: "Refresh the Compliance IT page (last updated 118 days ago)", priority: "medium", detail: "Past the 90-day freshness target." },
      ],
      tracker: [
        { label: "Q3 AI-engine content refresh (12 pages)", percentComplete: 75 },
        { label: "GEO grid expansion to 2 new metros", percentComplete: 30 },
        { label: "Review response schema rollout", percentComplete: 100 },
      ],
    },
  },
  {
    slug: "blogging-content",
    number: 3,
    phase: 1,
    title: "Blogging & Content Development",
    icon: "pen-tool",
    responsible: "Claude & Lance",
    status: "on_track",
    headline: { label: "Blogs published", value: "3/mo" },
    duties: [
      "Monthly blog calendar",
      "2–4 SEO + GEO optimized blogs",
      "Industry-specific, ICP-aligned content",
      "Internal linking to service pages",
      "AI-friendly formatting (definitions, lists, FAQs)",
    ],
    kpis: [
      { label: "Blogs published", value: "3/mo", target: "2–4/mo" },
      { label: "Organic blog traffic", value: "+14%", target: "+10–20%" },
      { label: "Inbound leads from content", value: "1/mo", target: "1–2/mo" },
      { label: "New keywords ranking per blog", value: "7", target: "5–10" },
    ],
  },
  {
    slug: "social-media",
    number: 4,
    phase: 1,
    title: "Social Media Posting & Connections",
    icon: "share2",
    status: "needs_attention",
    headline: { label: "Posts this month", value: "6 of 8–12" },
    duties: [
      "Weekly posting schedule",
      "AI-personalized content",
      "LinkedIn connection strategy",
      "Thought leadership posts",
      "Engagement with ICP prospects",
    ],
    kpis: [
      { label: "Posts per month", value: "6", target: "8–12" },
      { label: "New connections", value: "+38/mo", target: "+50–100/mo" },
      { label: "Engagement increase", value: "+6%", target: "+10–20%" },
      { label: "Inbound conversations", value: "1/mo", target: "1–3/mo" },
    ],
  },
  {
    slug: "website-oversight",
    number: 5,
    phase: 1,
    title: "Website Oversight & Optimization",
    icon: "layout",
    responsible: "Claude & Lance",
    status: "on_track",
    headline: { label: "Conversion rate", value: "2.6%" },
    duties: [
      "UX review & improvements",
      "Conversion optimization (CTAs, forms, layout)",
      "Landing page creation",
      "Form optimization & testing",
      "Speed and mobile performance improvements",
    ],
    kpis: [
      { label: "Website conversion rate", value: "2.6%", target: "2–4%" },
      { label: "Bounce rate reduction", value: "12%", target: "10–20%" },
      { label: "New landing pages", value: "1/mo", target: "1–2/mo" },
      { label: "Time on page increase", value: "+9%", target: "+10–15%" },
    ],
  },
  {
    slug: "icp-development",
    number: 6,
    phase: 2,
    title: "ICP Development & Targeting Strategy",
    icon: "target",
    status: "ahead",
    headline: { label: "ICP status", value: "Finalized" },
    duties: [
      "Define ICPs (industry, size, tech stack, geography)",
      "Pain point mapping",
      "Messaging alignment",
      "Value proposition refinement",
    ],
    kpis: [
      { label: "ICP finalized", value: "Month 1", target: "by Month 1" },
      { label: "Messaging frameworks created", value: "4", target: "3–5" },
      { label: "Outbound response rate increase", value: "+22%", target: "+20%" },
    ],
  },
  {
    slug: "list-building",
    number: 7,
    phase: 2,
    title: "List Building & Data Acquisition",
    icon: "database",
    status: "on_track",
    headline: { label: "New contacts", value: "1,120/mo" },
    duties: [
      "Prospect list creation",
      "Data enrichment & scrubbing",
      "Intent data integration (SniperLeads)",
      "Segmentation by ICP",
    ],
    kpis: [
      { label: "New contacts added", value: "1,120/mo", target: "500–1,500/mo" },
      { label: "Email deliverability", value: "93%", target: "90%+" },
      { label: "List showing intent signals", value: "12%", target: "10–15%" },
    ],
  },
  {
    slug: "email-campaigning",
    number: 8,
    phase: 2,
    title: "Email Campaigning & Nurture Sequences",
    icon: "mail",
    budgetNote: "Estimated Monthly Budget: CRO Leader + SDR",
    status: "on_track",
    headline: { label: "Reply rate", value: "10.5%" },
    duties: [
      "Cold outreach sequences",
      "Warm nurture sequences",
      "A/B testing",
      "Deliverability optimization",
      "Personalization at scale",
    ],
    kpis: [
      { label: "Open rate", value: "52%", target: "40–60%" },
      { label: "Reply rate", value: "10.5%", target: "8–15%" },
      { label: "Meetings booked", value: "3/mo", target: "2–5/mo" },
    ],
  },
  {
    slug: "crm-administration",
    number: 9,
    phase: 2,
    title: "CRM Administration & Optimization",
    icon: "settings",
    status: "on_track",
    headline: { label: "Data accuracy", value: "96%" },
    duties: [
      "Pipeline configuration",
      "Automation setup",
      "Reporting dashboards",
      "Data hygiene",
      "Lifecycle stage definitions",
    ],
    kpis: [
      { label: "Data accuracy", value: "96%", target: "95%+" },
      { label: "Opportunities in correct stage", value: "100%", target: "100%" },
      { label: "Weekly reporting on time", value: "On time", target: "100%" },
    ],
  },
  {
    slug: "pipeline-metrics",
    number: 10,
    phase: 2,
    title: "Opportunity Pipeline Metrics & Oversight",
    icon: "trending-up",
    status: "needs_attention",
    headline: { label: "Deal velocity", value: "+8%" },
    duties: ["Stage definitions", "Conversion tracking", "Deal velocity reporting", "Forecasting"],
    kpis: [
      { label: "Deal velocity improvement", value: "+8%", target: "+10–20%" },
      { label: "Active deals updated weekly", value: "94%", target: "100%" },
    ],
  },
  {
    slug: "reviews-testimonials",
    number: 11,
    phase: 3,
    title: "Reviews & Testimonies",
    icon: "star",
    responsible: "Lance & Vernon",
    status: "on_track",
    headline: { label: "New reviews", value: "4/mo" },
    duties: [
      "Review acquisition program",
      "Testimonial collection",
      "Case study development",
      "Video testimonials (optional)",
    ],
    kpis: [
      { label: "New Google reviews", value: "4/mo", target: "3–5/mo" },
      { label: "New case studies", value: "1/qtr", target: "1/qtr" },
      { label: "Testimonials collected", value: "5/qtr", target: "4–6/qtr" },
    ],
  },
  {
    slug: "events",
    number: 12,
    phase: 3,
    title: "Events (Virtual & In-Person)",
    icon: "calendar-days",
    responsible: "Lance & Vernon",
    status: "ahead",
    headline: { label: "Leads per event", value: "38" },
    duties: [
      "Event selection (webinars, tradeshows, lunch & learns)",
      "Booth strategy & materials",
      "Pre-event outreach",
      "Post-event follow-up sequences",
    ],
    kpis: [
      { label: "Events per quarter", value: "2", target: "1–2/qtr" },
      { label: "Leads per event", value: "38", target: "20–50" },
      { label: "Meetings booked per event", value: "4", target: "3–5" },
    ],
  },
  {
    slug: "sdr-outreach",
    number: 13,
    phase: 4,
    title: "SDR Outreach (Internal or Outsourced)",
    icon: "phone",
    responsible: "CRO Leader Team, SDR & Vernon",
    status: "on_track",
    headline: { label: "Calls / day", value: "58" },
    duties: [
      "Cold calling",
      "Follow-up calls",
      "Appointment setting",
      "Script development",
      "Daily activity tracking",
    ],
    kpis: [
      { label: "Calls per day", value: "58", target: "40–80" },
      { label: "Conversations per day", value: "7", target: "5–10" },
      { label: "Meetings booked per quarter", value: "18", target: "12–24" },
      { label: "Show rate improvement", value: "+24%", target: "+20–30%" },
    ],
  },
  {
    slug: "sales-enablement",
    number: 14,
    phase: 4,
    title: "Sales Enablement & Support",
    icon: "clipboard-check",
    responsible: "CRO Leader Team & Vernon",
    status: "on_track",
    headline: { label: "Proposals on time", value: "100%" },
    duties: [
      "Scripts",
      "Objection handling",
      "Proposal templates",
      "Follow-up sequences",
      "Competitive positioning",
    ],
    kpis: [
      { label: "Reps using approved scripts", value: "100%", target: "100%" },
      { label: "Close rate improvement", value: "+17%", target: "+20%" },
      { label: "Proposals within 48 hours", value: "100%", target: "100%" },
    ],
  },
];

export function getPlaybookStep(slug: string): PlaybookStep | undefined {
  return PLAYBOOK_STEPS.find((s) => s.slug === slug);
}

export function getPhaseName(phase: 1 | 2 | 3 | 4): string {
  return PLAYBOOK_PHASES.find((p) => p.phase === phase)?.name ?? "";
}
