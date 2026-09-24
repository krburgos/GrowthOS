import { createClient } from "@/lib/supabase/server";
import type { TeamKind, TeamMember } from "@/lib/team/members";

interface MemberRow {
  id: string;
  kind: TeamKind;
  name: string;
  title: string | null;
  weekly_hours: number | string;
  sort_order: number;
  account_team_assignments: { step_slug: string; weekly_hours: number | string }[] | null;
}

/**
 * Both rosters for one account, with each person's workstream assignments,
 * in one round trip. Archived members are left out; assignments are a join
 * row rather than a record with history, so they have no archived state
 * (the same shape list_members uses).
 *
 * numeric(5,1) comes back from PostgREST as a string, so every hours value
 * is coerced here rather than at each call site.
 */
export async function getTeamMembers(accountId: string): Promise<TeamMember[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("account_team_members")
    .select("id, kind, name, title, weekly_hours, sort_order, account_team_assignments(step_slug, weekly_hours)")
    .eq("account_id", accountId)
    .is("archived_at", null)
    .order("sort_order");

  return ((data ?? []) as MemberRow[]).map((row) => ({
    id: row.id,
    kind: row.kind,
    name: row.name,
    title: row.title,
    weekly_hours: Number(row.weekly_hours),
    sort_order: row.sort_order,
    assignments: (row.account_team_assignments ?? []).map((a) => ({
      step_slug: a.step_slug,
      weekly_hours: Number(a.weekly_hours),
    })),
  }));
}
