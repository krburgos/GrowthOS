import { Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ContactsDataTable } from "@/components/contacts/contacts-data-table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import type { ContactListRow } from "@/lib/contacts/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Contacts — GrowthOS" };

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
 * "Lists" shows static list_members only (smart-list live criteria
 * matches aren't evaluated per row here, for performance).
 */
export default async function ContactsListPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { sort, dir } = await searchParams;
  const sortColumn = SORT_COLUMNS[sort ?? "updated_at"] ?? "updated_at";
  const ascending = dir !== "desc";

  const supabase = await createClient();
  const [{ data: rows }, { count: totalCount }, { data: statuses }, { data: owners }] = await Promise.all([
    supabase
      .from("contacts")
      .select(
        "id, first_name, last_name, full_name, title, email, phone, score, temperature, linkedin_url, email_opt_out, status_id, contact_statuses(name), company_id, companies(name, phone, address_line1, city, state, company_size), owner_id, users(full_name), updated_at"
      )
      .eq("account_id", user.account_id)
      .is("archived_at", null)
      .order(sortColumn, { ascending, referencedTable: sortColumn.includes("(") ? sortColumn.split("(")[0] : undefined })
      .limit(100),
    supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("account_id", user.account_id)
      .is("archived_at", null),
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
  ]);

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
        .select("contact_id, lists(name)")
        .in("contact_id", contacts.map((c) => c.id)),
    ]);

    const lastActivityByContact = new Map<string, string>();
    for (const row of activityRows ?? []) {
      if (row.contact_id && !lastActivityByContact.has(row.contact_id)) {
        lastActivityByContact.set(row.contact_id, row.occurred_at);
      }
    }

    const listNamesByContact = new Map<string, string[]>();
    for (const row of (listRows ?? []) as unknown as { contact_id: string; lists: { name: string } | { name: string }[] | null }[]) {
      const list = Array.isArray(row.lists) ? row.lists[0] : row.lists;
      if (!list) continue;
      const existing = listNamesByContact.get(row.contact_id) ?? [];
      existing.push(list.name);
      listNamesByContact.set(row.contact_id, existing);
    }

    for (const c of contacts) {
      c.last_activity_at = lastActivityByContact.get(c.id) ?? null;
      c.list_names = listNamesByContact.get(c.id) ?? [];
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-h1 text-primary-900">Contacts</h1>
        <div className="flex gap-3">
          <Button variant="secondary" asChild>
            <Link href="/contacts/import">Import Contacts</Link>
          </Button>
          <Button asChild>
            <Link href="/contacts/new">Add Contact</Link>
          </Button>
        </div>
      </div>

      {contacts.length === 0 ? (
        <EmptyState icon={Users} />
      ) : (
        <ContactsDataTable
          contacts={contacts}
          totalCount={totalCount ?? contacts.length}
          accountId={user.account_id!}
          statuses={(statuses ?? []).map((s) => ({ id: s.id, label: s.name }))}
          owners={(owners ?? []).map((o) => ({ id: o.id, label: o.full_name }))}
          scope={{ mode: "all-contacts", accountId: user.account_id! }}
        />
      )}
    </main>
  );
}
