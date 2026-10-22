/**
 * SDR Outreach Call Desk server reads (client-confirmed, 2026-10-22).
 *
 * Server-only: this imports the Supabase server client, so client
 * components import lib/sdr/desk.ts instead. Everything goes through the
 * session client under RLS.
 */

import type {
  Assignment,
  DailyTarget,
  QueueRow,
  RecentCall,
  SdrPerson,
} from "@/lib/sdr/desk";
import { createClient } from "@/lib/supabase/server";

export interface SdrDesk {
  people: SdrPerson[];
  assignments: Assignment[];
  /** Queue per SDR who holds at least one list. */
  queues: Record<string, QueueRow[]>;
  recentCalls: RecentCall[];
  /** Targets CRO Leader has set, by SDR; anyone missing uses DEFAULT_TARGET. */
  targets: Record<string, DailyTarget>;
  /** Every live list with its size, for the Assign list dialog. */
  lists: { id: string; name: string; contacts: number }[];
  /** FME Scheduled, or the first open stage when an account renamed it. */
  meetingStageId: string | null;
  /** Account users a booked meeting can be with. */
  salespeople: { id: string; full_name: string }[];
}

async function listSizes(listIds: string[]): Promise<Map<string, number>> {
  const sizes = new Map<string, number>();
  if (listIds.length === 0) return sizes;
  const supabase = await createClient();
  // Paged, past PostgREST's 1,000-row cap.
  for (let lo = 0; ; lo += 1000) {
    const { data } = await supabase
      .from("list_members")
      .select("list_id")
      .in("list_id", listIds)
      .order("list_id")
      .range(lo, lo + 999);
    for (const r of data ?? [])
      sizes.set(r.list_id, (sizes.get(r.list_id) ?? 0) + 1);
    if (!data || data.length < 1000) break;
  }
  return sizes;
}

export async function getSdrDesk(accountId: string): Promise<SdrDesk> {
  const supabase = await createClient();

  const [
    { data: people },
    { data: assignmentRows },
    { data: listRows },
    { data: stages },
    { data: salespeople },
    { data: targetRows },
  ] = await Promise.all([
    supabase.rpc("sdr_candidates", { p_account_id: accountId }),
    supabase
      .from("sdr_list_assignments")
      .select("id, list_id, sdr_user_id, lists(name)")
      .eq("account_id", accountId)
      .is("archived_at", null),
    supabase
      .from("lists")
      .select("id, name")
      .eq("account_id", accountId)
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("opportunity_stages")
      .select("id, name, stage_group, sort_order")
      .eq("account_id", accountId)
      .is("archived_at", null)
      .order("sort_order"),
    supabase
      .from("users")
      .select("id, full_name")
      .eq("account_id", accountId)
      .is("archived_at", null)
      .order("full_name"),
    supabase
      .from("sdr_daily_targets")
      .select("sdr_user_id, calls, meetings")
      .eq("account_id", accountId)
      .is("archived_at", null),
  ]);

  const sizes = await listSizes((listRows ?? []).map((l) => l.id));

  const assignments: Assignment[] = (assignmentRows ?? []).map((a) => {
    const list = Array.isArray(a.lists) ? a.lists[0] : a.lists;
    return {
      id: a.id,
      list_id: a.list_id,
      list_name: (list as { name: string } | null)?.name ?? "—",
      sdr_user_id: a.sdr_user_id,
      contacts: sizes.get(a.list_id) ?? 0,
    };
  });

  const sdrIds = [...new Set(assignments.map((a) => a.sdr_user_id))];
  const since = new Date(Date.now() - 2 * 86_400_000).toISOString();

  const [queueResults, { data: calls }] = await Promise.all([
    Promise.all(
      sdrIds.map((id) =>
        supabase.rpc("sdr_call_queue", {
          p_account_id: accountId,
          p_sdr_user_id: id,
        }),
      ),
    ),
    sdrIds.length > 0
      ? supabase
          .from("activities")
          .select("user_id, call_outcome, occurred_at")
          .eq("account_id", accountId)
          .eq("type", "call")
          .is("archived_at", null)
          .in("user_id", sdrIds)
          .gte("occurred_at", since)
      : Promise.resolve({ data: [] as RecentCall[] }),
  ]);

  const queues: Record<string, QueueRow[]> = {};
  sdrIds.forEach((id, i) => {
    queues[id] = (queueResults[i].data ?? []) as QueueRow[];
  });

  const open = (stages ?? []).filter((s) => s.stage_group === "open");
  const meetingStage =
    open.find((s) => s.name.trim().toLowerCase() === "fme scheduled") ??
    open[0] ??
    null;

  return {
    people: (people ?? []) as SdrPerson[],
    assignments,
    queues,
    recentCalls: (calls ?? []) as RecentCall[],
    targets: Object.fromEntries(
      (targetRows ?? []).map((t) => [
        t.sdr_user_id,
        { calls: t.calls, meetings: t.meetings },
      ]),
    ),
    lists: (listRows ?? []).map((l) => ({
      id: l.id,
      name: l.name,
      contacts: sizes.get(l.id) ?? 0,
    })),
    meetingStageId: meetingStage?.id ?? null,
    salespeople: salespeople ?? [],
  };
}
