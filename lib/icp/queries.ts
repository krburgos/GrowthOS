import type { SupabaseClient } from "@supabase/supabase-js";

import type { ListRow } from "@/components/lists/lists-table";
import { applyRules, ruleEmbeds, type ContactRule } from "@/lib/contacts/filters";
import { icpComplete, icpRules, sameSnapshot } from "@/lib/icp/rules";
import { getListRows } from "@/lib/lists/rows";
import { createClient } from "@/lib/supabase/server";
import { icpFromQuestionnaire, type IcpAnswers } from "@/lib/vision-board/icp";

/**
 * Reads for the ICP and List Building Mission Cards (client-confirmed,
 * 2026-10-23, approved mockup "ICP & List Building Cards"). Everything is a
 * direct RLS read, like the other card workspaces.
 */

export type ApproverRole = "msp_owner" | "cro_admin";

export interface IcpSignoff {
  role: ApproverRole;
  /** null when the viewer can't read the signer's user row (a CRO Leader seen from an MSP account). */
  name: string | null;
  at: string;
  /** Signed on the answers as they are now. */
  current: boolean;
}

export interface IcpState {
  icp: IcpAnswers;
  rules: ContactRule[];
  answers: Record<string, unknown>;
  updatedAt: string | null;
  complete: boolean;
  signoffs: Record<ApproverRole, IcpSignoff | null>;
  /** Both an MSP Owner and a CRO Admin signed the current answers. */
  approved: boolean;
  /** Someone signed, and the answers have changed since. */
  changedSinceApproval: boolean;
}

export async function getIcpState(accountId: string): Promise<IcpState> {
  const supabase = await createClient();
  const [{ data: response }, { data: approvals }] = await Promise.all([
    supabase.from("growth_questionnaire_responses").select("answers, updated_at").eq("account_id", accountId).maybeSingle(),
    supabase
      .from("icp_approvals")
      .select("approver_role, answers, approved_at, users(full_name)")
      .eq("account_id", accountId)
      .is("archived_at", null)
      .order("approved_at", { ascending: false }),
  ]);

  const answers = (response?.answers as Record<string, unknown>) ?? {};
  const icp = icpFromQuestionnaire(answers);

  const latest = (role: ApproverRole): IcpSignoff | null => {
    const row = (approvals ?? []).find((a) => a.approver_role === role);
    if (!row) return null;
    const u = Array.isArray(row.users) ? row.users[0] : row.users;
    return {
      role,
      name: (u as { full_name?: string } | null)?.full_name ?? null,
      at: row.approved_at,
      current: sameSnapshot(row.answers as Record<string, unknown>, answers),
    };
  };
  const signoffs = { msp_owner: latest("msp_owner"), cro_admin: latest("cro_admin") };

  return {
    icp,
    rules: icpRules(icp),
    answers,
    updatedAt: response?.updated_at ?? null,
    complete: icpComplete(answers),
    signoffs,
    approved: !!signoffs.msp_owner?.current && !!signoffs.cro_admin?.current,
    changedSinceApproval: Object.values(signoffs).some((s) => s && !s.current),
  };
}

/** Counts contacts in the account that pass `rules` (plus `extra`, e.g. a list). */
async function countMatching(supabase: SupabaseClient, accountId: string, rules: ContactRule[]): Promise<number> {
  const query = supabase
    .from("contacts")
    .select(`id${ruleEmbeds(rules)}`, { count: "exact", head: true })
    .eq("account_id", accountId)
    .is("archived_at", null);
  const { count } = await applyRules(query, rules);
  return count ?? 0;
}

export interface IcpFit {
  total: number;
  industry: number;
  size: number;
  title: number;
  /** Every ICP rule at once. */
  all: number;
}

/** The ICP card's Fit check: how many contacts match each part of the profile, and all of it. */
export async function getIcpFit(accountId: string, rules: ContactRule[]): Promise<IcpFit> {
  const supabase = await createClient();
  const only = (field: ContactRule["field"]) => rules.filter((r) => r.field === field);
  const part = (field: ContactRule["field"]) => (only(field).length ? countMatching(supabase, accountId, only(field)) : Promise.resolve(0));
  const [total, industry, size, title, all] = await Promise.all([
    countMatching(supabase, accountId, []),
    part("industry"),
    part("employees"),
    part("title"),
    rules.length ? countMatching(supabase, accountId, rules) : Promise.resolve(0),
  ]);
  return { total, industry, size, title, all };
}

/** Whether any live list was made with Build ICP list. */
export async function hasIcpList(accountId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("lists")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .eq("built_from_icp", true)
    .is("archived_at", null);
  return (count ?? 0) > 0;
}

export interface WorkingIt {
  kind: "sdr" | "campaign";
  label: string;
}

export type ListsCardRow = ListRow & {
  /** Share of the list's members matching the whole ICP, 0–1; null with no ICP or no members. */
  icpFit: number | null;
  workingIt: WorkingIt[];
};

export interface ListsCard {
  rows: ListsCardRow[];
  distinctContacts: number;
  fitContacts: number;
  /** Unsubscribed + bounced members across ICP lists. */
  toClean: number;
  unused: number;
  icpLists: number;
}

/** The List Building card's Lists section. */
export async function getListsCard(accountId: string, rules: ContactRule[]): Promise<ListsCard> {
  const supabase = await createClient();
  const [{ rows, contactIds }, { data: assignments }, { data: people }, { data: campaigns }] = await Promise.all([
    getListRows(supabase, accountId),
    supabase.from("sdr_list_assignments").select("list_id, sdr_user_id").eq("account_id", accountId).is("archived_at", null),
    // The SDR desk's own reader: it can see partners, whose user rows an MSP viewer can't.
    supabase.rpc("sdr_candidates", { p_account_id: accountId }),
    supabase.from("campaigns").select("list_id, name").eq("account_id", accountId).is("archived_at", null),
  ]);

  const names = new Map(((people ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]));
  const working = new Map<string, WorkingIt[]>();
  const add = (listId: string, w: WorkingIt) => working.set(listId, [...(working.get(listId) ?? []), w]);
  for (const a of assignments ?? []) add(a.list_id, { kind: "sdr", label: names.get(a.sdr_user_id) ?? "SDR" });
  for (const c of campaigns ?? []) add(c.list_id, { kind: "campaign", label: c.name });

  const withMembers = (listId: string): ContactRule[] => [{ field: "lists", op: "in", value: listId }, ...rules];
  const fits = await Promise.all(
    rows.map((r) => (rules.length && r.memberCount ? countMatching(supabase, accountId, withMembers(r.id)) : Promise.resolve(null)))
  );

  const cardRows: ListsCardRow[] = rows.map((r, i) => ({
    ...r,
    icpFit: fits[i] === null ? null : (fits[i] as number) / r.memberCount,
    workingIt: working.get(r.id) ?? [],
  }));

  // Listed contacts matching the ICP, each once: a contact on any list who passes every rule.
  let fitContacts = 0;
  if (rules.length && contactIds.length) {
    const query = supabase
      .from("contacts")
      .select(`id,lm:list_members!inner(list_id)${ruleEmbeds(rules)}`, { count: "exact", head: true })
      .eq("account_id", accountId)
      .is("archived_at", null);
    const { count } = await applyRules(query, rules);
    fitContacts = count ?? 0;
  }

  const icpRows = cardRows.filter((r) => r.built_from_icp);
  return {
    rows: cardRows,
    distinctContacts: contactIds.length,
    fitContacts,
    toClean: icpRows.reduce((s, r) => s + r.unsubscribed + r.bounced, 0),
    unused: cardRows.filter((r) => r.workingIt.length === 0).length,
    icpLists: icpRows.length,
  };
}
