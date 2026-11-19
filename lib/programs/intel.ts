import type { DeliverableSnapshot } from "@/lib/programs/deliverables";
import { PROGRAMS, type Program } from "@/lib/programs/programs";
import { TACTICAL_COLUMNS, TACTICAL_HEADLINE, TACTICAL_TABLE, HEADLINE_LABEL, figures, type TacticalRow } from "@/lib/programs/tactical";
import type { GmNumbers, ReportRow } from "@/lib/sniperleads/report";
import { createClient } from "@/lib/supabase/server";

/**
 * What a program tab in Intel shows (client-confirmed 2026-11-16, approved
 * mockup "Program Reports Mockup"). Both programs are reduced to the same
 * shape — published months, each a bag of figures — so one board draws them.
 * Only published months are read: RLS lets the account see nothing else,
 * and the CRO Leader team, viewing as the account, sees what the client sees.
 */

export interface BoardRow {
  key: string;
  label: string;
  percent?: boolean;
  lowerIsBetter?: boolean;
  auto?: boolean;
  tip?: string;
}

export interface BoardMonth {
  month: string; // YYYY-MM-01
  publishedAt: string;
  pdfHref: string;
  figures: Record<string, number | null>;
  /** TacticalLeads only: the Next Deliverables frozen at publish; null when the month has none on record. */
  deliverables?: DeliverableSnapshot[] | null;
}

export interface ProgramBoardData {
  program: Program;
  since: string;
  months: BoardMonth[]; // oldest first
  headline: { key: string; label: string }[];
  table: { title: string; rows: BoardRow[] }[];
}

export async function activePrograms(accountId: string): Promise<{ program: Program; startMonth: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("account_programs").select("program, start_month, active").eq("account_id", accountId).eq("active", true);
  return (data ?? [])
    .filter((r) => (PROGRAMS as readonly string[]).includes(r.program))
    .sort((a, b) => PROGRAMS.indexOf(a.program as Program) - PROGRAMS.indexOf(b.program as Program))
    .map((r) => ({ program: r.program as Program, startMonth: r.start_month }));
}

const SNIPER_TABLE: ProgramBoardData["table"] = [
  {
    title: "SniperLeads",
    rows: [
      { key: "pool", label: "Target pool", auto: true, tip: "Contacts in your lists." },
      { key: "flagged", label: "Flagged SNIPER", auto: true, tip: "Contacts in your lists showing buying intent, marked SNIPER." },
      { key: "opportunities", label: "Opportunities", auto: true },
      { key: "meetings", label: "Meetings", auto: true, tip: "SniperLead opportunities at FME Scheduled or later." },
      { key: "proposals", label: "Proposals", auto: true, tip: "SniperLead opportunities at Proposal Emailed or later." },
      { key: "won", label: "Won", auto: true },
    ],
  },
  {
    title: "Outreach",
    rows: [
      { key: "emails_sent", label: "Emails sent" },
      { key: "real_replies", label: "Real replies", tip: "Replies from a person. Out-of-office and other auto-replies are left out." },
      { key: "calls", label: "Calls and direct emails" },
      { key: "ad_audience", label: "Impression ad audience" },
      { key: "linkedin_invites", label: "LinkedIn invites" },
      { key: "linkedin_messages", label: "LinkedIn messages" },
      { key: "website_visits", label: "Website visits" },
    ],
  },
];

export async function programBoard(accountId: string, program: Program, since: string): Promise<ProgramBoardData> {
  const supabase = await createClient();

  if (program === "tactical_leads") {
    const { data } = await supabase
      .from("tactical_reports")
      .select(TACTICAL_COLUMNS)
      .eq("account_id", accountId)
      .not("published_at", "is", null)
      .order("month");
    const months = ((data ?? []) as unknown as TacticalRow[]).map((r) => ({
      month: r.month,
      publishedAt: r.published_at!,
      pdfHref: `/api/program-reports/tactical/${r.id}/pdf`,
      figures: figures(r) as unknown as Record<string, number | null>,
      deliverables: r.deliverables,
    }));
    const defs = Object.fromEntries(TACTICAL_TABLE.flatMap((g) => g.rows).map((r) => [r.key, r]));
    return {
      program,
      since,
      months,
      headline: TACTICAL_HEADLINE.map((k) => ({ key: k, label: HEADLINE_LABEL[k] ?? defs[k].label })),
      table: TACTICAL_TABLE,
    };
  }

  const { data } = await supabase
    .from("sniperleads_reports")
    .select(
      "id, month, emails_sent, real_replies, calls, ad_audience, linkedin_started, linkedin_invites, linkedin_messages, website_started, website_visits, gm_numbers, published_at"
    )
    .eq("account_id", accountId)
    .not("published_at", "is", null)
    .order("month");
  type Row = Pick<
    ReportRow,
    "id" | "month" | "emails_sent" | "real_replies" | "calls" | "ad_audience" | "linkedin_started" | "linkedin_invites" | "linkedin_messages" | "website_started" | "website_visits" | "gm_numbers"
  > & { published_at: string };
  const months = ((data ?? []) as Row[]).map((r) => {
    const gm: Partial<GmNumbers> = r.gm_numbers ?? {};
    return {
      month: r.month,
      publishedAt: r.published_at,
      pdfHref: `/api/sniperleads/reports/${r.id}/pdf`,
      figures: {
        pool: gm.pool ?? null,
        flagged: gm.flagged ?? null,
        opportunities: gm.opportunities ?? null,
        meetings: gm.meetings ?? null,
        proposals: gm.proposals ?? null,
        won: gm.won ?? null,
        emails_sent: r.emails_sent,
        real_replies: r.real_replies,
        calls: r.calls,
        ad_audience: r.ad_audience,
        linkedin_invites: r.linkedin_started ? r.linkedin_invites : null,
        linkedin_messages: r.linkedin_started ? r.linkedin_messages : null,
        website_visits: r.website_started ? r.website_visits : null,
      },
    };
  });
  return {
    program,
    since,
    months,
    headline: [
      { key: "flagged", label: "Flagged SNIPER" },
      { key: "opportunities", label: "SniperLead opportunities" },
      { key: "meetings", label: "Meetings" },
      { key: "proposals", label: "Proposals" },
      { key: "won", label: "Won" },
    ],
    table: SNIPER_TABLE,
  };
}
