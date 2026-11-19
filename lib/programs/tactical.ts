/**
 * TacticalLeads monthly report (client-confirmed 2026-11-16, approved mockup
 * "Program Reports Mockup"). One place for the fields, groups and derived
 * rates, so the CRO editor, the client's Intel tab and the PDF agree.
 *
 * MQCs added is counted by GrowthMission (tactical_numbers()); every other
 * number is typed by CRO Leader because the outreach runs in outside tools.
 * Client direction: actuals only, no dollar figures.
 */

import type { DeliverableSnapshot } from "@/lib/programs/deliverables";

export type TacticalField =
  | "emails_sent"
  | "opens"
  | "clicks"
  | "real_replies"
  | "inbox_placement"
  | "delivered_rate"
  | "bounce_rate"
  | "mailboxes_warmed"
  | "alerts_sent"
  | "alerts_opened"
  | "alerts_clicked"
  | "alerts_replied"
  | "alerts_visited"
  | "linkedin_invites"
  | "linkedin_accepted"
  | "linkedin_messages"
  | "linkedin_replies";

export interface TacticalGm {
  mqcs: number;
}

export type TacticalRow = Record<TacticalField, number | null> & {
  id: string;
  account_id: string;
  month: string; // YYYY-MM-01
  gm_numbers: TacticalGm | null;
  /** Next Deliverables as they stood at publish; null before the first publish (and for months published before 2026-11-18). */
  deliverables: DeliverableSnapshot[] | null;
  published_at: string | null;
  updated_at: string;
};

export const TACTICAL_COLUMNS =
  "id, account_id, month, emails_sent, opens, clicks, real_replies, inbox_placement, delivered_rate, bounce_rate, mailboxes_warmed, alerts_sent, alerts_opened, alerts_clicked, alerts_replied, alerts_visited, linkedin_invites, linkedin_accepted, linkedin_messages, linkedin_replies, gm_numbers, deliverables, published_at, updated_at";

export interface FieldDef {
  key: TacticalField;
  label: string;
  /** A percentage, typed with one decimal (0–100). */
  percent?: boolean;
  tip?: string;
}

/** The typed fields, grouped by deliverable, in the editor's order. */
export const TACTICAL_GROUPS: { title: string; fields: FieldDef[] }[] = [
  {
    title: "Email Campaigns",
    fields: [
      { key: "emails_sent", label: "Emails sent" },
      { key: "opens", label: "Opens", tip: "Emails opened at least once." },
      { key: "clicks", label: "Clicks", tip: "Emails with at least one link clicked." },
      { key: "real_replies", label: "Real replies", tip: "Replies from a person. Leave out out-of-office and other auto-replies." },
    ],
  },
  {
    title: "Email Warmup",
    fields: [
      { key: "inbox_placement", label: "Inbox placement", percent: true, tip: "Share of warmup test emails that landed in the inbox." },
      { key: "delivered_rate", label: "Delivered", percent: true },
      { key: "bounce_rate", label: "Bounce rate", percent: true },
      { key: "mailboxes_warmed", label: "Mailboxes warmed" },
    ],
  },
  {
    title: "Live Activity Monitoring",
    fields: [
      { key: "alerts_sent", label: "Alerts sent" },
      { key: "alerts_opened", label: "Opened 3+ times" },
      { key: "alerts_clicked", label: "Clicked a link" },
      { key: "alerts_replied", label: "Replied" },
      { key: "alerts_visited", label: "Visited website" },
    ],
  },
  {
    title: "LinkedIn",
    fields: [
      { key: "linkedin_invites", label: "Invites sent" },
      { key: "linkedin_accepted", label: "Accepted" },
      { key: "linkedin_messages", label: "Messages sent" },
      { key: "linkedin_replies", label: "Replies" },
    ],
  },
];

export const TACTICAL_FIELDS: FieldDef[] = TACTICAL_GROUPS.flatMap((g) => g.fields);

/** A share of a whole, as a percentage with one decimal; null when it can't be worked out. */
export function rate(part: number | null, whole: number | null): number | null {
  if (part === null || whole === null || whole === 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

/** Every number the client sees for one month, typed and derived. */
export interface TacticalFigures {
  mqcs: number | null;
  emails_sent: number | null;
  open_rate: number | null;
  click_rate: number | null;
  real_replies: number | null;
  reply_rate: number | null;
  inbox_placement: number | null;
  delivered_rate: number | null;
  bounce_rate: number | null;
  mailboxes_warmed: number | null;
  alerts_sent: number | null;
  alerts_opened: number | null;
  alerts_clicked: number | null;
  alerts_replied: number | null;
  alerts_visited: number | null;
  linkedin_invites: number | null;
  linkedin_accepted: number | null;
  acceptance_rate: number | null;
  linkedin_messages: number | null;
  linkedin_replies: number | null;
}

export function figures(r: TacticalRow): TacticalFigures {
  const n = (v: number | string | null) => (v === null || v === undefined ? null : Number(v));
  return {
    mqcs: r.gm_numbers ? r.gm_numbers.mqcs : null,
    emails_sent: n(r.emails_sent),
    open_rate: rate(n(r.opens), n(r.emails_sent)),
    click_rate: rate(n(r.clicks), n(r.emails_sent)),
    real_replies: n(r.real_replies),
    reply_rate: rate(n(r.real_replies), n(r.emails_sent)),
    inbox_placement: n(r.inbox_placement),
    delivered_rate: n(r.delivered_rate),
    bounce_rate: n(r.bounce_rate),
    mailboxes_warmed: n(r.mailboxes_warmed),
    alerts_sent: n(r.alerts_sent),
    alerts_opened: n(r.alerts_opened),
    alerts_clicked: n(r.alerts_clicked),
    alerts_replied: n(r.alerts_replied),
    alerts_visited: n(r.alerts_visited),
    linkedin_invites: n(r.linkedin_invites),
    linkedin_accepted: n(r.linkedin_accepted),
    acceptance_rate: rate(n(r.linkedin_accepted), n(r.linkedin_invites)),
    linkedin_messages: n(r.linkedin_messages),
    linkedin_replies: n(r.linkedin_replies),
  };
}

export type FigureKey = keyof TacticalFigures;

export interface FigureDef {
  key: FigureKey;
  label: string;
  /** Shown as a percentage; month-on-month change is in points. */
  percent?: boolean;
  /** A fall is good news (bounce rate). */
  lowerIsBetter?: boolean;
  /** Counted by GrowthMission, not typed. */
  auto?: boolean;
  tip?: string;
}

/** Rows of the Month by Month table and the PDF, by deliverable. */
export const TACTICAL_TABLE: { title: string; rows: FigureDef[] }[] = [
  {
    title: "MQCs",
    rows: [{ key: "mqcs", label: "MQCs added", auto: true, tip: "Contacts CRO Leader researched and added to your lists this month." }],
  },
  {
    title: "Email Campaigns",
    rows: [
      { key: "emails_sent", label: "Emails sent" },
      { key: "open_rate", label: "Open rate", percent: true },
      { key: "click_rate", label: "Click rate", percent: true },
      { key: "real_replies", label: "Real replies", tip: "Replies from a person. Out-of-office and other auto-replies are left out." },
      { key: "reply_rate", label: "Reply rate", percent: true, tip: "Real replies as a share of emails sent." },
    ],
  },
  {
    title: "Email Warmup",
    rows: [
      { key: "inbox_placement", label: "Inbox placement", percent: true, tip: "Share of warmup test emails that landed in the inbox, not spam or promotions." },
      { key: "delivered_rate", label: "Delivered", percent: true },
      { key: "bounce_rate", label: "Bounce rate", percent: true, lowerIsBetter: true, tip: "Lower is better. Above 2% puts your sending domain at risk." },
      { key: "mailboxes_warmed", label: "Mailboxes warmed" },
    ],
  },
  {
    title: "Live Activity Monitoring",
    rows: [
      { key: "alerts_sent", label: "Alerts sent" },
      { key: "alerts_opened", label: "Opened an email 3+ times" },
      { key: "alerts_clicked", label: "Clicked a link" },
      { key: "alerts_replied", label: "Replied" },
      { key: "alerts_visited", label: "Visited your website" },
    ],
  },
  {
    title: "LinkedIn",
    rows: [
      { key: "linkedin_invites", label: "Invites sent" },
      { key: "linkedin_accepted", label: "Accepted" },
      { key: "acceptance_rate", label: "Acceptance rate", percent: true },
      { key: "linkedin_messages", label: "Messages sent" },
      { key: "linkedin_replies", label: "Replies" },
    ],
  },
];

export const FIGURE_DEF: Record<FigureKey, FigureDef> = Object.fromEntries(
  TACTICAL_TABLE.flatMap((g) => g.rows).map((r) => [r.key, r])
) as Record<FigureKey, FigureDef>;

/** The headline band, left to right. */
export const TACTICAL_HEADLINE: FigureKey[] = ["mqcs", "emails_sent", "open_rate", "real_replies", "linkedin_accepted"];
export const HEADLINE_LABEL: Partial<Record<FigureKey, string>> = { linkedin_accepted: "LinkedIn connections" };

export function show(v: number | null, percent?: boolean): string {
  if (v === null) return "—";
  return percent ? `${Number.isInteger(v) ? v : v.toFixed(1)}%` : Math.round(v).toLocaleString("en-US");
}

export interface Change {
  /** ▲ / ▼ / "" */
  arrow: string;
  text: string;
  tone: "up" | "down" | "flat" | "none";
}

/** Month-on-month change: % for counts, points for rates. */
export function change(cur: number | null, prev: number | null, def: Pick<FigureDef, "percent" | "lowerIsBetter">): Change | null {
  if (cur === null || prev === null) return null;
  if (!def.percent && prev === 0) return { arrow: "", text: cur > 0 ? "New this month" : "None last month either", tone: "none" };
  const d = def.percent ? Math.round((cur - prev) * 10) / 10 : Math.round(((cur - prev) / prev) * 100);
  const good = def.lowerIsBetter ? d < 0 : d > 0;
  return {
    arrow: d > 0 ? "▲" : d < 0 ? "▼" : "",
    text: `${Math.abs(d)}${def.percent ? " pts" : "%"}`,
    tone: d === 0 ? "flat" : good ? "up" : "down",
  };
}
