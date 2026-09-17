/**
 * GOS Dashboard hours + KPI band mockup (branch-only, 2026-09-17). Sample
 * data only — nothing here reads or writes the database. Edits made in the
 * UI persist to the viewer's localStorage so the mockup feels real across
 * page navigation, and "Reset sample data" restores these defaults.
 */

export interface StepHours {
  needed: number;
  committed: number;
  achieved: number;
  outsourced: boolean;
}

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

export const DEFAULT_HOURS: Record<string, StepHours> = {
  seo: { needed: 120, committed: 40, achieved: 28, outsourced: false },
  geo: { needed: 90, committed: 30, achieved: 24, outsourced: false },
  "blogging-content": { needed: 160, committed: 36, achieved: 33, outsourced: false },
  "social-media": { needed: 80, committed: 24, achieved: 10, outsourced: true },
  "website-oversight": { needed: 100, committed: 30, achieved: 26, outsourced: false },
  "icp-development": { needed: 40, committed: 12, achieved: 12, outsourced: false },
  "list-building": { needed: 60, committed: 20, achieved: 18, outsourced: true },
  "email-campaigning": { needed: 110, committed: 32, achieved: 27, outsourced: false },
  "crm-administration": { needed: 70, committed: 18, achieved: 16, outsourced: false },
  "pipeline-metrics": { needed: 50, committed: 16, achieved: 7, outsourced: false },
  "reviews-testimonials": { needed: 45, committed: 12, achieved: 11, outsourced: false },
  events: { needed: 90, committed: 30, achieved: 31, outsourced: false },
  "sdr-outreach": { needed: 240, committed: 96, achieved: 79, outsourced: true },
  "sales-enablement": { needed: 60, committed: 18, achieved: 16, outsourced: false },
};

export function currentQuarter(now = new Date()) {
  const q = Math.floor(now.getMonth() / 3);
  const start = new Date(now.getFullYear(), q * 3, 1);
  const end = new Date(now.getFullYear(), q * 3 + 3, 0);
  const totalDays = (end.getTime() - start.getTime()) / 86400000 + 1;
  const elapsedDays = Math.floor((now.getTime() - start.getTime()) / 86400000) + 1;
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return {
    label: `Q${q + 1} ${now.getFullYear()}`,
    range: `${fmt(start)} – ${fmt(end)}`,
    elapsedPct: Math.min(100, Math.round((elapsedDays / totalDays) * 100)),
  };
}

export function quarterPct(h: StepHours): number {
  return h.committed > 0 ? Math.round((h.achieved / h.committed) * 100) : 0;
}

/** Amber well behind the quarter's pace, green once past the commitment. */
export function paceTone(pct: number, elapsedPct: number): "over" | "behind" | "normal" {
  if (pct > 100) return "over";
  if (pct < elapsedPct - 20) return "behind";
  return "normal";
}

// ---- KPI band (the Playbook doc's "GrowthOS KPI dashboard" image) ----

export type SourceKind = "contact_status" | "opportunity_stage";

export interface KpiSource {
  id: string;
  kind: SourceKind;
  name: string;
  count: number;
}

/** The CRO Leader account's real contact statuses and opportunity stages, with sample counts. */
export const KPI_SOURCES: KpiSource[] = [
  { id: "cs-mqc", kind: "contact_status", name: "MQC", count: 1574 },
  { id: "cs-mql", kind: "contact_status", name: "MQL", count: 488 },
  { id: "cs-scrub", kind: "contact_status", name: "Scrub", count: 312 },
  { id: "cs-existing", kind: "contact_status", name: "Existing Client", count: 96 },
  { id: "cs-engaged", kind: "contact_status", name: "Engaged", count: 24 },
  { id: "cs-notfit", kind: "contact_status", name: "Not a Fit", count: 58 },
  { id: "cs-sniper", kind: "contact_status", name: "SNIPER", count: 141 },
  { id: "os-interest", kind: "opportunity_stage", name: "Showing Interest", count: 77 },
  { id: "os-m1s", kind: "opportunity_stage", name: "1st Meeting Scheduled", count: 14 },
  { id: "os-m1a", kind: "opportunity_stage", name: "1st Meeting Attended", count: 11 },
  { id: "os-m2s", kind: "opportunity_stage", name: "2nd Meeting Scheduled", count: 8 },
  { id: "os-m2c", kind: "opportunity_stage", name: "2nd Meeting Conducted", count: 6 },
  { id: "os-oppid", kind: "opportunity_stage", name: "Opportunity Identified", count: 9 },
  { id: "os-sow", kind: "opportunity_stage", name: "Opportunity SOW Completed", count: 4 },
  { id: "os-quote", kind: "opportunity_stage", name: "Solution Quote Prepared", count: 9 },
  { id: "os-presented", kind: "opportunity_stage", name: "Proposal Presented", count: 7 },
  { id: "os-emailed", kind: "opportunity_stage", name: "Proposal Emailed", count: 5 },
  { id: "os-pmeet", kind: "opportunity_stage", name: "Proposal Meeting Scheduled", count: 3 },
  { id: "os-ponder", kind: "opportunity_stage", name: "Pondering Decision", count: 4 },
  { id: "os-verbal", kind: "opportunity_stage", name: "Verbal Acceptance", count: 2 },
  { id: "os-ghosted", kind: "opportunity_stage", name: "Ghosted", count: 17 },
  { id: "os-won", kind: "opportunity_stage", name: "Won", count: 12 },
  { id: "os-lost", kind: "opportunity_stage", name: "Lost", count: 3 },
  { id: "os-lostres", kind: "opportunity_stage", name: "Lost Resurrected", count: 1 },
];

export type KpiBoxKey = "mqc" | "mql" | "interested" | "engaged" | "ghosted" | "quoted" | "won" | "lost";

export interface KpiBox {
  key: KpiBoxKey;
  label: string;
  group: "prospects" | "pipeline";
  tone?: "won" | "lost" | "ghosted";
}

export const KPI_BOXES: KpiBox[] = [
  { key: "mqc", label: "MQCs", group: "prospects" },
  { key: "mql", label: "MQLs", group: "prospects" },
  { key: "interested", label: "Interested", group: "pipeline" },
  { key: "engaged", label: "Engaged", group: "pipeline" },
  { key: "ghosted", label: "Ghosted", group: "pipeline", tone: "ghosted" },
  { key: "quoted", label: "Quoted", group: "pipeline" },
  { key: "won", label: "Won", group: "pipeline", tone: "won" },
  { key: "lost", label: "Lost", group: "pipeline", tone: "lost" },
];

/** Pre-filled by name matching; CRO Admin can adjust it per account. */
export const DEFAULT_MAPPING: Record<KpiBoxKey, string[]> = {
  mqc: ["cs-mqc"],
  mql: ["cs-mql"],
  interested: ["os-interest"],
  engaged: ["cs-engaged"],
  ghosted: ["os-ghosted"],
  quoted: ["os-quote", "os-presented", "os-emailed"],
  won: ["os-won"],
  lost: ["os-lost", "os-lostres"],
};

export const SOURCE_BY_ID = new Map(KPI_SOURCES.map((s) => [s.id, s]));

const FIRST = ["Maria", "James", "Priya", "Daniel", "Aisha", "Tom", "Keiko", "Luis", "Grace", "Omar", "Hannah", "Victor"];
const LAST = ["Alvarez", "Chen", "Patel", "Brooks", "Okafor", "Reilly", "Tanaka", "Moreno", "Whitfield", "Haddad", "Larsen", "Nguyen"];
const COMPANIES = ["Harbor Dental Group", "Summit Legal Partners", "Blue Ridge Clinics", "Keystone Logistics", "Northgate CPA", "Riverbend Schools", "Pinnacle Realty", "Cedar Health", "Atlas Manufacturing", "Lakeside Credit Union"];

export interface SampleRecord {
  name: string;
  company: string;
  source: string;
  detail: string;
}

/** Deterministic sample rows for a box's drill-down dialog. */
export function sampleRecords(sourceIds: string[], limit = 8): SampleRecord[] {
  const rows: SampleRecord[] = [];
  let i = 0;
  for (const id of sourceIds) {
    const src = SOURCE_BY_ID.get(id);
    if (!src) continue;
    for (let n = 0; n < Math.min(src.count, limit) && rows.length < limit; n++, i++) {
      const company = COMPANIES[(i * 7 + id.length) % COMPANIES.length];
      rows.push({
        name:
          src.kind === "contact_status"
            ? `${FIRST[(i * 5 + 3) % FIRST.length]} ${LAST[(i * 3 + id.length) % LAST.length]}`
            : `${company} — Managed IT`,
        company,
        source: src.name,
        detail:
          src.kind === "contact_status"
            ? `Updated ${((i * 3) % 27) + 1}d ago`
            : `$${(((i * 13) % 9) + 2) * 1200}/mo · ${((i * 4) % 40) + 2}d in stage`,
      });
    }
  }
  return rows;
}
