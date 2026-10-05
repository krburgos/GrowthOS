import { CalendarRange, Sparkles } from "lucide-react";
import type { Metadata } from "next";

import { HoursCard } from "@/components/gos-dashboard/hours-card";
import { HoursTotalsStrip } from "@/components/gos-dashboard/hours-totals-strip";
import { KpiBand } from "@/components/gos-dashboard/kpi-band";
import { ReadinessCheck } from "@/components/gos-dashboard/readiness-check";
import { HeroBand, HeroLabel } from "@/components/shell/hero-band";
import { SectionHeading } from "@/components/shell/section-heading";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { HOURS_EDIT_ROLES, currentQuarter } from "@/lib/gos-dashboard/hours";
import {
  getKpiBand,
  getMemberStepTasks,
  getReadiness,
  getStepHours,
  getStepOverviews,
  getTasks,
} from "@/lib/gos-dashboard/queries";
import { membersForStep } from "@/lib/team/members";
import { getTeamMembers } from "@/lib/team/queries";

export const metadata: Metadata = { title: "GrowthOS Command Center – Strategy & Assignments Dashboard — GrowthOS" };

/**
 * GOS Dashboard (App Flow §4.3a). Client-confirmed (2026-09-17), all from
 * "GrowthOS Playbook - Dev Plan.docx": the "Before You Begin" readiness
 * check, the doc's KPI dashboard band (live contact/opportunity counts),
 * a quarter hours totals strip, and the 14 workstreams as a flat grid of
 * "B — Ledger" hours cards. Hours: MSP Owner/Admin + CRO Admin/Advisor
 * edit; KPI mapping and every step's status/KPIs/report: CRO Admin/Advisor.
 */
export default async function GosDashboardPage() {
  const user = await getCurrentUser();
  if (!user || !user.account_id) return null;

  const quarter = currentQuarter();
  const [steps, hours, kpiBand, readiness, teamMembers, tasks, stepTasks] = await Promise.all([
    getStepOverviews(user.account_id),
    getStepHours(user.account_id, quarter.start),
    getKpiBand(user.account_id),
    getReadiness(user.account_id),
    getTeamMembers(user.account_id),
    getTasks(user.account_id),
    // Who holds tasks where, so a card can name people nobody declared
    // against the workstream in the Company Profile.
    getMemberStepTasks(user.account_id),
  ]);

  // One read for all 14 cards, bucketed here rather than a query per card.
  const tasksByStep = new Map<string, typeof tasks>();
  for (const task of tasks) {
    const bucket = tasksByStep.get(task.step_slug);
    if (bucket) bucket.push(task);
    else tasksByStep.set(task.step_slug, [task]);
  }

  const canLogHours = HOURS_EDIT_ROLES.includes(user.role);
  const isCroLeaderEditor = user.role === "cro_admin" || user.role === "cro_advisor";

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 p-6 md:p-8">
      <ReadinessCheck readiness={readiness} />

      <HeroBand>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-h1 text-white">GrowthOS Command Center – Strategy & Assignments Dashboard</h1>
            {/* Client-confirmed (2026-09-24), treatment "C": a badge in the
                same material as the quarter pill opposite, rather than the
                descriptive sentence that used to sit here. */}
            <span className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-body-sm font-semibold text-white/90">
              <Sparkles className="size-4 text-secondary-300" />
              Powered by AI and CRO Leader
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/10 px-3 py-1.5 text-body-sm font-semibold text-white">
            <CalendarRange className="size-4" />
            {quarter.label} · {quarter.range}
          </span>
        </div>
        <div>
          <HeroLabel>Workstream hours · {quarter.label}</HeroLabel>
          <HoursTotalsStrip hours={Object.values(hours)} quarter={quarter} variant="hero" />
        </div>
      </HeroBand>

      <KpiBand
        accountId={user.account_id}
        sources={kpiBand.sources}
        customized={kpiBand.customized}
        canEditMapping={isCroLeaderEditor}
      />

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
          Homepage block now does. */}
      <section className="mt-2 flex flex-col gap-3 rounded-xl p-4 shadow-lift md:p-5 bg-[linear-gradient(135deg,var(--color-primary-900),var(--color-primary-700)_60%,var(--color-secondary-800))]">
        <SectionHeading title="Mission Cards" tone="dark">
          {/* The removed hero sentence was the only thing telling anyone the
              cards open. Said here instead, where someone about to click is
              actually looking. */}
          <span className="text-caption text-white/55">
            {steps.length} workstreams · click any card for its report and tasks
          </span>
        </SectionHeading>

        {!canLogHours && (
          <p className="text-caption text-white/55">View only — MSP Owner/Admin and CRO Leader log hours</p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {steps.map((step) => (
            <HoursCard
              key={step.slug}
              step={step}
              hours={hours[step.slug]}
              assignees={membersForStep(teamMembers, step.slug, stepTasks)}
              tasks={tasksByStep.get(step.slug) ?? []}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
