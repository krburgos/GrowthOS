import { Sparkles } from "lucide-react";
import type { Metadata } from "next";

import { HoursCard } from "@/components/growth-mission/hours-card";
import { MissionCapacity } from "@/components/growth-mission/mission-capacity";
import { MissionProgress } from "@/components/growth-mission/mission-progress";
import { ReadinessCheck } from "@/components/growth-mission/readiness-check";
import { HeroBand } from "@/components/shell/hero-band";
import { SectionHeading } from "@/components/shell/section-heading";
import { getTargets } from "@/lib/advocate-dash/queries";
import { ADVOCATE_DASH_SLUG, advocatesForCard, targetSummary } from "@/lib/advocate-dash/targets";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { currentQuarter } from "@/lib/growth-mission/hours";
import {
  getKpiBand,
  getMemberStepTasks,
  getMissionData,
  getReadiness,
  getStepOverviews,
  getTasks,
} from "@/lib/growth-mission/queries";
import { membersForStep } from "@/lib/team/members";
import { getTeamMembers } from "@/lib/team/queries";

export const metadata: Metadata = { title: "Command Center – Strategy & Assignments Dashboard — GrowthMission" };

/**
 * Command Center (App Flow §4.3a). Client-confirmed (2026-09-17), all from
 * "GrowthMission Playbook - Dev Plan.docx": the "Before You Begin" readiness
 * check, the doc's KPI dashboard band (live contact/opportunity counts),
 * a quarter hours totals strip, and the disciplines as a flat grid of
 * "B — Ledger" hours cards.
 *
 * Client-confirmed (2026-10-13, approved mockup "Mission Dashboards" v5):
 * the title drops its "GrowthMission" prefix; the hours strip becomes
 * Mission Capacity (hours and credits, all derived - nothing is logged by
 * hand any more); the KPI band becomes Mission Progress with fixed stage
 * rules; and workstreams are called disciplines. Credits: CRO Admin/Advisor
 * set them, everyone sees them.
 */
export default async function GrowthMissionPage() {
  const user = await getCurrentUser();
  if (!user || !user.account_id) return null;

  const quarter = currentQuarter();
  const [steps, mission, kpiSources, readiness, teamMembers, tasks, stepTasks, targets] = await Promise.all([
    getStepOverviews(user.account_id),
    getMissionData(user.account_id, quarter),
    getKpiBand(user.account_id),
    getReadiness(user.account_id),
    getTeamMembers(user.account_id),
    getTasks(user.account_id),
    // Who holds tasks where, so a card can name people nobody declared
    // against the workstream in the Company Profile.
    getMemberStepTasks(user.account_id),
    // AdvocateDash is measured in drop-bys, so its card reads targets
    // rather than hours and tasks (client-confirmed, 2026-10-05).
    getTargets(user.account_id),
  ]);

  // One read for all sixteen cards, bucketed here rather than a query per
  // card.
  const tasksByStep = new Map<string, typeof tasks>();
  for (const task of tasks) {
    const bucket = tasksByStep.get(task.step_slug);
    if (bucket) bucket.push(task);
    else tasksByStep.set(task.step_slug, [task]);
  }

  const dropbys = targetSummary(targets);

  const isCroLeaderEditor = user.role === "cro_admin" || user.role === "cro_advisor";

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 p-6 md:p-8">
      <ReadinessCheck readiness={readiness} />

      <HeroBand>
        <div>
          <h1 className="text-h1 text-white">Command Center – Strategy & Assignments Dashboard</h1>
          {/* Client-confirmed (2026-09-24), treatment "C": a badge rather
              than the descriptive sentence that used to sit here. The
              quarter pill that sat opposite it moved down to Mission
              Capacity's label line (2026-10-13). */}
          <span className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-body-sm font-semibold text-white/90">
            <Sparkles className="size-4 text-secondary-300" />
            Powered by AI and CRO Leader
          </span>
        </div>
      </HeroBand>

      {/* Client-confirmed (2026-10-13): Mission Capacity is its own section,
          designed exactly like Mission Progress beneath it. */}
      <MissionCapacity
        accountId={user.account_id}
        capacity={mission.capacity}
        quarter={quarter}
        canSetCredits={isCroLeaderEditor}
        variant="band"
      />

      <MissionProgress accountId={user.account_id} sources={kpiSources} />

      {/* Client-confirmed (2026-10-01, approved mockup "C — Navy panel"): the
          Mission Cards get a navy ground rather than sitting straight on the
          page. The cards themselves are unchanged apart from losing a border
          they no longer need — colouring them was mocked up and rejected,
          because a white card on navy separates harder than a coloured card
          on grey, and because tinting the cards would have pushed the green
          and amber status pills onto translucent grounds at their lighter
          steps, softening exactly the signal those pills exist to carry.

          It is the hero band's own gradient, so the page reads navy header →
          white KPI band → navy card field. The white band between the two
          keeps them from merging into one mass, and it matches what the
          Headquarters block now does. */}
      <section className="mt-2 flex flex-col gap-3 rounded-xl p-4 shadow-lift md:p-5 bg-[linear-gradient(135deg,var(--color-primary-900),var(--color-primary-700)_60%,var(--color-secondary-800))]">
        <SectionHeading title="Mission Cards" tone="dark">
          {/* The removed hero sentence was the only thing telling anyone the
              cards open. Said here instead, where someone about to click is
              actually looking. */}
          <span className="text-caption text-white/55">
            {steps.length} disciplines · click any card for its report and mission orders
          </span>
        </SectionHeading>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {steps.map((step) => {
            const isAdvocateDash = step.slug === ADVOCATE_DASH_SLUG;
            return (
              <HoursCard
                key={step.slug}
                step={step}
                hours={mission.stepHours[step.slug]}
                assignees={
                  isAdvocateDash
                    ? advocatesForCard(teamMembers, targets)
                    : membersForStep(teamMembers, step.slug, stepTasks)
                }
                tasks={tasksByStep.get(step.slug) ?? []}
                dropbys={isAdvocateDash ? dropbys : undefined}
              />
            );
          })}
        </div>
      </section>
    </main>
  );
}
