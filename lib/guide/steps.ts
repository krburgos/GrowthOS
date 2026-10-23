import type { SupabaseClient } from "@supabase/supabase-js";

import { COMPANY_PROFILE_COLUMNS, profileCompleteness, type CompanyProfile } from "@/lib/accounts/company-profile";
import type { UserRole } from "@/lib/auth/get-current-user";
import { icpComplete, sameSnapshot } from "@/lib/icp/rules";
import { PLAYBOOK_STEPS } from "@/lib/growth-mission/playbook";
import { TOTAL_QUESTION_COUNT, countAnswered as countQuestionnaireAnswered } from "@/lib/questionnaire/questions";
import { TOTAL_FIELD_COUNT as VISION_BOARD_TOTAL, countAnswered as countVisionBoardAnswered } from "@/lib/vision-board/sections";

/**
 * Mission Control, option A (preview branch "mission-guide", 2026-10-23,
 * mockup "Mission Guide Options"): the next steps a person should take,
 * worked out by rules. No AI.
 *
 * The order is the user's (2026-10-23): the 3 Foundations come first —
 * Company Profile, Solution Questionnaire, Vision Board, the same three the
 * Command Center's "Before You Begin" check measures — and only then the
 * Mission Cards: overdue Mission Orders, cards CRO Leader flagged Needs
 * Attention, then the ICP and List Building steps. Mission Card steps offer
 * the three ways GrowthMission gets work done: do it yourself, assign it,
 * or delegate it to GrowthMission for credits.
 */

export type GuideActionKind = "do" | "assign" | "delegate";

export interface GuideAction {
  kind: GuideActionKind;
  label: string;
  href: string;
}

export interface GuideStep {
  key: string;
  /** "Foundation" or the Mission Card the step belongs to, shown above the title. */
  group: string;
  title: string;
  body: string;
  actions: GuideAction[];
}

/** Who can fill in the Foundations: the roles their settings pages let edit. */
const FOUNDATION_ROLES: UserRole[] = ["msp_owner", "msp_admin", "cro_admin", "cro_advisor"];

const order = (slug: string, type: "internal" | "growthmission", title: string) =>
  `/growth-mission/${slug}?issue=1&type=${type}&title=${encodeURIComponent(title)}`;

/** Do it / Assign it / Delegate it, for work a Mission Order can carry. */
const threeWays = (doLabel: string, doHref: string, slug: string, orderTitle: string): GuideAction[] => [
  { kind: "do", label: doLabel, href: doHref },
  { kind: "assign", label: "Issue a Mission Order", href: order(slug, "internal", orderTitle) },
  { kind: "delegate", label: "Order from GrowthMission", href: order(slug, "growthmission", orderTitle) },
];

const cardTitle = (slug: string) => PLAYBOOK_STEPS.find((s) => s.slug === slug)?.title ?? slug;

export async function getGuideSteps(supabase: SupabaseClient, accountId: string, role: UserRole): Promise<GuideStep[]> {
  const today = new Date().toISOString().slice(0, 10);
  const [
    { data: account },
    { count: teamCount },
    { data: response },
    { data: vision },
    { count: overdue },
    { data: flagged },
    { data: approvals },
    { data: icpLists },
  ] = await Promise.all([
    supabase.from("accounts").select(COMPANY_PROFILE_COLUMNS).eq("id", accountId).maybeSingle(),
    supabase
      .from("account_team_members")
      .select("id", { count: "exact", head: true })
      .eq("account_id", accountId)
      .eq("kind", "in_house")
      .is("archived_at", null),
    supabase.from("growth_questionnaire_responses").select("answers, completed_at").eq("account_id", accountId).maybeSingle(),
    supabase.from("vision_board_responses").select("answers, completed_at").eq("account_id", accountId).maybeSingle(),
    supabase
      .from("growth_mission_tasks")
      .select("id", { count: "exact", head: true })
      .eq("account_id", accountId)
      .is("archived_at", null)
      .neq("state", "complete")
      .lt("due_date", today),
    // Only a status CRO Leader actually set: a card with no row reads as
    // Needs Attention on the Command Center, but nobody flagged it.
    supabase.from("growth_mission_step_status").select("step_slug").eq("account_id", accountId).eq("status", "needs_attention"),
    supabase
      .from("icp_approvals")
      .select("approver_role, answers")
      .eq("account_id", accountId)
      .is("archived_at", null)
      .order("approved_at", { ascending: false }),
    supabase.from("lists").select("id").eq("account_id", accountId).eq("built_from_icp", true).is("archived_at", null),
  ]);

  const answers = (response?.answers as Record<string, unknown>) ?? {};
  const steps: GuideStep[] = [];

  // ---- The 3 Foundations ---------------------------------------------------
  if (FOUNDATION_ROLES.includes(role)) {
    const profile = account ? profileCompleteness(account as unknown as CompanyProfile, teamCount ?? 0) : null;
    if (!profile?.complete) {
      steps.push({
        key: "foundation-profile",
        group: "Foundation",
        title: "Finish your Company Profile",
        body: `${profile?.filled ?? 0} of ${profile?.total ?? 11} fields are filled. Every Mission Card works from it.`,
        actions: [{ kind: "do", label: profile?.filled ? "Finish it" : "Start it", href: "/settings/company" }],
      });
    }
    if (!response?.completed_at) {
      const done = countQuestionnaireAnswered(answers);
      steps.push({
        key: "foundation-questionnaire",
        group: "Foundation",
        title: "Finish the Solution Questionnaire",
        body: `${done} of ${TOTAL_QUESTION_COUNT} questions are answered, your Ideal Client Profile included.`,
        actions: [{ kind: "do", label: done ? "Finish it" : "Start it", href: "/settings/growth-questionnaire" }],
      });
    }
    if (!vision?.completed_at) {
      const done = countVisionBoardAnswered((vision?.answers as Record<string, unknown>) ?? {});
      steps.push({
        key: "foundation-vision",
        group: "Foundation",
        title: "Finish your Vision Board",
        body: `${done} of ${VISION_BOARD_TOTAL} answers are in. It sets the goals every Mission Card works toward.`,
        actions: [{ kind: "do", label: done ? "Finish it" : "Start it", href: "/settings/vision-board" }],
      });
    }
  }

  // ---- Mission Cards -------------------------------------------------------
  if ((overdue ?? 0) > 0) {
    steps.push({
      key: "orders-overdue",
      group: "Mission Orders",
      title: overdue === 1 ? "1 Mission Order is overdue" : `${overdue} Mission Orders are overdue`,
      body: "Finish them, move the due date, or hand them to someone with time.",
      actions: [{ kind: "do", label: "See the orders", href: "/growth-mission" }],
    });
  }

  const flaggedSlugs = PLAYBOOK_STEPS.map((s) => s.slug).filter((slug) => (flagged ?? []).some((f) => f.step_slug === slug));
  if (flaggedSlugs.length > 0) {
    const names = flaggedSlugs.map(cardTitle);
    steps.push({
      key: "cards-flagged",
      group: "Mission Cards",
      title:
        flaggedSlugs.length === 1
          ? `${names[0]} needs attention`
          : `${flaggedSlugs.length} Mission Cards need attention`,
      body: flaggedSlugs.length === 1 ? "Your CRO Leader flagged it." : `Your CRO Leader flagged ${names.join(", ")}.`,
      actions: [{ kind: "do", label: `Open ${names[0]}`, href: `/growth-mission/${flaggedSlugs[0]}` }],
    });
  }

  // ICP: approved by both an MSP Owner and a CRO Admin on the current answers.
  // (Finishing it is the Questionnaire Foundation above.)
  const icpGroup = "ICP Development";
  if (icpComplete(answers)) {
    const current = (r: "msp_owner" | "cro_admin") => {
      const row = (approvals ?? []).find((a) => a.approver_role === r);
      return !!row && sameSnapshot(row.answers as Record<string, unknown>, answers);
    };
    const waiting = (["msp_owner", "cro_admin"] as const).filter((r) => !current(r));
    if (waiting.length) {
      const mine = waiting.find((r) => r === role);
      steps.push({
        key: "icp-approve",
        group: icpGroup,
        title: mine ? "Your ICP is waiting for your approval" : "Your ICP is waiting for approval",
        body: mine
          ? "Approve it so everyone builds lists and campaigns from the same profile."
          : `Waiting on ${waiting.map((r) => (r === "msp_owner" ? "your MSP Owner" : "your CRO Leader")).join(" and ")}.`,
        actions: [{ kind: "do", label: mine ? "Review and approve" : "View the ICP", href: "/growth-mission/icp-development" }],
      });
    }
  }

  // List Building: build an ICP list, clean it, put it to work.
  const listGroup = "List Building";
  const listIds = (icpLists ?? []).map((l) => l.id as string);
  if (listIds.length === 0) {
    steps.push({
      key: "icp-list",
      group: listGroup,
      title: "Build your first ICP list",
      body: "Put every contact that matches your ICP on one list, ready to call or email.",
      actions: threeWays("Build ICP list", "/growth-mission/list-building", "list-building", "Build an ICP list"),
    });
    return steps;
  }

  const [{ count: toClean }, { data: assigned }, { data: campaigns }] = await Promise.all([
    supabase
      .from("list_members")
      .select("contact_id, contacts!inner(id)", { count: "exact", head: true })
      .in("list_id", listIds)
      .or("email_opt_out.eq.true,email_bounced_at.not.is.null", { referencedTable: "contacts" }),
    supabase.from("sdr_list_assignments").select("list_id").in("list_id", listIds).is("archived_at", null),
    supabase.from("campaigns").select("list_id").in("list_id", listIds).is("archived_at", null),
  ]);

  if ((toClean ?? 0) > 0) {
    steps.push({
      key: "icp-clean",
      group: listGroup,
      title: `${toClean} contacts on your ICP lists need cleaning`,
      body: "They bounced or unsubscribed. Take them off before anyone calls or emails the list.",
      actions: threeWays("Clean the lists", "/growth-mission/list-building", "list-building", "Clean our ICP lists"),
    });
  }

  const worked = new Set([...(assigned ?? []), ...(campaigns ?? [])].map((r) => r.list_id as string));
  const idle = listIds.filter((id) => !worked.has(id)).length;
  if (idle > 0) {
    steps.push({
      key: "icp-work",
      group: listGroup,
      title: idle === 1 ? "1 of your ICP lists isn't being worked" : `${idle} of your ICP lists aren't being worked`,
      body: "Nobody is calling or emailing them yet.",
      actions: [
        { kind: "do", label: "Send a campaign", href: "/campaigns/new" },
        { kind: "assign", label: "Assign to an SDR", href: "/growth-mission/sdr-outreach" },
        { kind: "delegate", label: "Order from GrowthMission", href: order("list-building", "growthmission", "Work our ICP lists") },
      ],
    });
  }

  return steps;
}
