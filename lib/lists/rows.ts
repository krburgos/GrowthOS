import type { SupabaseClient } from "@supabase/supabase-js";

import type { ListRow } from "@/components/lists/lists-table";
import { prospectValue } from "@/lib/companies/value";

/**
 * Every live list of an account with its counts, health and Prospect Value
 * (moved out of the Lists Index so the List Building Mission Card reads the
 * same numbers; client-confirmed, 2026-10-23, approved mockup "ICP & List
 * Building Cards"). The behaviour is the Lists Index's own, unchanged:
 *
 * Bounced is real: a member counts as bounced if any campaign send to them
 * bounced (campaign_recipients.bounced_at) or the contact is stamped
 * bounced. Unsubscribed is contacts.email_opt_out. Active is everyone else.
 * Three reads for the whole account (lists, members with their contacts and
 * companies, and bounces), joined here.
 */
export async function getListRows(
  supabase: SupabaseClient,
  accountId: string
): Promise<{ rows: ListRow[]; contactIds: string[]; listedValue: number; unsubTotal: number }> {

  const { data: lists } = await supabase
    .from("lists")
    .select("id, name, created_at, built_from_icp")
    .eq("account_id", accountId)
    .is("archived_at", null);

  const listIds = (lists ?? []).map((l) => l.id);

  // Members come with their contact and company through a join, so no
  // request carries a long list of ids, and both reads page through 1,000
  // rows at a time (PostgREST's cap) so a big list is never cut short.
  type MemberRow = {
    list_id: string;
    contact_id: string;
    contacts:
      | { email_opt_out: boolean; email_bounced_at?: string | null; companies: { id: string; company_size: string | null } | { id: string; company_size: string | null }[] | null }
      | { email_opt_out: boolean; email_bounced_at?: string | null; companies: { id: string; company_size: string | null } | { id: string; company_size: string | null }[] | null }[]
      | null;
  };
  const memberRows: MemberRow[] =
    listIds.length > 0
      ? await readAll<MemberRow>((lo, hi) =>
          supabase
            .from("list_members")
            .select("list_id, contact_id, contacts(email_opt_out, email_bounced_at, companies(id, company_size))")
            .in("list_id", listIds)
            .order("contact_id")
            .range(lo, hi)
        )
      : [];
  const bounceRows = await readAll<{ contact_id: string }>((lo, hi) =>
    supabase
      .from("campaign_recipients")
      .select("contact_id, campaigns!inner(account_id)")
      .eq("campaigns.account_id", accountId)
      .not("bounced_at", "is", null)
      .order("contact_id")
      .range(lo, hi)
  );

  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  const contacts = new Map<string, { optOut: boolean; bounced: boolean; companyId: string | null; value: number }>();
  for (const m of memberRows) {
    const c = one(m.contacts);
    const co = one(c?.companies ?? null);
    contacts.set(m.contact_id, { optOut: !!c?.email_opt_out, bounced: !!c?.email_bounced_at, companyId: co?.id ?? null, value: prospectValue(co?.company_size) });
  }
  const contactIds = [...contacts.keys()];
  const bounced = new Set(bounceRows.map((r) => r.contact_id));

  const membersByList = new Map<string, string[]>();
  for (const m of memberRows) {
    const arr = membersByList.get(m.list_id);
    if (arr) arr.push(m.contact_id);
    else membersByList.set(m.list_id, [m.contact_id]);
  }

  const rows: ListRow[] = (lists ?? []).map((list) => {
    const members = membersByList.get(list.id) ?? [];
    let unsubscribed = 0;
    let bouncedCount = 0;
    const companyValue = new Map<string, number>();
    for (const id of members) {
      const c = contacts.get(id);
      if (!c) continue;
      if (c.optOut) unsubscribed += 1;
      else if (c.bounced || bounced.has(id)) bouncedCount += 1;
      if (c.companyId) companyValue.set(c.companyId, c.value);
    }
    return {
      ...list,
      memberCount: members.length,
      unsubscribed,
      bounced: bouncedCount,
      active: members.length - unsubscribed - bouncedCount,
      prospectValue: [...companyValue.values()].reduce((s, v) => s + v, 0),
    };
  });

  // Strip figures over every list, companies counted once across all of them.
  const allCompanies = new Map<string, number>();
  for (const id of contactIds) {
    const c = contacts.get(id);
    if (c?.companyId) allCompanies.set(c.companyId, c.value);
  }
  const listedValue = [...allCompanies.values()].reduce((s, v) => s + v, 0);
  const unsubTotal = contactIds.filter((id) => contacts.get(id)?.optOut).length;

  return { rows, contactIds, listedValue, unsubTotal };
}

/** Reads every row of a query, 1,000 at a time. */
export async function readAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error || !data) break;
    out.push(...(data as T[]));
    if (data.length < 1000) break;
  }
  return out;
}
