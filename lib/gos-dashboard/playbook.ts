/**
 * GrowthOS Dashboard (GOS Dashboard) — client-confirmed addition
 * (2026-09-16). Sourced from "GrowthOS Playbook - Dev Plan.docx", then
 * extended by the client on 2026-10-05 to sixteen workstreams with the
 * four phases dropped: the new order interleaved them, so a step header
 * would have read "Step 12 · Phase 4" above "Step 14 · Phase 3". The 1–16
 * order is the structure now. Originally
 * 14 numbered steps, each with its own Duties and KPIs. The doc only
 * spells out a "GrowthOS Dashboard" sub-shape (status report,
 * suggestions/fixes list, progress tracker) for step 1 (SEO) and step 2
 * (GEO) — client-confirmed (2026-09-16) the other 12 steps stay simpler
 * (Duties + KPIs only, no report/suggestions/tracker tabs).
 *
 * This file holds only the static shape of the 14 steps — identity, title,
 * icon, duties, and which steps get the SEO/GEO 3-tab treatment.
 * The per-account values (status, headline stat, KPIs, status report
 * summary, suggestions, tracker progress) live in the `gos_dashboard_*`
 * tables (Backend Schema §6.6c) and are read via lib/gos-dashboard/queries.ts
 * — the same "structure in code, data in DB" split used by
 * lib/questionnaire/questions.ts and lib/vision-board/sections.ts.
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
  | "clipboard-check"
  | "map-pin";

export interface PlaybookShape {
  slug: string;
  number: number;
  title: string;
  icon: IconKey;
  responsible?: string;
  budgetNote?: string;
  duties: string[];
  hasDashboardShape?: boolean;
}


export const PLAYBOOK_STEPS: PlaybookShape[] = [
  {
    slug: "seo",
    number: 1,
    title: "SEO — Search Engine Optimization",
    icon: "search",
    duties: [
      "Full SEO audit (technical, on-page, off-page)",
      "Keyword strategy aligned to ICP",
      "On-page optimization (titles, headers, metadata, internal links)",
      "Technical SEO fixes (speed, indexing, schema, mobile)",
      "Backlink strategy (authority building)",
      "Local SEO optimization (GBP, citations, NAP consistency)",
      "Monthly SEO reporting & insights",
    ],
    hasDashboardShape: true,
  },
  {
    slug: "geo",
    number: 2,
    title: "GEO — Generative Engine Optimization",
    icon: "sparkles",
    responsible: "Claude, Lance & Vernon",
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
    hasDashboardShape: true,
  },
  {
    slug: "blogging-content",
    number: 3,
    title: "Blogging & Content Development",
    icon: "pen-tool",
    responsible: "Claude & Lance",
    duties: [
      "Monthly blog calendar",
      "2–4 SEO + GEO optimized blogs",
      "Industry-specific, ICP-aligned content",
      "Internal linking to service pages",
      "AI-friendly formatting (definitions, lists, FAQs)",
    ],
  },
  {
    slug: "social-media-marketing",
    number: 4,
    title: "Social Media Marketing",
    icon: "share2",
    duties: [
      "Weekly posting schedule",
      "AI-personalized content",
      "LinkedIn connection strategy",
      "Thought leadership posts",
      "Engagement with ICP prospects",
    ],
  },
  {
    slug: "website-oversight",
    number: 5,
    title: "Website Oversight & Optimization",
    icon: "layout",
    responsible: "Claude & Lance",
    duties: [
      "UX review & improvements",
      "Conversion optimization (CTAs, forms, layout)",
      "Landing page creation",
      "Form optimization & testing",
      "Speed and mobile performance improvements",
    ],
  },
  {
    slug: "icp-development",
    number: 6,
    title: "ICP Development & Targeting Strategy",
    icon: "target",
    duties: [
      "Define ICPs (industry, size, tech stack, geography)",
      "Pain point mapping",
      "Messaging alignment",
      "Value proposition refinement",
    ],
  },
  {
    slug: "list-building",
    number: 7,
    title: "List Building & Data Acquisition",
    icon: "database",
    duties: [
      "Prospect list creation",
      "Data enrichment & scrubbing",
      "Intent data integration (SniperLeads)",
      "Segmentation by ICP",
    ],
  },
  {
    slug: "crm-administration",
    number: 8,
    title: "CRM Administration & Optimization",
    icon: "settings",
    duties: [
      "Pipeline configuration",
      "Automation setup",
      "Reporting dashboards",
      "Data hygiene",
      "Lifecycle stage definitions",
    ],
  },
  {
    slug: "opportunities-pipeline",
    number: 9,
    title: "Opportunities — Pipeline",
    icon: "trending-up",
    duties: ["Stage definitions", "Conversion tracking", "Deal velocity reporting", "Forecasting"],
  },
  {
    slug: "email-campaigning",
    number: 10,
    title: "Email Campaigning & Nurture Sequences",
    icon: "mail",
    budgetNote: "Estimated Monthly Budget: CRO Leader + SDR",
    duties: [
      "Cold outreach sequences",
      "Warm nurture sequences",
      "A/B testing",
      "Deliverability optimization",
      "Personalization at scale",
    ],
  },
  {
    slug: "social-communication",
    number: 11,
    title: "Social Media Invites & Communication",
    icon: "phone",
    duties: [
      "Connection and invite strategy by platform",
      "Personalised invite copy per ICP segment",
      "Follow-up message sequences after a connection is accepted",
      "Daily invite and reply volume tracking",
      "Social listening on ICP accounts and competitors",
      "Handover of warm conversations to the SDR",
    ],
  },
  {
    slug: "sdr-outreach",
    number: 12,
    title: "SDR Outreach (Internal or Outsourced)",
    icon: "phone",
    responsible: "CRO Leader Team, SDR & Vernon",
    duties: [
      "Cold calling",
      "Follow-up calls",
      "Appointment setting",
      "Script development",
      "Daily activity tracking",
    ],
  },
  {
    slug: "advocate-dash",
    number: 13,
    title: "AdvocateDash",
    icon: "map-pin",
    /**
     * Shipped empty on 2026-10-05 pending the client's own material, which
     * arrived the same day: "AdvocateDash Dropby letter.docx" (the personal
     * note left in the package) and "Victory Visit Report.pdf" (a completed
     * VictoryVisit After-Action Report for ABTech - Boston). These duties
     * are read off those two documents — the pre-visit checklist, the
     * report's own sections, and its Follow-Up Recommendation — rather than
     * from the Playbook doc, which predates this workstream.
     */
    duties: [
      "Target account selection and Map Plan per visit run",
      "VictoryVisit package assembly (personal note, brochure, gift, treats)",
      "Advocate pre-visit checklist (account review, materials, GPS route)",
      "In-person drop-by visits to target accounts",
      "Location verification (exterior photo, signage, building directory, GPS)",
      "Business and technology intelligence capture (incumbent IT, headcount, estate observed)",
      "VictoryVisit After-Action Report filed per visit",
      "Follow-up sequence inside 2 business days (personal email, SDR call, LinkedIn request)",
      "Repeat visit cadence on accounts still in play",
    ],
  },
  {
    slug: "reviews-testimonials",
    number: 14,
    title: "Reviews & Testimonies",
    icon: "star",
    responsible: "Lance & Vernon",
    duties: [
      "Review acquisition program",
      "Testimonial collection",
      "Case study development",
      "Video testimonials (optional)",
    ],
  },
  {
    slug: "events",
    number: 15,
    title: "Events (Virtual & In-Person)",
    icon: "calendar-days",
    responsible: "Lance & Vernon",
    duties: [
      "Event selection (webinars, tradeshows, lunch & learns)",
      "Booth strategy & materials",
      "Pre-event outreach",
      "Post-event follow-up sequences",
    ],
  },
  {
    slug: "sales-enablement",
    number: 16,
    title: "Sales Enablement & Support",
    icon: "clipboard-check",
    responsible: "CRO Leader Team & Vernon",
    duties: [
      "Scripts",
      "Objection handling",
      "Proposal templates",
      "Follow-up sequences",
      "Competitive positioning",
    ],
  },
];

export function getPlaybookStep(slug: string): PlaybookShape | undefined {
  return PLAYBOOK_STEPS.find((s) => s.slug === slug);
}
