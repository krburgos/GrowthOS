import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DutiesList } from "@/components/gos-dashboard/duties-list";
import { TaskList } from "@/components/gos-dashboard/task-list";
import { EditKpiList } from "@/components/gos-dashboard/edit-kpi-list";
import { EditOverviewPanel } from "@/components/gos-dashboard/edit-overview-panel";
import { KpiGrid } from "@/components/gos-dashboard/kpi-grid";
import { PlaybookDetailTabs } from "@/components/gos-dashboard/playbook-detail-tabs";
import { StepHeader } from "@/components/gos-dashboard/step-header";
import { StepHoursPanel } from "@/components/gos-dashboard/step-hours-panel";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { HOURS_EDIT_ROLES, currentQuarter } from "@/lib/gos-dashboard/hours";
import { getStepDetail, getStepHours, getTasksForStep } from "@/lib/gos-dashboard/queries";
import { getTeamMembers } from "@/lib/team/queries";
import { PLAYBOOK_STEPS } from "@/lib/gos-dashboard/playbook";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const step = PLAYBOOK_STEPS.find((s) => s.slug === slug);
  return { title: step ? `${step.title} - GOS Dashboard - GrowthOS` : "GOS Dashboard - GrowthOS" };
}

/**
 * GOS Dashboard step detail (live, per-account, 2026-09-16). Reads user's
 * account data via getStepDetail (Task 2). SEO and GEO render the 3-tab
 * dashboard shape (Status Report / Suggestions & Fixes / Progress Tracker)
 * when hasDashboardShape is true; all 14 steps render Duties + KPIs.
 * On a new account with zero data, tabs/KPIs show their empty states.
 */
export default async function GosDashboardStepPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user || !user.account_id) return null;

  const quarter = currentQuarter();
  const [step, hours, tasks, team] = await Promise.all([
    getStepDetail(user.account_id, slug),
    getStepHours(user.account_id, quarter.start),
    getTasksForStep(user.account_id, slug),
    getTeamMembers(user.account_id),
  ]);
  if (!step) notFound();

  const canEdit = user.role === "cro_admin" || user.role === "cro_advisor";
  const canLogHours = HOURS_EDIT_ROLES.includes(user.role);
  // CRO Leader prescribes the work; Owner/Admin may say who is doing it and
  // how far along it is. A trigger enforces the same split in the database.
  const canAssign = HOURS_EDIT_ROLES.includes(user.role);

  return (
    <main className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col gap-6 p-6 md:p-8">
      <StepHeader
        step={step}
        overviewSlot={
          <EditOverviewPanel
            accountId={user.account_id}
            stepSlug={step.slug}
            initialStatus={step.status}
            initialHeadline={step.headline}
            canEdit={canEdit}
          />
        }
      />

      <StepHoursPanel
        accountId={user.account_id}
        slug={step.slug}
        hours={hours[step.slug]}
        quarter={quarter}
        canLogHours={canLogHours}
      />

      <TaskList
        accountId={user.account_id}
        slug={step.slug}
        tasks={tasks}
        team={team}
        canAssign={canAssign}
        canDefine={canEdit}
      />

      {step.hasDashboardShape && (
        <PlaybookDetailTabs
          accountId={user.account_id}
          stepSlug={step.slug}
          statusReportSummary={step.statusReportSummary}
          statusReportStats={step.statusReportStats}
          tracker={step.tracker}
          canEdit={canEdit}
        />
      )}

      <div>
        <h2 className="mb-3 text-h4 text-primary-900">Duties</h2>
        <DutiesList duties={step.duties} />
      </div>

      <div>
        <h2 className="mb-3 text-h4 text-primary-900">KPIs</h2>
        {canEdit ? (
          <EditKpiList accountId={user.account_id} stepSlug={step.slug} initialKpis={step.kpis} canEdit={canEdit} />
        ) : (
          <KpiGrid kpis={step.kpis} />
        )}
      </div>
    </main>
  );
}