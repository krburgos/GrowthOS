/**
 * Next Deliverables on the TacticalLeads report (client-confirmed 2026-11-18,
 * approved mockup "Next Deliverables Mockup"). One place for the statuses,
 * presets and ordering, so the CRO editor, the client's Intel tab and the
 * PDF agree.
 *
 * Items belong to the account and carry over month to month until they're
 * Done (program_deliverables). Each published month keeps its own copy
 * (tactical_reports.deliverables, from tactical_deliverables()): everything
 * still open plus whatever was finished that month.
 */

export type DeliverableStatus = "not_started" | "in_progress" | "done";
export type WaitingOn = "cro_leader" | "client";

/** A row of program_deliverables, as the CRO editor reads it. */
export interface DeliverableRow {
  id: string;
  account_id: string;
  name: string;
  status: DeliverableStatus;
  waiting_on: WaitingOn;
  due_date: string | null; // YYYY-MM-DD
  note: string | null;
  done_at: string | null;
  position: number;
}

export const DELIVERABLE_COLUMNS = "id, account_id, name, status, waiting_on, due_date, note, done_at, position";

/** One item as a published month froze it (tactical_deliverables()). */
export interface DeliverableSnapshot {
  name: string;
  status: DeliverableStatus;
  waiting_on: WaitingOn;
  due_date: string | null;
  note: string | null;
  done_at: string | null;
}

export const STATUS_LABEL: Record<DeliverableStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
};

/** Pill colours (Design System §9), shared by the editor and the report. */
export const STATUS_PILL: Record<DeliverableStatus, string> = {
  not_started: "bg-neutral-100 text-neutral-600",
  in_progress: "bg-secondary-50 text-secondary-800",
  done: "bg-success-100 text-success-800",
};

export const WAITING_LABEL: Record<WaitingOn, string> = { cro_leader: "CRO Leader", client: "Client" };

/**
 * The default one-click items in the editor; "Add your own" covers anything
 * else. Since 2026-11-19 (approved mockup "Deliverable Presets Mockup") each
 * client can have its own list (program_deliverable_presets), edited from
 * "Edit presets"; a client without one uses this list.
 */
export const DELIVERABLE_PRESETS = [
  "ICP development",
  "List building",
  "Throwaway domain setup & access",
  "Email warmup",
  "LinkedIn profile setup",
  "Campaign copy",
  "Live activity alerts setup",
];

/** At most this many presets per client (matches the table's check). */
export const PRESETS_MAX = 50;

export const NAME_MAX = 120;
export const NOTE_MAX = 300;

/** The report's order: open items first, waiting on the client first, then by due date; Done last, oldest first. */
export function reportOrder<T extends Pick<DeliverableSnapshot, "status" | "waiting_on" | "due_date" | "done_at">>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ad = a.status === "done" ? 1 : 0;
    const bd = b.status === "done" ? 1 : 0;
    if (ad !== bd) return ad - bd;
    if (ad) return (a.done_at ?? "").localeCompare(b.done_at ?? "");
    const ac = a.waiting_on === "client" ? 0 : 1;
    const bc = b.waiting_on === "client" ? 0 : 1;
    if (ac !== bc) return ac - bc;
    return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
  });
}

export function summary(items: DeliverableSnapshot[]) {
  return {
    waiting: items.filter((i) => i.status !== "done" && i.waiting_on === "client").length,
    done: items.filter((i) => i.status === "done").length,
    total: items.length,
  };
}

/** "Dec 5" from a YYYY-MM-DD date, without a timezone shift. */
export function shortDate(d: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "Done Nov 12" from a done_at timestamp. */
export function doneLabel(doneAt: string | null): string {
  if (!doneAt) return "Done";
  return `Done ${new Date(doneAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
}
