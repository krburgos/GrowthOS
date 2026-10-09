import type { Metadata } from "next";

import { VisitsBoard } from "@/components/advocate-dash/visits-board";
import { getTargets } from "@/lib/advocate-dash/queries";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { HOURS_EDIT_ROLES } from "@/lib/growth-mission/hours";
import { getTeamMembers } from "@/lib/team/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My Visits — GrowthMission" };

/**
 * My Visits (App Flow §4.3d, client-confirmed 2026-10-05) — the Advocate's
 * field screen.
 *
 * Reachable from the navigation drawer below `lg` only (`mobileOnly` in
 * NAV_ITEMS): on a desktop the AdvocateDash workstream page's drop-by table
 * says everything this does and more, so a ninth rail destination would
 * duplicate one already there. The route itself is not gated by width — a
 * link or a bookmark opens it at any size, it just stays a narrow column.
 *
 * Scoping comes from `account_team_members.user_id`, which links a roster
 * entry to a login. That column exists in the schema but nothing writes it
 * yet, so in practice every viewer currently falls through to the whole
 * account with an Advocate filter. That fallback is deliberate: scoping to
 * a link nobody has made would render an empty screen that reads as broken.
 */
export default async function MyVisitsPage() {
  const user = await getCurrentUser();
  if (!user || !user.account_id) return null;

  const supabase = await createClient();
  const [targets, team, { data: myMember }] = await Promise.all([
    getTargets(user.account_id),
    getTeamMembers(user.account_id),
    supabase
      .from("account_team_members")
      .select("id")
      .eq("account_id", user.account_id)
      .eq("user_id", user.id)
      .is("archived_at", null)
      .maybeSingle(),
  ]);

  // The filter lists only people actually holding a drop-by — a roster of
  // marketing staff who have never made a visit is noise on this screen.
  const withTargets = new Set(targets.map((t) => t.advocate?.id).filter(Boolean) as string[]);
  const advocates = team.filter((m) => withTargets.has(m.id));

  const myMemberId = (myMember as { id: string } | null)?.id ?? null;

  return (
    <main className="flex w-full flex-1 flex-col p-4 md:p-6">
      <VisitsBoard
        accountId={user.account_id}
        targets={targets}
        advocates={advocates}
        myMemberId={myMemberId}
        canEdit={HOURS_EDIT_ROLES.includes(user.role)}
      />
    </main>
  );
}
