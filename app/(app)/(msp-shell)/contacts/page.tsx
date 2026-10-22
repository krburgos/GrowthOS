import { Plus, Upload, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ContactsDataTable } from "@/components/contacts/contacts-data-table";
import { ContactsFilterChips } from "@/components/contacts/contacts-filter-panel";
import { applyRules, decodeRules, isActive, ruleEmbeds, type RuleOptions } from "@/lib/contacts/filters";
import { ContactsToolbar, type ContactView } from "@/components/contacts/contacts-toolbar";
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
  searchParams: Promise<{
    sort?: string;
    dir?: string;
    page?: string;
    pageSize?: string;
    view?: string;
    q?: string;
    f?: string | string[];
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { sort, dir, view: rawView, q, f, ...pageParams } = await searchParams;
  // The filter panel's rows (client-confirmed, 2026-10-22, approved mockup
  // "Contacts Filters"). Each rule that reads another table gets its own
  // aliased embed, so the same rules can narrow the rows, the total and
  // "Select all N" alike.
  const rules = decodeRules(f).filter(isActive);
  const embeds: string = ruleEmbeds(rules);
  const now = new Date();
  const view: ContactView = rawView === "mine" || rawView === "new" || rawView === "hot" ? rawView : "all";
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
  // contacts has two links to users since 2026-10-14 (owner_id and
  // notes_updated_by), so the salesperson embed names its foreign key;
  // a bare users(...) is ambiguous and PostgREST refuses it (HTTP 300).
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
    return applyRules(out, rules, now);
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
    companyFacts,
    { data: listRows },
  ] = await Promise.all([
    scoped(
      supabase
        .from("contacts")
        .select(
          ("id, first_name, last_name, full_name, title, email, phone, score, temperature, linkedin_url, email_opt_out, status_id, contact_statuses(name, color), company_id, companies(name, phone, address_line1, city, state, company_size, linkedin_url), owner_id, users:users!contacts_owner_id_fkey(full_name), updated_at" +
            embeds) as string
        )
    )
      .order(sortColumn, { ascending, referencedTable: sortColumn.includes("(") ? sortColumn.split("(")[0] : undefined })
      .range(from, to),
    scoped(supabase.from("contacts").select(`id${embeds}` as string, { count: "exact", head: true })),
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
    // once, however many contacts it has. Its state too, for the State
    // filter's choices. Paged, past PostgREST's 1,000 cap.
    (async () => {
      const out: { size: string | null; state: string | null }[] = [];
      for (let lo = 0; ; lo += 1000) {
        const { data } = await supabase
          .from("companies")
          .select("company_size, state")
          .eq("account_id", user.account_id)
          .is("archived_at", null)
          .order("id")
          .range(lo, lo + 999);
        out.push(...(data ?? []).map((c) => ({ size: c.company_size as string | null, state: c.state as string | null })));
        if (!data || data.length < 1000) break;
      }
      return out;
    })(),
    supabase.from("lists").select("id, name").eq("account_id", user.account_id).is("archived_at", null).order("name"),
  ]);
  const companySizes = companyFacts.map((c) => c.size);
  const filterOptions: RuleOptions = {
    statuses: (statuses ?? []).map((s) => ({ id: s.id, label: s.name })),
    owners: (owners ?? []).map((o) => ({ id: o.id, label: o.full_name })),
    lists: (listRows ?? []).map((l) => ({ id: l.id, label: l.name })),
    states: [...new Set(companyFacts.map((c) => c.state?.trim()).filter((s): s is string => !!s))].sort(),
  };
  // The same filter, for bulk actions: "Select all N" must mean these N.
  const scope = {
    mode: "all-contacts" as const,
    accountId: user.account_id!,
    filter: {
      ownerId: view === "mine" ? user.id : undefined,
      createdSince: view === "new" ? monthStart : undefined,
      hot: view === "hot" || undefined,
      term: term || undefined,
      rules: rules.length > 0 ? rules : undefined,
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

  const toolbar = (
    <ContactsToolbar
      view={view}
      counts={{ all: allCount ?? 0, mine: mineCount ?? 0, new: newCount ?? 0, hot: hotCount ?? 0 }}
      filterOptions={filterOptions}
    />
  );
  const chips = <ContactsFilterChips options={filterOptions} shown={totalCount ?? 0} total={allCount ?? 0} />;

  return (
    <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col p-6 md:p-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1 text-primary-900">Contacts</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-body text-neutral-500">
            <span>
              <b className="font-bold tabular-nums text-primary-900">{(allCount ?? 0).toLocaleString()}</b> {allCount === 1 ? "Contact" : "Contacts"}
            </span>
            <span aria-hidden="true" className="text-neutral-300">·</span>
            <span className="inline-flex items-center gap-1.5">
              <b className="font-bold tabular-nums text-primary-900">{usdShort(totalProspect)}</b> Prospect Value
            </span>
            <span aria-hidden="true" className="text-neutral-300">·</span>
            <span className="inline-flex items-center gap-1.5">
              <b className="font-bold tabular-nums text-primary-900">{usdShort(totalProspect * 3)}</b> Opportunities Value
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
        // An empty account has nothing to filter.
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
            toolbar={toolbar}
            belowToolbar={chips}
          />
          <p className="mt-3 rounded-lg border border-neutral-200 bg-white py-10 text-center text-body-sm text-neutral-500">
            No contacts match this view{term ? ` and "${term}"` : ""}{rules.length > 0 ? " with these filters" : ""}.
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
            toolbar={toolbar}
            belowToolbar={chips}
          />
          <PaginationBar page={page} pageSize={pageSize} totalCount={totalCount ?? 0} />
        </>
      )}
    </main>
  );
}
