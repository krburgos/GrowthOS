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
  // Client-confirmed (2026-10-14): labelled "Total", because it counts won
  // and lost opportunities too and "Active" read as open ones only. The key
  // stays "active" so nothing that refers to the box changes.
  { key: "active", label: "Total", group: "pipeline", tone: "active", tip: "Every opportunity, including won and lost." },
  { key: "interested", label: "Interested", group: "pipeline", tip: "Opportunities at Showing Interest." },
  {
    key: "in_progress",
    label: "In progress",
    group: "pipeline",
    tip: "From the first meeting scheduled through the solution quote prepared, plus Ghosted.",
  },
  { key: "quoted", label: "Quoted", group: "pipeline", tip: "Proposal emailed or presented, through Pondering Decision." },
  { key: "won", label: "Won", group: "pipeline", tone: "won", tip: "Verbal acceptance and Won." },
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

/**
 * Both the seeded stage names and the renamed set at least one account
 * uses (found live, 2026-10-13: "1st Meeting Scheduled" for "FME
 * Scheduled", "Verbal Acceptance" for "Verbal", and three stages the seed
 * doesn't have). The client's rule is positional - "1st Meeting through
 * Solution Quote Prepared" - so each name is placed by where it sits in
 * that sequence. "Proposal Meeting Scheduled" falls between Proposal
 * Emailed and Pondering Decision, so it counts as Quoted.
 */
const STAGE_BOX: Record<string, KpiBoxKey> = {
  "showing interest": "interested",
  "fme scheduled": "in_progress",
  "1st meeting scheduled": "in_progress",
  "fme attended opportunity identified": "in_progress",
  "1st meeting attended": "in_progress",
  "2nd meeting scheduled": "in_progress",
  "2nd meeting conducted": "in_progress",
  "opportunity identified": "in_progress",
  "opportunity sow completed": "in_progress",
  "quote/solution prepared": "in_progress",
  "solution quote prepared": "in_progress",
  ghosted: "in_progress",
  "proposal emailed": "quoted",
  "proposal presented": "quoted",
  "proposal meeting scheduled": "quoted",
  "pondering decision": "quoted",
  verbal: "won",
  "verbal acceptance": "won",
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
