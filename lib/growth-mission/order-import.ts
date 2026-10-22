import type { ImportField, ImportMapping } from "@/lib/import/fields";
import { roundUpToQuarterHour } from "@/lib/growth-mission/hours";
import type { TaskPriority, TaskState } from "@/lib/growth-mission/tasks";
import { capacityFor } from "@/lib/team/capacity";
import type { TeamMember } from "@/lib/team/members";

/**
 * Importing Mission Orders from a spreadsheet (client-confirmed, 2026-10-20,
 * approved mockup "Import Mission Orders"). On a Mission Card only — never
 * Headquarters or the Command Center — so every row goes to that card.
 *
 * The same four steps as Import Contacts. Errors block the whole file, as
 * they do there; warnings (an owner not on the roster, an owner going over
 * capacity, an order already on the card) explain and let it go ahead.
 */

/**
 * Who may import Mission Orders: CRO Admin only, for now (client-confirmed,
 * 2026-10-22; it was every role that can issue orders). Checked on the
 * Import button, the import page and both import routes. Issuing orders one
 * at a time is unchanged.
 */
export const ORDER_IMPORT_ROLES = ["cro_admin"];

export const ORDER_IMPORT_FIELDS: ImportField[] = [
  { key: "title", label: "Mission Order", required: true, synonyms: ["mission order", "order", "task", "title", "name", "ticket", "mission order name"] },
  { key: "detail", label: "Description", required: false, synonyms: ["description", "detail", "details", "notes"] },
  { key: "priority", label: "Priority", required: false, synonyms: ["priority", "tier"] },
  { key: "owner", label: "Owner", required: false, synonyms: ["owner", "assignee", "assigned to", "assigned", "who"] },
  { key: "state", label: "Status", required: false, synonyms: ["status", "state"] },
  { key: "due", label: "Due", required: false, synonyms: ["due", "due date", "deadline", "date"] },
  { key: "hours", label: "Hours", required: false, synonyms: ["hours", "hrs", "estimate", "hours estimate"] },
];

export interface OrderImportRow {
  rowNumber: number;
  title: string;
  detail: string;
  priority: string;
  owner: string;
  state: string;
  due: string;
  hours: string;
}

export function applyOrderMapping(rows: Record<string, string>[], mapping: ImportMapping): OrderImportRow[] {
  return rows.map((raw, index) => {
    const get = (key: string) => {
      const header = mapping[key];
      return header ? String(raw[header] ?? "").trim() : "";
    };
    return {
      rowNumber: index + 1,
      title: get("title"),
      detail: get("detail"),
      priority: get("priority"),
      owner: get("owner"),
      state: get("state"),
      due: get("due"),
      hours: get("hours"),
    };
  });
}

const PRIORITY_WORDS: Record<string, TaskPriority> = {
  must: "high", high: "high", "1": "high",
  should: "medium", medium: "medium", "2": "medium",
  could: "low", low: "low", "3": "low",
};

const STATE_WORDS: Record<string, TaskState> = {
  active: "active", open: "active", "not started": "active", "to do": "active", todo: "active", new: "active",
  "in progress": "in_progress", "in_progress": "in_progress", doing: "in_progress", started: "in_progress",
  "on hold": "on_hold", "on_hold": "on_hold", hold: "on_hold", paused: "on_hold", blocked: "on_hold",
  complete: "complete", completed: "complete", done: "complete", closed: "complete",
};

const GROWTHMISSION_WORDS = new Set(["growthmission", "growth mission", "gm", "cro leader"]);

const key = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

/** 2026-12-31, 12/31/2026, 12/31/26, or a date Excel wrote out in full; null if it isn't a date. */
export function parseDue(value: string): string | null {
  const v = value.trim();
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (m) return iso(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[1], +m[2]);
  const t = Date.parse(v);
  if (!Number.isNaN(t) && /[a-z]/i.test(v)) return new Date(t).toISOString().slice(0, 10);
  return null;
}

function iso(y: number, mo: number, d: number): string | null {
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

export interface PlannedOrder {
  rowNumber: number;
  title: string;
  detail: string | null;
  priority: TaskPriority;
  state: TaskState;
  due_date: string | null;
  hours: number;
  delegated: boolean;
  assignee_id: string | null;
  /** For the preview: the owner as the app will show it. */
  ownerName: string | null;
}

export interface OrderImportReport {
  errors: { row: number; message: string }[];
  /** Owner names not on the Company Profile, with their rows. */
  unknownOwners: { name: string; rows: number[] }[];
  /** People this file would take past weekly hours x 13. */
  overCapacity: { name: string; assigned: number; quarterly: number }[];
  /** Rows whose name matches an open order already on this card. */
  duplicates: { row: number; title: string }[];
  plan: PlannedOrder[];
}

/**
 * Checks every row and works out what each becomes. Pure: the routes pass
 * in the roster, the hours people already carry and this card's open order
 * names, and run it again on Confirm rather than trusting the browser.
 */
export function planOrderImport(
  rows: OrderImportRow[],
  ctx: { team: TeamMember[]; memberLoad: Record<string, number>; existingTitles: string[]; isCroLeader: boolean }
): OrderImportReport {
  const errors: OrderImportReport["errors"] = [];
  const unknown = new Map<string, { name: string; rows: number[] }>();
  const duplicates: OrderImportReport["duplicates"] = [];
  const plan: PlannedOrder[] = [];
  const byName = new Map(ctx.team.map((m) => [key(m.name), m]));
  const existing = new Set(ctx.existingTitles.map(key));
  const adding: Record<string, number> = {};

  for (const row of rows) {
    const rowErrors: string[] = [];
    if (!row.title) rowErrors.push("Missing required field: Mission Order.");

    const priority = row.priority ? PRIORITY_WORDS[key(row.priority)] : "high";
    if (!priority) rowErrors.push(`Priority must be Must, Should or Could: "${row.priority}"`);

    const state = row.state ? STATE_WORDS[key(row.state)] : "active";
    if (!state) rowErrors.push(`Status must be Active, In progress, On hold or Complete: "${row.state}"`);

    const due = row.due ? parseDue(row.due) : null;
    if (row.due && !due) rowErrors.push(`Due must be a date, like 12/31/2026: "${row.due}"`);

    const hoursNumber = row.hours ? Number(row.hours.replace(/[^\d.]/g, "")) : 0;
    if (row.hours && (!/\d/.test(row.hours) || Number.isNaN(hoursNumber) || hoursNumber < 0)) {
      rowErrors.push(`Hours must be a number, like 6.25: "${row.hours}"`);
    }
    const hours = roundUpToQuarterHour(hoursNumber);

    let delegated = false;
    let member: TeamMember | undefined;
    if (row.owner) {
      if (GROWTHMISSION_WORDS.has(key(row.owner))) delegated = true;
      else {
        member = byName.get(key(row.owner));
        if (!member) {
          const k = key(row.owner);
          const entry = unknown.get(k) ?? { name: row.owner, rows: [] };
          entry.rows.push(row.rowNumber);
          unknown.set(k, entry);
        }
      }
    }

    // Completing a GrowthMission order spends credits: CRO Leader only, as
    // in the order panel and guard_growthmission_orders().
    if (delegated && state === "complete" && !ctx.isCroLeader) {
      rowErrors.push("Only CRO Leader can mark a GrowthMission order Complete.");
    }

    for (const message of rowErrors) errors.push({ row: row.rowNumber, message });
    if (rowErrors.length > 0) continue;

    if (existing.has(key(row.title))) duplicates.push({ row: row.rowNumber, title: row.title });
    if (member && state !== "complete") adding[member.id] = (adding[member.id] ?? 0) + hours;

    plan.push({
      rowNumber: row.rowNumber,
      title: row.title,
      detail: row.detail || null,
      priority: priority!,
      state: state!,
      due_date: due,
      hours,
      delegated,
      assignee_id: member?.id ?? null,
      ownerName: delegated ? "GrowthMission" : member?.name ?? null,
    });
  }

  const overCapacity: OrderImportReport["overCapacity"] = [];
  for (const [id, extra] of Object.entries(adding)) {
    const m = ctx.team.find((t) => t.id === id)!;
    const cap = capacityFor(m.weekly_hours, (ctx.memberLoad[id] ?? 0) + extra);
    if (cap.over) overCapacity.push({ name: m.name, assigned: cap.assigned, quarterly: cap.quarterly });
  }

  return {
    errors: errors.sort((a, b) => a.row - b.row),
    unknownOwners: [...unknown.values()],
    overCapacity,
    duplicates,
    plan,
  };
}
