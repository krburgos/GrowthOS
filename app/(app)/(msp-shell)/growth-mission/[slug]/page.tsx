import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DropbyPanel } from "@/components/advocate-dash/dropby-panel";
import { TargetsTable } from "@/components/advocate-dash/targets-table";
import { Arsenal } from "@/components/growth-mission/arsenal";
import { EditOverviewPanel } from "@/components/growth-mission/edit-overview-panel";
import { ReportPanel } from "@/components/growth-mission/report-panel";
import { StepHeader } from "@/components/growth-mission/step-header";
import { StepHoursPanel } from "@/components/growth-mission/step-hours-panel";
import { MissionOrders } from "@/components/growth-mission/mission-orders";
import {
  FocusButton,
  SectionPane,
  SectionSwitcher,
  type SwitcherSection,
} from "@/components/growth-mission/section-switcher";
import { ADVOCATE_DASH_SLUG } from "@/lib/advocate-dash/targets";
import { getTargets } from "@/lib/advocate-dash/queries";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { HOURS_EDIT_ROLES, currentQuarter } from "@/lib/growth-mission/hours";
import {
  getMemberTaskLoad,
  getReports,
  getStepFiles,
  getStepDetail,
  getMissionData,
  getTasksForStep,
} from "@/lib/growth-mission/queries";
import { getTeamMembers } from "@/lib/team/queries";
import { PLAYBOOK_STEPS } from "@/lib/growth-mission/playbook";
import { CampaignsWorkspace } from "@/components/campaigns/campaigns-workspace";
import { CallDesk } from "@/components/sdr/call-desk";
import { CAMPAIGN_EDIT_ROLES, EMAIL_CAMPAIGNING_SLUG, getCampaignRows } from "@/lib/campaigns/queries";
import { ASSIGN_LIST_ROLES, SDR_OUTREACH_SLUG, TARGET_EDIT_ROLES, VIEW_ANY_QUEUE_ROLES } from "@/lib/sdr/desk";
import { getSdrDesk } from "@/lib/sdr/queries";
import { ORDER_IMPORT_ROLES } from "@/lib/growth-mission/order-import";

/** Who can log calls: the roles that may add activities (Backend Schema §2). */
const LOG_CALL_ROLES = ["msp_owner", "msp_admin", "msp_marketing", "cro_admin", "cro_advisor", "partner"];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const step = PLAYBOOK_STEPS.find((s) => s.slug === slug);
  return { title: step ? `${step.title} - Command Center - GrowthMission` : "Command Center - GrowthMission" };
}

/**
 * Command Center step detail.
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
 * This supersedes the source doc's own three-part "GrowthMission Dashboard"
 * sub-shape (App Flow §4.3a, Backend Schema §6.6c);
 * growth_mission_tracker_items keeps its rows and is simply no longer read,
 * the same way growth_mission_suggestions was left in place.
 *
 * Client-confirmed (2026-09-25, same pass): the Duties list and the KPIs
 * grid are removed from the foot of the page too. The status report says
 * where the workstream stands and the board says what to do about it;
 * a standing duties list and a second grid of targets underneath were
 * restating the engagement rather than telling anyone anything actionable.
 * growth_mission_kpis keeps its rows, and duties stay in the playbook shape,
 * so neither is lost.
 */
export default async function GrowthMissionStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  /**
   * `order` opens that mission order's panel — the overview tables link here with it.
   * `issue=1` opens an empty Issue order panel — the overview's Issue order picker links here with it.
   */
  searchParams: Promise<{ order?: string; issue?: string }>;
}) {
  const { slug } = await params;
  const { order: openOrderId, issue } = await searchParams;
  const user = await getCurrentUser();
  if (!user || !user.account_id) return null;

  // AdvocateDash runs on drop-by targets, not hours and tasks
  // (client-confirmed, 2026-10-05), so it reads an entirely different set
  // of rows. Branching here rather than fetching both keeps the other
  // fifteen workstreams from paying for a table they never show.
  const isAdvocateDash = slug === ADVOCATE_DASH_SLUG;
  // Client-confirmed (2026-10-22, approved mockup "Mission Card
  // Workspaces"): Mission Cards become where the work happens. Two cards so
  // far carry a workspace of their own between Hours and the Arsenal.
  const isEmailCampaigning = slug === EMAIL_CAMPAIGNING_SLUG;
  const isSdrOutreach = slug === SDR_OUTREACH_SLUG;

  const quarter = currentQuarter();
  const [step, mission, tasks, team, memberLoad, reports, targets, files, campaigns, sdrDesk] = await Promise.all([
    getStepDetail(user.account_id, slug),
    getMissionData(user.account_id, quarter),
    isAdvocateDash ? [] : getTasksForStep(user.account_id, slug),
    getTeamMembers(user.account_id),
    // Account-wide: the cap is a person's whole commitment, so this board
    // has to count the tasks they carry on the other workstreams too.
    getMemberTaskLoad(user.account_id),
    isAdvocateDash ? [] : getReports(user.account_id, slug),
    isAdvocateDash ? getTargets(user.account_id) : [],
    isAdvocateDash ? [] : getStepFiles(user.account_id, slug),
    isEmailCampaigning ? getCampaignRows() : null,
    isSdrOutreach ? getSdrDesk(user.account_id) : null,
  ]);
  if (!step) notFound();

  const canEdit = user.role === "cro_admin" || user.role === "cro_advisor";
  const canEditOutsourced = HOURS_EDIT_ROLES.includes(user.role);
  // Client-confirmed (2026-09-25): MSP Owner and Admin author tasks too -
  // adding, editing and retiring them, not only tracking them. The Status
  // Report above stays CRO-authored (canEdit), so the two remain separate
  // checks even though only the task list changed.
  const canAuthorTasks = HOURS_EDIT_ROLES.includes(user.role);

  const sections: SwitcherSection[] = isAdvocateDash
    ? [
        { view: "dropbys", label: "Drop-bys", hash: "#drop-bys" },
        { view: "targets", label: "Targets", hash: "#targets", count: targets.length },
      ]
    : [
        { view: "hours", label: "Hours", hash: "#hours" },
        ...(campaigns ? [{ view: "campaigns", label: "Campaigns", hash: "#campaigns", count: campaigns.length }] : []),
        ...(sdrDesk
          ? [
              { view: "desk", label: "Call Desk", hash: "#call-desk" },
              { view: "queue", label: "Call Queue", hash: "#call-queue" },
            ]
          : []),
        { view: "arsenal", label: "The Arsenal", hash: "#arsenal", count: files.length },
        { view: "orders", label: "Mission Orders", hash: "#mission-orders", count: tasks.filter((t) => t.state !== "complete").length },
      ];

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

      {/* Client-confirmed (2026-10-22, approved mockup "Mission Card
          Workspaces" v3): every Mission Card gets the Command Center's
          switcher, for the sections it has. Each card remembers its own
          last view. */}
      <SectionSwitcher label="Mission Card sections" sections={sections}>
      {isAdvocateDash ? (
        <>
          {/* No hours panel and no report control: this workstream is
              measured in drop-bys, and its reports are per-visit rather
              than per-account. The two sample documents ride this panel's
              header the way the report rides the hours header elsewhere. */}
          <SectionPane view="dropbys">
            <DropbyPanel targets={targets} focusSlot={<FocusButton view="dropbys" label="Drop-bys" />} />
          </SectionPane>

          <SectionPane view="targets">
            <TargetsTable
              accountId={user.account_id}
              targets={targets}
              team={team}
              canEdit={canAuthorTasks}
              focusSlot={<FocusButton view="targets" label="Drop-by targets" tone="light" />}
            />
          </SectionPane>
        </>
      ) : (
        <>
          {/* Client-confirmed (2026-10-02): the report rides the hours header
              rather than taking a card of its own. Two stacked panels spent a
              whole row on one filename and pushed the tasks down; one line now
              carries the quarter, the report and both actions. */}
          <SectionPane view="hours">
            <StepHoursPanel
              accountId={user.account_id}
              slug={step.slug}
              hours={mission.stepHours[step.slug]}
              quarter={quarter}
              canEditOutsourced={canEditOutsourced}
              reportSlot={
                <ReportPanel
                  accountId={user.account_id}
                  slug={step.slug}
                  stepTitle={step.title}
                  reports={reports}
                  canUpload={canEdit}
                />
              }
              focusSlot={<FocusButton view="hours" label="Hours" />}
            />
          </SectionPane>

          {campaigns && (
            <SectionPane view="campaigns">
              <CampaignsWorkspace
                campaigns={campaigns}
                canEdit={CAMPAIGN_EDIT_ROLES.includes(user.role)}
                focusSlot={<FocusButton view="campaigns" label="Campaigns" />}
              />
            </SectionPane>
          )}

          {/* Call Desk and Call Queue are two sections; CallDesk places its own panes. */}
          {sdrDesk && (
            <CallDesk
              accountId={user.account_id}
              viewerId={user.id}
              canAssign={ASSIGN_LIST_ROLES.includes(user.role)}
              canViewAny={VIEW_ANY_QUEUE_ROLES.includes(user.role)}
              canLog={LOG_CALL_ROLES.includes(user.role)}
              canSetTargets={TARGET_EDIT_ROLES.includes(user.role)}
              people={sdrDesk.people}
              assignments={sdrDesk.assignments}
              queues={sdrDesk.queues}
              recentCalls={sdrDesk.recentCalls}
              targets={sdrDesk.targets}
              lists={sdrDesk.lists}
              meetingStageId={sdrDesk.meetingStageId}
              salespeople={sdrDesk.salespeople}
              scriptName={files.find((f) => /script/i.test(f.file_name))?.file_name ?? null}
            />
          )}

          {/* Client-confirmed (2026-10-20, approved mockup "The Arsenal"):
              the Mission Card's files, between the hours (which carry the
              report) and the orders. */}
          <SectionPane view="arsenal">
            <Arsenal
              accountId={user.account_id}
              slug={step.slug}
              files={files}
              orders={tasks.map((t) => ({ id: t.id, title: t.title }))}
              canEdit={canAuthorTasks}
              focusSlot={<FocusButton view="arsenal" label="The Arsenal" />}
            />
          </SectionPane>

          {/* Client-confirmed (2026-10-14, approved mockup "Mission Orders
              Design"): "What to do next" becomes Mission Orders –
              Tasks/Tickets, grouped Must / Should / Could. Only CRO Leader
              confirms a GrowthMission order complete (canEdit here is the
              CRO Admin/Advisor check). */}
          <SectionPane view="orders">
            <MissionOrders
              mode="discipline"
              accountId={user.account_id}
              slug={step.slug}
              orders={tasks}
              team={team}
              memberLoad={memberLoad}
              canEdit={canAuthorTasks}
              isCroLeader={canEdit}
              canImport={ORDER_IMPORT_ROLES.includes(user.role)}
              openOrderId={openOrderId}
              openNew={issue === "1"}
              files={files}
              focusSlot={<FocusButton view="orders" label="Mission Orders" />}
            />
          </SectionPane>
        </>
      )}
      </SectionSwitcher>
    </main>
  );
}