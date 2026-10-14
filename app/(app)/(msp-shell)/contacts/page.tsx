import { Plus, Upload, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ContactsDataTable } from "@/components/contacts/contacts-data-table";
import { ContactsToolbar, type ContactView } from "@/components/contacts/contacts-toolbar";
import { InfoTip } from "@/components/ui/info-tip";
import { prospectValue, usdShort } from "@/lib/companies/value";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import type { ContactListRow } from "@/lib/contacts/types";
import { parsePagination } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Contacts — GrowthMission" };

const SORT_COLUMNS: Record<string, string> = {
  name: "full_name",
  company: "companies(name)",
  status: "contact_statuses(name)",
  owner: "users(full_name)",
  employee_size: "companies(company_size)",
  city: "companies(city)",
  state: "companies(state)",
  updated_at: "updated_at",
};

/**
 * App Flow §4.4, D1 — Contacts List. Server-driven sort (searchParams)
 * over a direct RLS-protected query, per Backend Schema §11 (no API
 * route needed for a plain read). Client-confirmed redesign: the full
 * column set now lives in ContactsDataTable (shared with List Detail).
 *
 * Client-confirmed redesign (2026-10-14, approved mockup "CRM Pages
 * Refresh"): the title carries one summary line (contacts, Prospect Value
 * and Opportunities Value, each company counted once) instead of a band of
 * tiles, and views (All / Mine / New this month / Hot) and search share
 * the table's toolbar row. Both filter on the server, so they cover every
 * contact. They are filters only; they never create or change a list.
 */
export default async function ContactsListPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string; page?: string; pageSize?: string; view?: string; q?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { sort, dir, view: rawView, q, ...pageParams } = await searchParams;
  const view: ContactView = rawView === "mine" || rawView === "new" || rawView === "hot" ? rawView : "all";
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
  // Commas and brackets would break PostgREST's or() syntax.
  const term = q?.replace(/[,()%]/g, " ").trim();
  const sortColumn = SORT_COLUMNS[sort ?? "updated_at"] ?? "updated_at";
  const ascending = dir !== "desc";
  const { page, pageSize, from, to } = parsePagination(pageParams);

  const supabase = await createClient();
  // One filter, applied to the page of rows and to its total alike.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scoped = (query: any, v: ContactView = view) => {
    let out = query.eq("account_id", user.account_id).is("archived_at", null);
    if (v === "mine") out = out.eq("owner_id", user.id);
    if (v === "new") out = out.gte("created_at", monthStart);
    if (v === "hot") out = out.eq("temperature", "hot");
    if (term) out = out.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
    return out;
  };
  const countOf = (v: ContactView) => {
    let out = supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("account_id", user.account_id)
      .is("archived_at", null);
    if (v === "mine") out = out.eq("owner_id", user.id);
    if (v === "new") out = out.gte("created_at", monthStart);
    if (v === "hot") out = out.eq("temperature", "hot");
    return out;
  };

  const [
    { data: rows },
    { count: totalCount },
    { data: statuses },
    { data: owners },
    { count: allCount },
    { count: mineCount },
    { count: newCount },
    { count: hotCount },
    companySizes,
  ] = await Promise.all([
    scoped(
      supabase
        .from("contacts")
        .select(
          "id, first_name, last_name, full_name, title, email, phone, score, temperature, linkedin_url, email_opt_out, status_id, contact_statuses(name), company_id, companies(name, phone, address_line1, city, state, company_size, linkedin_url), owner_id, users(full_name), updated_at"
        )
    )
      .order(sortColumn, { ascending, referencedTable: sortColumn.includes("(") ? sortColumn.split("(")[0] : undefined })
      .range(from, to),
    scoped(supabase.from("contacts").select("*", { count: "exact", head: true })),
    supabase
      .from("contact_statuses")
      .select("id, name")
      .eq("account_id", user.account_id)
      .is("archived_at", null)
      .order("sort_order"),
    supabase
      .from("users")
      .select("id, full_name")
      .eq("account_id", user.account_id)
      .is("archived_at", null)
      .order("full_name"),
    countOf("all"),
    countOf("mine"),
    countOf("new"),
    countOf("hot"),
    // Every company's size, for the summary line: each company counted
    // once, however many contacts it has. Paged, past PostgREST's 1,000 cap.
    (async () => {
      const out: (string | null)[] = [];
      for (let lo = 0; ; lo += 1000) {
        const { data } = await supabase
          .from("companies")
          .select("company_size")
          .eq("account_id", user.account_id)
          .is("archived_at", null)
          .order("id")
          .range(lo, lo + 999);
        out.push(...(data ?? []).map((c) => c.company_size as string | null));
        if (!data || data.length < 1000) break;
      }
      return out;
    })(),
  ]);
  // The same filter, for bulk actions: "Select all N" must mean these N.
  const scope = {
    mode: "all-contacts" as const,
    accountId: user.account_id!,
    filter: {
      ownerId: view === "mine" ? user.id : undefined,
      createdSince: view === "new" ? monthStart : undefined,
      hot: view === "hot" || undefined,
      term: term || undefined,
    },
  };
  const totalProspect = companySizes.reduce((sum, size) => sum + prospectValue(size), 0);

  const contacts = (rows ?? []) as unknown as ContactListRow[];

  if (contacts.length > 0) {
    const [{ data: activityRows }, { data: listRows }] = await Promise.all([
      // Last Activity Date (App Flow §4.4, D1): not sorted on yet — no
      // real data until Milestone 8's activity logging, folded in here
      // as a follow-up aggregate query since it isn't a plain column.
      supabase
        .from("activities")
        .select("contact_id, occurred_at")
        .in("contact_id", contacts.map((c) => c.id))
        .order("occurred_at", { ascending: false }),
      supabase
        .from("list_members")
        .select("contact_id, lists(id, name)")
        .in("contact_id", contacts.map((c) => c.id)),
    ]);

    const lastActivityByContact = new Map<string, string>();
    for (const row of activityRows ?? []) {
      if (row.contact_id && !lastActivityByContact.has(row.contact_id)) {
        lastActivityByContact.set(row.contact_id, row.occurred_at);
      }
    }

    const listsByContact = new Map<string, { id: string; name: string }[]>();
    for (const row of (listRows ?? []) as unknown as {
      contact_id: string;
      lists: { id: string; name: string } | { id: string; name: string }[] | null;
    }[]) {
      const list = Array.isArray(row.lists) ? row.lists[0] : row.lists;
      if (!list) continue;
      const existing = listsByContact.get(row.contact_id) ?? [];
      existing.push(list);
      listsByContact.set(row.contact_id, existing);
    }

    for (const c of contacts) {
      c.last_activity_at = lastActivityByContact.get(c.id) ?? null;
      c.lists = listsByContact.get(c.id) ?? [];
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col p-6 md:p-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1 text-primary-900">Contacts</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-body text-neutral-500">
            <span>
              <b className="font-bold tabular-nums text-primary-900">{(allCount ?? 0).toLocaleString()}</b> contacts
            </span>
            <span aria-hidden="true" className="text-neutral-300">·</span>
            <span className="inline-flex items-center gap-1.5">
              <b className="font-bold tabular-nums text-primary-900">{usdShort(totalProspect)}</b> Prospect Value
              <InfoTip text="$200 × Employees × 12 for every company, each counted once however many contacts it has." label="About Prospect Value" />
            </span>
            <span aria-hidden="true" className="text-neutral-300">·</span>
            <span className="inline-flex items-center gap-1.5">
              <b className="font-bold tabular-nums text-primary-900">{usdShort(totalProspect * 3)}</b> Opportunities Value
              <InfoTip text="3 × Prospect Value." label="About Opportunities Value" />
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" asChild>
            <Link href="/contacts/import">
              <Upload className="mr-1.5 size-4" />
              Import Contacts
            </Link>
          </Button>
          <Button asChild>
            <Link href="/contacts/new">
              <Plus className="mr-1.5 size-4" />
              Add Contact
            </Link>
          </Button>
        </div>
      </div>

      {(allCount ?? 0) === 0 ? (
        <EmptyState icon={Users} />
      ) : contacts.length === 0 ? (
        <>
          <ContactsDataTable
            contacts={[]}
            totalCount={0}
            accountId={user.account_id!}
            statuses={(statuses ?? []).map((s) => ({ id: s.id, label: s.name }))}
            owners={(owners ?? []).map((o) => ({ id: o.id, label: o.full_name }))}
            scope={scope}
            toolbar={
              <ContactsToolbar
                view={view}
                counts={{ all: allCount ?? 0, mine: mineCount ?? 0, new: newCount ?? 0, hot: hotCount ?? 0 }}
              />
            }
          />
          <p className="mt-3 rounded-lg border border-neutral-200 bg-white py-10 text-center text-body-sm text-neutral-500">
            No contacts match this view{term ? ` and "${term}"` : ""}.
          </p>
        </>
      ) : (
        <>
          <ContactsDataTable
            contacts={contacts}
            totalCount={totalCount ?? contacts.length}
            accountId={user.account_id!}
            statuses={(statuses ?? []).map((s) => ({ id: s.id, label: s.name }))}
            owners={(owners ?? []).map((o) => ({ id: o.id, label: o.full_name }))}
            scope={scope}
            toolbar={
              <ContactsToolbar
                view={view}
                counts={{ all: allCount ?? 0, mine: mineCount ?? 0, new: newCount ?? 0, hot: hotCount ?? 0 }}
              />
            }
          />
          <PaginationBar page={page} pageSize={pageSize} totalCount={totalCount ?? 0} />
        </>
      )}
    </main>
  );
}
