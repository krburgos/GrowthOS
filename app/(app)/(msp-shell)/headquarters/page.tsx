import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FunnelStrip, TodayBand, UpNext } from "@/components/dashboard/today";
import { getCurrentUser, needsAccountSelection } from "@/lib/auth/get-current-user";
import { currentQuarter } from "@/lib/growth-mission/hours";
import { getKpiBand, getMissionData, getReadiness, getTasks } from "@/lib/growth-mission/queries";
import { getTeamMembers } from "@/lib/team/queries";

export const metadata: Metadata = { title: "Headquarters — GrowthMission" };

/**
 * App Flow §4.3, Implementation Plan Milestone 11 — MSP landing screen.
 * Layout history: "Concept B — Command Center" (2026-09-08), the navy
 * SetupBlock (2026-09-24), renamed Headquarters (2026-10-13), Mission
 * Orders table added (2026-10-14).
 *
 * Proposal (2026-11-10, UX audit, branch ux/headquarters-today — awaiting
 * approval, not on main): a "Today" page. The navy band carries the next
 * step while any of the three foundations is unfinished, and three
 * figures; then the prospect-to-won funnel; then the Mission Orders that
 * need doing soonest. Mission Capacity, Mission Progress, Opportunities by
 * Stage and the full Mission Orders table (with its archive) are no longer
 * repeated here; they live on Command Center and Opportunities.
 */
export default async function HeadquartersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // A CRO Leader/partner role only reaches this page once they've entered
  // an MSP account (POST /api/cro/enter); otherwise /cro is their landing.
  if (needsAccountSelection(user.role) && !user.account_id) redirect("/cro");

  const quarter = currentQuarter();
  const [readiness, sources, mission, team, tasks] = await Promise.all([
    getReadiness(user.account_id!),
    getKpiBand(user.account_id!),
    getMissionData(user.account_id!, quarter),
    getTeamMembers(user.account_id!),
    getTasks(user.account_id!),
  ]);

  // The roster rows connected to this login (2026-10-27), for "Your Mission Orders".
  const myMemberIds = team.filter((m) => m.user_id === user.id).map((m) => m.id);

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 p-6 md:p-8">
      <div>
        <h1 className="text-h1 text-primary-900">Headquarters</h1>
        <p className="text-body text-neutral-500">Welcome back, {user.full_name.split(" ")[0]}. Here&apos;s what needs you today.</p>
      </div>

      <TodayBand readiness={readiness} sources={sources} capacity={mission.capacity} quarter={quarter} />
      <FunnelStrip sources={sources} />
      <UpNext tasks={tasks} myMemberIds={myMemberIds} />
    </main>
  );
}
