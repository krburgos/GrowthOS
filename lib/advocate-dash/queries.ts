/**
 * AdvocateDash server reads (client-confirmed, 2026-10-05).
 *
 * Server-only: this imports the Supabase server client, so a client
 * component must import lib/advocate-dash/targets.ts instead. Everything
 * here goes through the ordinary session client under RLS — no service role
 * — so a reader can never be handed a target their policies would hide.
 */

import {
  REPORT_SECTIONS,
  sectionAnswered,
  type ReportAnswers,
} from "@/lib/advocate-dash/report-form";
import type { AdvocateTarget, TargetStatus } from "@/lib/advocate-dash/targets";
import { createClient } from "@/lib/supabase/server";
import type { TeamKind } from "@/lib/team/members";

interface TargetRow {
  id: string;
  target_name: string;
  company_name: string | null;
  address: string | null;
  status: TargetStatus;
  scheduled_for: string | null;
  sort_order: number;
  completed_on: string | null;
  letter_path: string | null;
  letter_name: string | null;
  letter_size: number | null;
  letter_uploaded_at: string | null;
  // PostgREST types an embedded resource as an array even where the
  // relationship is many-to-one, so this takes the same union the task
  // query uses and goes through `unwrap`.
  advocate: Advocate | Advocate[] | null;
}

type Advocate = { id: string; name: string; kind: TeamKind };

function unwrap<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

interface ReportRow {
  id: string;
  target_id: string;
  answers: ReportAnswers | null;
  submitted_at: string | null;
}

const SELECT = `
  id, target_name, company_name, address, status, scheduled_for, sort_order, completed_on,
  letter_path, letter_name, letter_size, letter_uploaded_at,
  advocate:account_team_members!advocate_dash_targets_advocate_member_id_fkey(id, name, kind)
`;

/**
 * Every live target on the account, newest first.
 *
 * Three reads rather than one nested select: a target's report and photos
 * live in their own tables, and PostgREST cannot aggregate a count through
 * an embedded resource without a view. Bucketing here keeps it to three
 * round trips regardless of how long the list gets.
 */
export async function getTargets(accountId: string): Promise<AdvocateTarget[]> {
  const supabase = await createClient();

  const [{ data: targetRows }, { data: reportRows }, { data: photoRows }] = await Promise.all([
    supabase
      .from("advocate_dash_targets")
      .select(SELECT)
      .eq("account_id", accountId)
      .is("archived_at", null)
      // Manual order first (client-confirmed, 2026-10-06), insertion
      // order as the tiebreak so an unmoved row stays where it was.
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("advocate_dash_visit_reports")
      .select("id, target_id, answers, submitted_at")
      .eq("account_id", accountId),
    supabase
      .from("advocate_dash_visit_photos")
      .select("target_id")
      .eq("account_id", accountId)
      .is("archived_at", null),
  ]);

  const reports = new Map<string, ReportRow>();
  for (const row of (reportRows ?? []) as ReportRow[]) reports.set(row.target_id, row);

  const photoCounts = new Map<string, number>();
  for (const row of (photoRows ?? []) as { target_id: string }[]) {
    photoCounts.set(row.target_id, (photoCounts.get(row.target_id) ?? 0) + 1);
  }

  return ((targetRows ?? []) as TargetRow[]).map((row) => {
    const report = reports.get(row.id);
    return {
      id: row.id,
      target_name: row.target_name,
      company_name: row.company_name,
      address: row.address,
      status: row.status,
      scheduled_for: row.scheduled_for,
      sort_order: row.sort_order,
      completed_on: row.completed_on,
      advocate: unwrap(row.advocate),
      letter: row.letter_path
        ? {
            path: row.letter_path,
            name: row.letter_name,
            size: row.letter_size,
            uploadedAt: row.letter_uploaded_at,
          }
        : null,
      report: report
        ? {
            id: report.id,
            submitted_at: report.submitted_at,
            sections_done: countSections(report.answers ?? {}),
          }
        : null,
      photo_count: photoCounts.get(row.id) ?? 0,
    };
  });
}

/** One target's report, for the form and the PDF export. */
export async function getVisitReport(
  accountId: string,
  targetId: string
): Promise<{ id: string; answers: ReportAnswers; submitted_at: string | null } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("advocate_dash_visit_reports")
    .select("id, answers, submitted_at")
    .eq("account_id", accountId)
    .eq("target_id", targetId)
    .maybeSingle();
  if (!data) return null;
  const row = data as { id: string; answers: ReportAnswers | null; submitted_at: string | null };
  return { id: row.id, answers: row.answers ?? {}, submitted_at: row.submitted_at };
}

/** One target, for the export route's header. */
export async function getTarget(accountId: string, targetId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("advocate_dash_targets")
    .select(SELECT)
    .eq("account_id", accountId)
    .eq("id", targetId)
    .is("archived_at", null)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as TargetRow;
  return { ...row, advocate: unwrap(row.advocate) };
}

/** Photos filed against a target, oldest first. */
export async function getVisitPhotos(accountId: string, targetId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("advocate_dash_visit_photos")
    .select("id, file_path, caption, file_size, created_at")
    .eq("account_id", accountId)
    .eq("target_id", targetId)
    .is("archived_at", null)
    .order("created_at");
  return (data ?? []) as {
    id: string;
    file_path: string;
    caption: string | null;
    file_size: number | null;
    created_at: string;
  }[];
}

function countSections(answers: ReportAnswers): number {
  return REPORT_SECTIONS.filter((s) => sectionAnswered(s, answers)).length;
}
