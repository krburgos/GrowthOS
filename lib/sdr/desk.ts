/**
 * SDR Outreach Call Desk (client-confirmed, 2026-10-22, approved mockup
 * "Mission Card Workspaces" v2). Shared by the server page and the client
 * components: what a call can end in, the daily target, and when a queued
 * contact is due again.
 */

export const SDR_OUTREACH_SLUG = "sdr-outreach";

/** Who may hand a list to an SDR (client-confirmed: CRO Admin only, for now). */
export const ASSIGN_LIST_ROLES = ["cro_admin"];

/** Who may look at any SDR's queue rather than only their own. */
export const VIEW_ANY_QUEUE_ROLES = ["cro_admin", "cro_advisor", "cro_service_team", "msp_owner", "msp_admin"];

/**
 * Each SDR's daily target is set by CRO Leader (client-confirmed,
 * 2026-10-22) in sdr_daily_targets; an SDR without one uses this.
 */
export const DEFAULT_TARGET: DailyTarget = { calls: 60, meetings: 3 };

/** Who may set targets: CRO Leader's editing roles. */
export const TARGET_EDIT_ROLES = ["cro_admin", "cro_advisor"];

export interface DailyTarget {
  calls: number;
  meetings: number;
}

export type CallOutcome = "no_answer" | "voicemail" | "connected" | "not_interested" | "meeting_booked";

export const OUTCOMES: { value: CallOutcome; label: string; hint: string }[] = [
  { value: "no_answer", label: "No answer", hint: "Next try in 2 business days" },
  { value: "voicemail", label: "Voicemail", hint: "Next try in 2 business days" },
  { value: "connected", label: "Connected", hint: "Pick when to call back" },
  { value: "not_interested", label: "Not interested", hint: "Leaves the queue" },
  { value: "meeting_booked", label: "Meeting booked", hint: "Creates an opportunity at FME Scheduled" },
];

export const OUTCOME_LABEL = Object.fromEntries(OUTCOMES.map((o) => [o.value, o.label])) as Record<CallOutcome, string>;

/** Outcomes that count as having reached the person. */
export const CONNECTED_OUTCOMES: CallOutcome[] = ["connected", "not_interested", "meeting_booked"];

/** Outcomes that take a contact out of every queue. */
export const DONE_OUTCOMES: CallOutcome[] = ["not_interested", "meeting_booked"];

export interface QueueRow {
  contact_id: string;
  full_name: string;
  title: string | null;
  phone: string | null;
  company_name: string | null;
  company_phone: string | null;
  company_size: string | null;
  status_name: string | null;
  status_color: string | null;
  lists: string[];
  attempts: number;
  last_outcome: CallOutcome | null;
  last_call_at: string | null;
  follow_up_on: string | null;
}

export interface SdrPerson {
  id: string;
  full_name: string;
  role: string;
}

export interface Assignment {
  id: string;
  list_id: string;
  list_name: string;
  sdr_user_id: string;
  contacts: number;
}

/** A call logged today or yesterday, for the scoreboard; the browser keeps today's. */
export interface RecentCall {
  user_id: string;
  call_outcome: CallOutcome | null;
  occurred_at: string;
}

/** `YYYY-MM-DD` in the viewer's own timezone. */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** `days` business days after `from`, skipping Saturday and Sunday. */
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) left--;
  }
  return d;
}

export type Due = "today" | "new" | "tomorrow" | "later" | "done";

/**
 * Where a contact sits in the queue, from its latest call by anyone. A
 * call logged without an outcome (from Contact Detail's Log activity, say)
 * has no follow-up date, so it reads as due: somebody still has to decide.
 */
export function dueOf(row: QueueRow, now = new Date()): Due {
  if (!row.last_call_at) return "new";
  if (row.last_outcome && DONE_OUTCOMES.includes(row.last_outcome)) return "done";
  if (!row.follow_up_on) return "today";
  const today = dateKey(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (row.follow_up_on <= today) return "today";
  if (row.follow_up_on === dateKey(tomorrow)) return "tomorrow";
  return "later";
}

/** "Voicemail · 2d ago", for the Last touch column. */
export function lastTouch(row: QueueRow, now = new Date()): string {
  if (!row.last_call_at) return "—";
  const label = row.last_outcome ? OUTCOME_LABEL[row.last_outcome] : "Call";
  const days = Math.floor((now.getTime() - new Date(row.last_call_at).getTime()) / 86_400_000);
  const when = days <= 0 ? "today" : `${days}d ago`;
  return `${label} · ${when}`;
}
