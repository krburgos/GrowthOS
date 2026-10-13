/**
 * Mission Progress (client-confirmed, 2026-10-13), formerly the Playbook
 * doc's "GrowthMission KPI dashboard" band: Prospects and Opportunities,
 * counted live from the account's contacts and opportunities.
 *
 * Prospects is unchanged - MQCs and MQLs by contact status. Opportunities
 * is regrouped, and Active moves to the front:
 *
 *   Active       every opportunity, won and lost included
 *   Interested   Showing Interest
 *   In progress  FME Scheduled through Quote/Solution Prepared, + Ghosted
 *   Quoted       Proposal Emailed, Proposal Presented, Pondering Decision
 *   Won          Verbal, Won
 *
 * Lost and Lost Resurrected count toward Active only. These are fixed
 * rules now: the per-account "Edit mapping" dialog is retired in the same
 * change, and a stage an account adds under its own name counts toward
 * Active without landing in any other box.
 *
 * (History: the Engaged box and contact status were retired on
 * 2026-09-24; the 'engaged' value stays in the growth_mission_kpi_box
 * enum only because removing an enum value in Postgres is a rewrite.)
 */

export type KpiBoxKey = "mqc" | "mql" | "active" | "interested" | "in_progress" | "quoted" | "won";
export type SourceKind = "contact_status" | "opportunity_stage";

export interface KpiBox {
  key: KpiBoxKey;
  label: string;
  group: "prospects" | "pipeline";
  /** What the figure counts, shown in its info tooltip. */
  tip: string;
  tone?: "won" | "active";
}

export const KPI_BOXES: KpiBox[] = [
  { key: "mqc", label: "MQCs", group: "prospects", tip: "Contacts with the MQC status." },
  { key: "mql", label: "MQLs", group: "prospects", tip: "Contacts with the MQL status." },
  { key: "active", label: "Active", group: "pipeline", tone: "active", tip: "Every opportunity, including won and lost." },
  { key: "interested", label: "Interested", group: "pipeline", tip: "Opportunities at Showing Interest." },
  {
    key: "in_progress",
    label: "In progress",
    group: "pipeline",
    tip: "FME Scheduled through Quote/Solution Prepared, plus Ghosted.",
  },
  { key: "quoted", label: "Quoted", group: "pipeline", tip: "Proposal Emailed, Proposal Presented and Pondering Decision." },
  { key: "won", label: "Won", group: "pipeline", tone: "won", tip: "Verbal and Won." },
];

export interface KpiSource {
  id: string;
  kind: SourceKind;
  name: string;
  stageGroup?: string;
  count: number;
  /** The one box this source feeds besides Active, if any. */
  box: KpiBoxKey | null;
}

const STAGE_BOX: Record<string, KpiBoxKey> = {
  "showing interest": "interested",
  "fme scheduled": "in_progress",
  "fme attended opportunity identified": "in_progress",
  "2nd meeting scheduled": "in_progress",
  "2nd meeting conducted": "in_progress",
  "quote/solution prepared": "in_progress",
  ghosted: "in_progress",
  "proposal emailed": "quoted",
  "proposal presented": "quoted",
  "pondering decision": "quoted",
  verbal: "won",
  won: "won",
};

/** Which box a status or stage feeds, by its name. */
export function boxFor(kind: SourceKind, name: string, stageGroup?: string): KpiBoxKey | null {
  const n = name.trim().toLowerCase();
  if (kind === "contact_status") {
    if (n === "mqc") return "mqc";
    if (n === "mql") return "mql";
    return null;
  }
  return STAGE_BOX[n] ?? (stageGroup === "won" ? "won" : null);
}

/** The sources a box counts. Active counts every opportunity stage. */
export function sourcesInBox(sources: KpiSource[], key: KpiBoxKey): KpiSource[] {
  return key === "active"
    ? sources.filter((s) => s.kind === "opportunity_stage")
    : sources.filter((s) => s.box === key);
}

export function boxTotal(sources: KpiSource[], key: KpiBoxKey): number {
  return sourcesInBox(sources, key).reduce((sum, s) => sum + s.count, 0);
}
