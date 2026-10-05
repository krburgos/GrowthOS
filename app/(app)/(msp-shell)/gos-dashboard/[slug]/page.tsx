import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DropbyPanel } from "@/components/advocate-dash/dropby-panel";
import { TargetsTable } from "@/components/advocate-dash/targets-table";
import { EditOverviewPanel } from "@/components/gos-dashboard/edit-overview-panel";
import { ReportPanel } from "@/components/gos-dashboard/report-panel";
import { StepHeader } from "@/components/gos-dashboard/step-header";
import { StepHoursPanel } from "@/components/gos-dashboard/step-hours-panel";
import { TaskList } from "@/components/gos-dashboard/task-list";
import { ADVOCATE_DASH_SLUG } from "@/lib/advocate-dash/targets";
import { getTargets } from "@/lib/advocate-dash/queries";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { HOURS_EDIT_ROLES, currentQuarter } from "@/lib/gos-dashboard/hours";
import {
  getMemberTaskLoad,
  getReports,
  getStepDetail,
  getStepHours,
  getTasksForStep,
} from "@/lib/gos-dashboard/queries";
import { getTeamMembers } from "@/lib/team/queries";
import { PLAYBOOK_STEPS } from "@/lib/gos-dashboard/playbook";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const step = PLAYBOOK_STEPS.find((s) => s.slug === slug);
  return { title: step ? `${step.title} - GOS Dashboard - GrowthOS` : "GOS Dashboard - GrowthOS" };
}

/**
 * GOS Dashboard step detail.
 *
 * Client-confirmed restructure (2026-09-25): the tab strip is gone. The
 * page now reads straight down — where the workstream stands, then what to
 * do about it, then the standing duties and targets behind both:
 *
 *   Hours → Status Report → What to do next → Duties → KPIs
 *
 * Two things changed to get there. The Status Report used to be the first
 * of three tabs, on SEO and GEO alone; it is now on all 14 workstreams,
 * because the client wants every workstream to say where it stands. And
 * Progress Tracker is removed — tasks carry progress now, each with an
 * owner, hours and a state, which is what that tab was approximating.
 * This supersedes the source doc's own three-part "GrowthOS Dashboard"
 * sub-shape (App Flow §4.3a, Backend Schema §6.6c);
 * gos_dashboard_tracker_items keeps its rows and is simply no longer read,
 * the same way gos_dashboard_suggestions was left in place.
 *
 * Client-confirmed (2026-09-25, same pass): the Duties list and the KPIs
 * grid are removed from the foot of the page too. The status report says
 * where the workstream stands and the board says what to do about it;
 * a standing duties list and a second grid of targets underneath were
 * restating the engagement rather than telling anyone anything actionable.
 * gos_dashboard_kpis keeps its rows, and duties stay in the playbook shape,
 * so neither is lost.
 */
export default async function GosDashboardStepPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user || !user.account_id) return null;

  // AdvocateDash runs on drop-by targets, not hours and tasks
  // (client-confirmed, 2026-10-05), so it reads an entirely different set
  // of rows. Branching here rather than fetching both keeps the other
  // fifteen workstreams from paying for a table they never show.
  const isAdvocateDash = slug === ADVOCATE_DASH_SLUG;

  const quarter = currentQuarter();
  const [step, hours, tasks, team, memberLoad, reports, targets] = await Promise.all([
    getStepDetail(user.account_id, slug),
    getStepHours(user.account_id, quarter.start),
    isAdvocateDash ? [] : getTasksForStep(user.account_id, slug),
    getTeamMembers(user.account_id),
    // Account-wide: the cap is a person's whole commitment, so this board
    // has to count the tasks they carry on the other workstreams too.
    getMemberTaskLoad(user.account_id),
    isAdvocateDash ? [] : getReports(user.account_id, slug),
    isAdvocateDash ? getTargets(user.account_id) : [],
  ]);
  if (!step) notFound();

  const canEdit = user.role === "cro_admin" || user.role === "cro_advisor";
  const canLogHours = HOURS_EDIT_ROLES.includes(user.role);
  // Client-confirmed (2026-09-25): MSP Owner and Admin author tasks too -
  // adding, editing and retiring them, not only tracking them. The Status
  // Report above stays CRO-authored (canEdit), so the two remain separate
  // checks even though only the task list changed.
  const canAuthorTasks = HOURS_EDIT_ROLES.includes(user.role);

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 p-6 md:p-8">
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

      {isAdvocateDash ? (
        <>
          {/* No hours panel and no report control: this workstream is
              measured in drop-bys, and its reports are per-visit rather
              than per-account. The two sample documents ride this panel's
              header the way the report rides the hours header elsewhere. */}
          <DropbyPanel targets={targets} />

          <TargetsTable
            accountId={user.account_id}
            targets={targets}
            team={team}
            canEdit={canAuthorTasks}
          />
        </>
      ) : (
        <>
          {/* Client-confirmed (2026-10-02): the report rides the hours header
              rather than taking a card of its own. Two stacked panels spent a
              whole row on one filename and pushed the tasks down; one line now
              carries the quarter, the report and both actions. */}
          <StepHoursPanel
            accountId={user.account_id}
            slug={step.slug}
            hours={hours[step.slug]}
            quarter={quarter}
            canLogHours={canLogHours}
            reportSlot={
              <ReportPanel
                accountId={user.account_id}
                slug={step.slug}
                stepTitle={step.title}
                reports={reports}
                canUpload={canEdit}
              />
            }
          />

          <TaskList
            accountId={user.account_id}
            slug={step.slug}
            tasks={tasks}
            team={team}
            memberLoad={memberLoad}
            canAssign={canAuthorTasks}
            canDefine={canAuthorTasks}
          />
        </>
      )}
    </main>
  );
}