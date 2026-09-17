/**
 * The Playbook doc's "GrowthOS KPI dashboard" band (client-confirmed,
 * 2026-09-17): Prospects (MQCs, MQLs) and Opportunities in Pipeline
 * (Interested, Engaged, Ghosted, Quoted, Won, Lost), counted live from the
 * account's contacts and opportunities. "Engaged" counts contacts with the
 * Engaged status, since that's how the CRM uses it (client-confirmed).
 */

export type KpiBoxKey = "mqc" | "mql" | "interested" | "engaged" | "ghosted" | "quoted" | "won" | "lost";
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
  { key: "engaged", label: "Engaged", group: "pipeline" },
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
    if (n === "engaged") return "engaged";
    return null;
  }
  if (stageGroup === "won") return "won";
  if (stageGroup === "lost") return "lost";
  if (n.includes("ghost")) return "ghosted";
  if (n.includes("quote") || n.includes("proposal")) return "quoted";
  if (n.includes("interest")) return "interested";
  return null;
}

export function boxTotal(sources: KpiSource[], key: KpiBoxKey): number {
  return sources.filter((s) => s.box === key).reduce((sum, s) => sum + s.count, 0);
}

/** Which box each kind of source is allowed to feed. */
export function boxAcceptsKind(key: KpiBoxKey, kind: SourceKind): boolean {
  const contactBoxes: KpiBoxKey[] = ["mqc", "mql", "engaged"];
  return kind === "contact_status" ? contactBoxes.includes(key) : !contactBoxes.includes(key);
}
