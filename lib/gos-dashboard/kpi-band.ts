/**
 * The Playbook doc's "GrowthOS KPI dashboard" band (client-confirmed,
 * 2026-09-17): Prospects and Opportunities, counted live from the account's
 * contacts and opportunities.
 *
 * Client-confirmed (2026-09-22): the two halves split by what they count
 * rather than by how the source doc drew them - Prospects holds the boxes
 * fed by contact statuses, Opportunities the ones fed by opportunity
 * stages. That makes the grouping agree with boxAcceptsKind() below, which
 * already drew the line in the same place.
 *
 * Client-confirmed (2026-09-24): the Engaged box is gone, and with it the
 * Engaged contact status, which was retired from every account in the same
 * change (contacts on it moved to MQC - see the
 * retire_engaged_contact_status migration). Prospects is therefore MQCs and
 * MQLs. The 'engaged' value stays in the gos_dashboard_kpi_box enum because
 * removing an enum value in Postgres is a rewrite, and nothing references
 * it: no account had ever mapped a status to that box.
 */

export type KpiBoxKey = "mqc" | "mql" | "interested" | "ghosted" | "quoted" | "won" | "lost";
export type SourceKind = "contact_status" | "opportunity_stage";

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
  { key: "ghosted", label: "Ghosted", group: "pipeline", tone: "ghosted" },
  { key: "quoted", label: "Quoted", group: "pipeline" },
  { key: "won", label: "Won", group: "pipeline", tone: "won" },
  { key: "lost", label: "Lost", group: "pipeline", tone: "lost" },
];

export interface KpiSource {
  id: string;
  kind: SourceKind;
  name: string;
  stageGroup?: string;
  count: number;
  box: KpiBoxKey | null;
}

/** Name-matching default used until a CRO Leader saves a mapping for the account. */
export function defaultBoxFor(kind: SourceKind, name: string, stageGroup?: string): KpiBoxKey | null {
  const n = name.trim().toLowerCase();
  if (kind === "contact_status") {
    if (n === "mqc") return "mqc";
    if (n === "mql") return "mql";
    return null;
  }
  if (stageGroup === "won") return "won";
  if (stageGroup === "lost") return "lost";
  if (n.includes("ghost")) return "ghosted";
  if (n.includes("quote") || n.includes("proposal")) return "quoted";
  if (n.includes("interest")) return "interested";
  return null;
}

/**
 * The "Current Active Opportunities" figure (client-confirmed, 2026-09-22):
 * every opportunity whose stage is still open, which is all of them except
 * Won, Lost and Lost Resurrected - the three stages in the won/lost groups.
 * It counts stages directly rather than boxes, so opportunities parked in a
 * stage no box displays are still in the total; that is deliberate, and it
 * means the figure can exceed what the visible boxes add up to.
 */
export function activeOpportunities(sources: KpiSource[]): number {
  return sources
    .filter((s) => s.kind === 'opportunity_stage' && s.stageGroup === 'open')
    .reduce((sum, s) => sum + s.count, 0);
}

export function boxTotal(sources: KpiSource[], key: KpiBoxKey): number {
  return sources.filter((s) => s.box === key).reduce((sum, s) => sum + s.count, 0);
}

/** Which box each kind of source is allowed to feed. */
export function boxAcceptsKind(key: KpiBoxKey, kind: SourceKind): boolean {
  const contactBoxes: KpiBoxKey[] = ["mqc", "mql"];
  return kind === "contact_status" ? contactBoxes.includes(key) : !contactBoxes.includes(key);
}
