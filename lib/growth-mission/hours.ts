/**
 * Mission Capacity hours (client-confirmed, 2026-10-13), replacing the
 * hand-entered "needed / committed / achieved" of 2026-09-17. Every figure
 * is now derived rather than typed:
 *
 *   - required: hours on the mission orders that belong to this quarter
 *     (lib/growth-mission/capacity.ts decides which those are);
 *   - committed: the part of required that has an owner, a roster member
 *     or GrowthMission (2026-10-16; it was the Company Profile's
 *     per-discipline weekly hours x 13 until those were removed);
 *   - completed: hours on mission orders completed this quarter.
 *
 * `outsourced` is still the per-discipline flag in growth_mission_step_hours.
 */

export interface StepHours {
  required: number;
  committed: number;
  completed: number;
  outsourced: boolean;
}

export const EMPTY_HOURS: StepHours = { required: 0, committed: 0, completed: 0, outsourced: false };

/** Card titles are the short names ("SEO"); the detail page keeps the doc's full step title. */
export const SHORT_TITLE: Record<string, string> = {
  seo: "SEO",
  geo: "GEO",
  "blogging-content": "Blogging & Content",
  "social-media-marketing": "Social Media Marketing",
  "website-oversight": "Website Optimization",
  "icp-development": "ICP Development",
  "list-building": "List Building",
  "email-campaigning": "Email Campaigns",
  "crm-administration": "CRM Administration",
  "opportunities-pipeline": "Opportunities — Pipeline",
  "reviews-testimonials": "Reviews & Testimonials",
  events: "Events",
  "sdr-outreach": "SDR Outreach",
  "sales-enablement": "Sales Enablement",
  "social-communication": "Social Communication",
  "advocate-dash": "AdvocateDash",
};

export const HOURS_EDIT_ROLES = ["msp_owner", "msp_admin", "cro_admin", "cro_advisor"];

export interface QuarterInfo {
  /** ISO date of the quarter's first day, the growth_mission_quarter_hours key. */
  start: string;
  /** ISO date of the quarter's last day - a mission order's default due date. */
  end: string;
  /** ISO date of the next quarter's first day, for half-open range checks. */
  nextStart: string;
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
  const nextStart = new Date(Date.UTC(year, q * 3 + 3, 1));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    nextStart: nextStart.toISOString().slice(0, 10),
    label: `Q${q + 1} ${year}`,
    range: `${fmt(start)} – ${fmt(end)}`,
    elapsedPct: Math.min(100, Math.round((elapsedDays / totalDays) * 100)),
  };
}

/**
 * Any quarter, by year and number (1-4), for Reports (client-confirmed,
 * 2026-10-14). `elapsedPct` is measured against the real today, so a
 * closed quarter reads 100 and a future one 0.
 */
export function quarterOf(year: number, q: number, now = new Date()): QuarterInfo {
  const info = currentQuarter(new Date(Date.UTC(year, (q - 1) * 3, 15)));
  const start = Date.UTC(year, (q - 1) * 3, 1);
  const next = Date.UTC(year, q * 3, 1);
  const elapsed = Math.round(((now.getTime() - start) / (next - start)) * 100);
  return { ...info, elapsedPct: Math.max(0, Math.min(100, elapsed)) };
}

/** "2026-Q3", the form a quarter takes in a URL. */
export function quarterKey(q: QuarterInfo): string {
  return `${q.start.slice(0, 4)}-Q${Math.floor(Number(q.start.slice(5, 7)) / 3) + 1}`;
}

/** The quarter a key names, or null when it isn't one. */
export function parseQuarterKey(key: string | undefined | null): QuarterInfo | null {
  const m = key?.match(/^(\d{4})-Q([1-4])$/);
  return m ? quarterOf(Number(m[1]), Number(m[2])) : null;
}

/** The quarter before this one. */
export function previousQuarter(q: QuarterInfo): QuarterInfo {
  const year = Number(q.start.slice(0, 4));
  const n = Math.floor(Number(q.start.slice(5, 7)) / 3) + 1;
  return n === 1 ? quarterOf(year - 1, 4) : quarterOf(year, n - 1);
}

/** For the CRO portfolio, which still reads growth_mission_quarter_hours. */
export function quarterPct(h: { committed: number; achieved: number }): number {
  return h.committed > 0 ? Math.round((h.achieved / h.committed) * 100) : 0;
}

/** Amber when well behind the quarter's pace, green once past the commitment. */
export function paceTone(pct: number, elapsedPct: number): "over" | "behind" | "normal" {
  if (pct > 100) return "over";
  if (pct < elapsedPct - 20) return "behind";
  return "normal";
}

/**
 * Hours and credits totals as whole numbers (client-confirmed, 2026-10-13):
 * Mission Capacity, the Mission Cards, the discipline hours panel and the
 * PDF strip never show ".5". Totals are summed first and rounded once, so
 * rounding never compounds. A single mission order's own hours still use
 * formatHours, where 1.25 is the real size of the job.
 */
export function formatWhole(n: number): string {
  return Math.round(n).toLocaleString();
}

export function formatHours(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Hours are entered in quarter hours (client-confirmed, 2026-10-16,
 * reversing the whole-hours rule of 2026-10-13). A typed value between
 * quarters rounds up, so no estimate shrinks: 1.1 becomes 1.25.
 */
export function roundUpToQuarterHour(value: string | number): number {
  const n = Number(value) || 0;
  return n <= 0 ? 0 : Math.ceil(Math.round(n * 1000) / 250) / 4;
}
