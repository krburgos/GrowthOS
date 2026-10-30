/**
 * SniperLeads monthly report (client-confirmed, 2026-10-30, approved mockup
 * "SniperLeads Reports Mockup"). One place for what the report says, so the
 * editor's preview, Copy for Outlook and the PDF can never disagree.
 *
 * Client direction for everything client-facing here: no prospect value or
 * any dollar figure, no industry breakdown, no ranked list of companies.
 */

/** What GrowthMission counts itself — the sniperleads_numbers() RPC. */
export interface GmNumbers {
  pool: number;
  flagged: number;
  opportunities: number;
  meetings: number;
  proposals: number;
  won: number;
}

/** The outreach numbers CRO Leader types in each month. */
export interface OutreachNumbers {
  emails_sent: number | null;
  real_replies: number | null;
  auto_replies: number | null;
  calls: number | null;
  ad_audience: number | null;
  linkedin_started: boolean;
  linkedin_invites: number | null;
  linkedin_messages: number | null;
  website_started: boolean;
  website_visits: number | null;
}

export interface ReportRow extends OutreachNumbers {
  id: string;
  account_id: string;
  month: string; // YYYY-MM-01
  intro: string | null;
  closing: string | null;
  signer_id: string | null;
  gm_numbers: GmNumbers | null;
  exported_at: string | null;
}

export interface ReportModel {
  clientName: string;
  greetingName: string;
  monthLabel: string;
  monthNumber: number;
  gm: GmNumbers;
  outreach: OutreachNumbers;
  intro: string;
  closing: string;
  signerName: string;
}

export const EMPTY_OUTREACH: OutreachNumbers = {
  emails_sent: null,
  real_replies: null,
  auto_replies: null,
  calls: null,
  ad_audience: null,
  linkedin_started: false,
  linkedin_invites: null,
  linkedin_messages: null,
  website_started: false,
  website_visits: null,
};

export const OPPORTUNITIES_URL = "https://www.growthmission.app/opportunities";

/** "2026-10-01" for any date in October 2026 (UTC). */
export function monthKey(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Month 1 is the start month itself. */
export function monthNumber(startKey: string, key: string): number {
  const [sy, sm] = startKey.split("-").map(Number);
  const [y, m] = key.split("-").map(Number);
  return (y - sy) * 12 + (m - sm) + 1;
}

/** Every month from `fromKey` up to `toKey`, newest first. */
export function monthsBetween(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  let [y, m] = toKey.split("-").map(Number);
  const [fy, fm] = fromKey.split("-").map(Number);
  while (y > fy || (y === fy && m >= fm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}-01`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

/** Seven outreach figures; LinkedIn and Website count as done while "Not started". */
export const OUTREACH_TOTAL = 7;

export function outreachFilled(o: OutreachNumbers): number {
  const set = (v: number | null) => v !== null && v !== undefined;
  return (
    [o.emails_sent, o.real_replies, o.auto_replies, o.calls, o.ad_audience].filter(set).length +
    (!o.linkedin_started || (set(o.linkedin_invites) && set(o.linkedin_messages)) ? 1 : 0) +
    (!o.website_started || set(o.website_visits) ? 1 : 0)
  );
}

export type ReportStatus = "needs" | "ready" | "exported";

export function reportStatus(row: Pick<ReportRow, "exported_at"> & OutreachNumbers | null): ReportStatus {
  if (!row) return "needs";
  if (row.exported_at) return "exported";
  return outreachFilled(row) === OUTREACH_TOTAL ? "ready" : "needs";
}

export function defaultIntro(gm: GmNumbers, month: string): string {
  const monthName = monthLabel(month).split(" ")[0];
  return `Here is your SniperLeads summary for ${monthName}. SniperLeads has flagged ${gm.flagged.toLocaleString("en-US")} companies from your target pool that fit your ideal client, and they are in active outreach. Each one is an opportunity in GrowthMission under your name.`;
}

export function defaultClosing(): string {
  return "Can we find 30 minutes next week to walk through this together?";
}

/** "MTRIX America Inc. Authentication Solutions" stays whole; the masthead wraps. */
export function firstName(fullName: string | null | undefined): string {
  return (fullName ?? "").trim().split(/\s+/)[0] || "there";
}

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toLocaleString("en-US"));

export interface OutreachLine {
  label: string;
  value: string;
  note: string;
  notStarted?: boolean;
}

export function outreachLines(o: OutreachNumbers): OutreachLine[] {
  return [
    { label: "Emails sent", value: fmt(o.emails_sent), note: "One personal email to each flagged contact" },
    { label: "Real replies", value: fmt(o.real_replies), note: "A person answered" },
    { label: "Auto-replies", value: fmt(o.auto_replies), note: "Out-of-office and bounces, kept separate" },
    { label: "Calls and direct emails", value: fmt(o.calls), note: "Your Solution Advisor's follow-ups" },
    { label: "Impression ad audience", value: fmt(o.ad_audience), note: "Seeing your ads before the next touch" },
    o.linkedin_started
      ? { label: "LinkedIn invites / messages", value: `${fmt(o.linkedin_invites)} / ${fmt(o.linkedin_messages)}`, note: "Connection requests and messages sent" }
      : { label: "LinkedIn", value: "—", note: "Starts once access is set up", notStarted: true },
    o.website_started
      ? { label: "Website visits", value: fmt(o.website_visits), note: "Flagged companies that visited your site" }
      : { label: "Website visits", value: "—", note: "Starts once the tracking pixel is installed", notStarted: true },
  ];
}

export interface FunnelStep {
  label: string;
  value: number;
}

export function funnelSteps(m: ReportModel): FunnelStep[] {
  return [
    { label: "Target pool", value: m.gm.pool },
    { label: "Flagged", value: m.gm.flagged },
    { label: "Real replies", value: m.outreach.real_replies ?? 0 },
    { label: "Meetings booked", value: m.gm.meetings },
    { label: "Proposals out", value: m.gm.proposals },
    { label: "Won", value: m.gm.won },
  ];
}

export function headlineTiles(m: ReportModel): { value: string; label: string }[] {
  return [
    { value: fmt(m.gm.pool), label: "Companies in your target pool" },
    { value: fmt(m.gm.flagged), label: "Flagged by SniperLeads" },
    { value: fmt(m.gm.opportunities), label: "New opportunities" },
    { value: fmt(m.gm.meetings), label: "Meetings booked" },
  ];
}

export const DEFINITIONS: [string, string][] = [
  ["Flagged", "a company in your pool that SniperLeads marked SNIPER in GrowthMission"],
  ["Real reply", "a response written by a person; out-of-office and bounces are counted separately"],
];

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Design System §9 tokens as hex: email clients have no CSS variables. */
const C = {
  navy: "#022a66",
  teal: "#028eab",
  tealWash: "#e5f2f5",
  ink: "#1e293b",
  muted: "#64748b",
  rule: "#e2e8f0",
  amber: "#817103",
  amberWash: "#f5f3e5",
};
const FONT = "font-family:Poppins,'Segoe UI',Arial,sans-serif;";

/**
 * The report as email-safe HTML: tables and inline styles only, so a paste
 * into Outlook keeps the layout. Also what the editor previews.
 */
export function reportHtml(m: ReportModel): string {
  const tiles = headlineTiles(m)
    .map(
      (t) =>
        `<td width="25%" valign="top" style="padding:4px;"><div style="border:1px solid ${C.rule};border-radius:6px;padding:10px;"><div style="${FONT}font-size:20px;font-weight:700;color:${C.navy};">${esc(t.value)}</div><div style="${FONT}font-size:12px;color:${C.muted};line-height:1.35;">${esc(t.label)}</div></div></td>`
    )
    .join("");

  const steps = funnelSteps(m);
  const top = Math.max(steps[0].value, 1);
  const funnel = steps
    .map((s) => {
      const pct = Math.max(0, Math.min(100, Math.round((s.value / top) * 1000) / 10));
      const bar =
        pct > 0
          ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td width="${pct}%" style="background:${C.teal};height:14px;font-size:0;line-height:0;">&nbsp;</td>${pct < 100 ? `<td style="background:${C.tealWash};height:14px;font-size:0;line-height:0;">&nbsp;</td>` : ""}</tr></table>`
          : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td style="background:${C.tealWash};height:14px;font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
      return `<tr><td width="130" style="${FONT}font-size:13px;color:${C.ink};padding:3px 8px 3px 0;">${esc(s.label)}</td><td style="padding:3px 0;">${bar}</td><td width="60" align="right" style="${FONT}font-size:13px;font-weight:600;color:${C.ink};padding:3px 0 3px 8px;">${fmt(s.value)}</td></tr>`;
    })
    .join("");

  const outreach = outreachLines(m.outreach)
    .map(
      (l) =>
        `<tr><td style="${FONT}font-size:13px;color:${C.ink};padding:7px 8px 7px 0;border-bottom:1px solid ${C.rule};">${esc(l.label)}</td><td align="right" style="${FONT}font-size:13px;font-weight:600;color:${C.ink};padding:7px 8px;border-bottom:1px solid ${C.rule};white-space:nowrap;">${esc(l.value)}</td><td style="${FONT}font-size:13px;color:${l.notStarted ? C.amber : C.muted};padding:7px 0 7px 8px;border-bottom:1px solid ${C.rule};">${esc(l.note)}</td></tr>`
    )
    .join("");

  const para = (text: string) =>
    text
      .split(/\n{2,}/)
      .map((p) => `<p style="${FONT}font-size:14px;line-height:1.6;color:${C.ink};margin:0 0 12px;">${esc(p).replace(/\n/g, "<br>")}</p>`)
      .join("");

  const defs = DEFINITIONS.map(
    ([k, v]) => `<div style="${FONT}font-size:12px;color:${C.muted};margin:2px 0;"><b style="color:${C.ink};">${esc(k)}</b> · ${esc(v)}</div>`
  ).join("");

  const h2 = (t: string) => `<div style="${FONT}font-size:15px;font-weight:600;color:${C.navy};margin:0 0 8px;">${esc(t)}</div>`;
  const block = (inner: string, last = false) =>
    `<tr><td style="padding:18px 24px;${last ? "" : `border-bottom:1px solid ${C.rule};`}">${inner}</td></tr>`;

  return `<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="border-collapse:collapse;max-width:640px;width:100%;background:#ffffff;border:1px solid ${C.rule};">
<tr><td style="padding:20px 24px;border-bottom:4px solid ${C.teal};">
<div style="${FONT}font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:${C.teal};">SniperLeads Monthly Report · Month ${m.monthNumber}</div>
<div style="${FONT}font-size:22px;font-weight:700;color:${C.navy};line-height:1.3;">${esc(m.clientName)}: ${esc(m.monthLabel)}</div>
</td></tr>
${block(`${para(`Hello ${m.greetingName},`)}${para(m.intro)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr>${tiles}</tr></table>`)}
${block(`${h2("From target to deal")}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${funnel}</table>`)}
${block(`${h2("Outreach this month")}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${outreach}</table>`)}
${block(`${para(m.closing)}<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:4px 0 10px;"><tr><td style="background:${C.navy};border-radius:6px;padding:9px 16px;"><a href="${OPPORTUNITIES_URL}" style="${FONT}font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">See all ${fmt(m.gm.opportunities)} in GrowthMission</a></td></tr></table><p style="${FONT}font-size:14px;color:${C.ink};margin:0;">${esc(m.signerName)}<br><span style="color:${C.muted};">CRO Leader</span></p>`)}
${block(defs, true)}
</table>`;
}

/** Plain-text twin for the clipboard, for mail clients that refuse HTML. */
export function reportText(m: ReportModel): string {
  const lines = [
    `SniperLeads Monthly Report · Month ${m.monthNumber}`,
    `${m.clientName}: ${m.monthLabel}`,
    "",
    `Hello ${m.greetingName},`,
    "",
    m.intro,
    "",
    ...headlineTiles(m).map((t) => `${t.label}: ${t.value}`),
    "",
    "From target to deal",
    ...funnelSteps(m).map((s) => `  ${s.label}: ${fmt(s.value)}`),
    "",
    "Outreach this month",
    ...outreachLines(m.outreach).map((l) => `  ${l.label}: ${l.value} (${l.note})`),
    "",
    m.closing,
    `See all ${fmt(m.gm.opportunities)} in GrowthMission: ${OPPORTUNITIES_URL}`,
    "",
    m.signerName,
    "CRO Leader",
  ];
  return lines.join("\n");
}
