import type { SupabaseClient } from "@supabase/supabase-js";

import type { UserRole } from "@/lib/auth/get-current-user";
import { icpComplete, sameSnapshot } from "@/lib/icp/rules";
import { QUESTIONNAIRE_SECTIONS, isAnswered } from "@/lib/questionnaire/questions";

/**
 * Mission Control, option A (preview branch "mission-guide", 2026-10-23,
 * mockup "Mission Guide Options"): the next steps a person should take,
 * worked out by rules from the same data the ICP and List Building cards
 * read. No AI. Each step offers the three ways GrowthMission gets work
 * done: do it yourself, assign it, or delegate it to GrowthMission for
 * credits.
 */

export type GuideActionKind = "do" | "assign" | "delegate";

export interface GuideAction {
  kind: GuideActionKind;
  label: string;
  href: string;
}

export interface GuideStep {
  key: string;
  title: string;
  body: string;
  actions: GuideAction[];
}

const order = (slug: string, type: "internal" | "growthmission", title: string) =>
  `/growth-mission/${slug}?issue=1&type=${type}&title=${encodeURIComponent(title)}`;

/** Do it / Assign it / Delegate it, for work a Mission Order can carry. */
const threeWays = (doLabel: string, doHref: string, slug: string, orderTitle: string): GuideAction[] => [
  { kind: "do", label: doLabel, href: doHref },
  { kind: "assign", label: "Issue a Mission Order", href: order(slug, "internal", orderTitle) },
  { kind: "delegate", label: "Order from GrowthMission", href: order(slug, "growthmission", orderTitle) },
];

const ICP_QUESTIONS = QUESTIONNAIRE_SECTIONS.filter((s) => s.part === "icp").flatMap((s) => s.questions);

export async function getGuideSteps(supabase: SupabaseClient, accountId: string, role: UserRole): Promise<GuideStep[]> {
  const [{ data: response }, { data: approvals }, { data: icpLists }] = await Promise.all([
    supabase.from("growth_questionnaire_responses").select("answers").eq("account_id", accountId).maybeSingle(),
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

  // 1. Finish the ICP.
  if (!icpComplete(answers)) {
    const answered = ICP_QUESTIONS.filter((q) => isAnswered(q, answers)).length;
    steps.push({
      key: "icp-finish",
      title: "Finish your Ideal Client Profile",
      body: `${answered} of ${ICP_QUESTIONS.length} ICP questions are answered. Lists, campaigns and calls are all aimed by it.`,
      actions: threeWays("Answer the questions", "/settings/growth-questionnaire?step=icp_target", "icp-development", "Finish the ICP"),
    });
  } else {
    // 2. Approve it: an MSP Owner and a CRO Admin both sign the current answers.
    const current = (r: "msp_owner" | "cro_admin") => {
      const row = (approvals ?? []).find((a) => a.approver_role === r);
      return !!row && sameSnapshot(row.answers as Record<string, unknown>, answers);
    };
    const waiting = (["msp_owner", "cro_admin"] as const).filter((r) => !current(r));
    if (waiting.length) {
      const mine = waiting.find((r) => r === role);
      steps.push({
        key: "icp-approve",
        title: mine ? "Your ICP is waiting for your approval" : "Your ICP is waiting for approval",
        body: mine
          ? "Approve it so everyone builds lists and campaigns from the same profile."
          : `Waiting on ${waiting.map((r) => (r === "msp_owner" ? "your MSP Owner" : "your CRO Leader")).join(" and ")}.`,
        actions: [{ kind: "do", label: mine ? "Review and approve" : "View the ICP", href: "/growth-mission/icp-development" }],
      });
    }
  }

  // 3. Build a list from it.
  const listIds = (icpLists ?? []).map((l) => l.id as string);
  if (listIds.length === 0) {
    steps.push({
      key: "icp-list",
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

  // 4. Clean it.
  if ((toClean ?? 0) > 0) {
    steps.push({
      key: "icp-clean",
      title: `${toClean} contacts on your ICP lists need cleaning`,
      body: "They bounced or unsubscribed. Take them off before anyone calls or emails the list.",
      actions: threeWays("Clean the lists", "/growth-mission/list-building", "list-building", "Clean our ICP lists"),
    });
  }

  // 5. Put it to work.
  const worked = new Set([...(assigned ?? []), ...(campaigns ?? [])].map((r) => r.list_id as string));
  const idle = listIds.filter((id) => !worked.has(id)).length;
  if (idle > 0) {
    steps.push({
      key: "icp-work",
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
