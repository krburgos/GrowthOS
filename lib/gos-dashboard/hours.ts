/**
 * GOS Dashboard hours (client-confirmed, 2026-09-17). "Needed" spans the
 * whole workstream; "committed" and "achieved" belong to the current
 * calendar quarter (gos_dashboard_quarter_hours, Backend Schema §6.6c).
 */

export interface StepHours {
  needed: number;
  committed: number;
  achieved: number;
  outsourced: boolean;
}

export const EMPTY_HOURS: StepHours = { needed: 0, committed: 0, achieved: 0, outsourced: false };

/** Card titles are the short names ("SEO"); the detail page keeps the doc's full step title. */
export const SHORT_TITLE: Record<string, string> = {
  seo: "SEO",
  geo: "GEO",
  "blogging-content": "Blogging & Content",
  "social-media": "Social Media",
  "website-oversight": "Website Optimization",
  "icp-development": "ICP Development",
  "list-building": "List Building",
  "email-campaigning": "Email Campaigns",
  "crm-administration": "CRM Administration",
  "pipeline-metrics": "Pipeline Metrics",
  "reviews-testimonials": "Reviews & Testimonials",
  events: "Events",
  "sdr-outreach": "SDR Outreach",
  "sales-enablement": "Sales Enablement",
};

export const HOURS_EDIT_ROLES = ["msp_owner", "msp_admin", "cro_admin", "cro_advisor"];

export interface QuarterInfo {
  /** ISO date of the quarter's first day, the gos_dashboard_quarter_hours key. */
  start: string;
  label: string;
  range: string;
  elapsedPct: number;
}

export function currentQuarter(now = new Date()): QuarterInfo {
  const year = now.getUTCFullYear();
  const q = Math.floor(now.getUTCMonth() / 3);
  const start = new Date(Date.UTC(year, q * 3, 1));
  const end = new Date(Date.UTC(year, q * 3 + 3, 0));
  const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const elapsedDays = Math.floor((now.getTime() - start.getTime()) / 86400000) + 1;
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return {
    start: start.toISOString().slice(0, 10),
    label: `Q${q + 1} ${year}`,
    range: `${fmt(start)} – ${fmt(end)}`,
    elapsedPct: Math.min(100, Math.round((elapsedDays / totalDays) * 100)),
  };
}

export function quarterPct(h: Pick<StepHours, "committed" | "achieved">): number {
  return h.committed > 0 ? Math.round((h.achieved / h.committed) * 100) : 0;
}

/** Amber when well behind the quarter's pace, green once past the commitment. */
export function paceTone(pct: number, elapsedPct: number): "over" | "behind" | "normal" {
  if (pct > 100) return "over";
  if (pct < elapsedPct - 20) return "behind";
  return "normal";
}

export function formatHours(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}
