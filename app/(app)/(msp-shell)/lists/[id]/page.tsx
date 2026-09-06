import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddContactsButton } from "@/components/lists/add-contacts-button";
import { ContactsDataTable } from "@/components/contacts/contacts-data-table";
import { ListActionsMenu } from "@/components/lists/list-actions-menu";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import type { ContactListRow } from "@/lib/contacts/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "List — GrowthOS" };

const EDIT_ROLES = ["msp_owner", "msp_admin", "msp_marketing", "cro_admin", "cro_advisor"];

const CONTACT_FIELDS =
  "id, first_name, last_name, full_name, title, email, phone, score, temperature, linkedin_url, email_opt_out, status_id, contact_statuses(name), company_id, companies(name, phone, address_line1, city, state, company_size, linkedin_url)";

/**
 * App Flow §4.6, F2 — List Detail. Client-confirmed redesign: shares
 * ContactsDataTable's full column set with the All Contacts view; the
 * extra Move-to/Remove-from-list actions come from passing
 * currentListId.
 */
export default async function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { id } = await params;
  const supabase = await createClient();

  const { data: list } = await supabase
    .from("lists")
    .select("id, name")
    .eq("id", id)
    .is("archived_at", null)
    .single();

  if (!list) notFound();

  const canEdit = EDIT_ROLES.includes(user.role);
  let contacts: ContactListRow[] = [];

  const { data } = await supabase.from("list_members").select(`contacts(${CONTACT_FIELDS})`).eq("list_id", id);
  contacts = (data ?? [])
    .map((row) => {
      const c = row.contacts as unknown as ContactListRow | ContactListRow[] | null;
      return Array.isArray(c) ? c[0] : c;
    })
    .filter((c): c is ContactListRow => !!c);

  if (contacts.length > 0) {
    const { data: listRows } = await supabase
      .from("list_members")
      .select("contact_id, lists(name)")
      .in("contact_id", contacts.map((c) => c.id));

    const listNamesByContact = new Map<string, string[]>();
    for (const row of (listRows ?? []) as unknown as {
      contact_id: string;
      lists: { name: string } | { name: string }[] | null;
    }[]) {
      const l = Array.isArray(row.lists) ? row.lists[0] : row.lists;
      if (!l) continue;
      const existing = listNamesByContact.get(row.contact_id) ?? [];
      existing.push(l.name);
      listNamesByContact.set(row.contact_id, existing);
    }
    for (const c of contacts) {
      c.list_names = listNamesByContact.get(c.id) ?? [];
    }
  }

  const [{ data: statuses }, { data: owners }] = await Promise.all([
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

  return (
    <main className="mx-auto w-full max-w-[1800px] flex-1 p-6 md:p-8">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-h1 text-primary-900">{list.name}</h1>
        {canEdit && <ListActionsMenu listId={list.id} listName={list.name} redirectOnDelete="/lists" />}
      </div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-body text-neutral-500">
          {contacts.length} member{contacts.length === 1 ? "" : "s"}
        </p>
        {canEdit && (
          <div className="flex gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link href={`/lists/${list.id}/upload`}>Upload Contacts</Link>
            </Button>
            <AddContactsButton listId={list.id} accountId={user.account_id!} />
          </div>
        )}
      </div>

      {contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          action={
            canEdit ? (
              <Button asChild size="sm">
                <Link href={`/lists/${list.id}/upload`}>Upload Contacts</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ContactsDataTable
          contacts={contacts}
          totalCount={contacts.length}
          accountId={user.account_id!}
          statuses={(statuses ?? []).map((s) => ({ id: s.id, label: s.name }))}
          owners={(owners ?? []).map((o) => ({ id: o.id, label: o.full_name }))}
          scope={{ mode: "list", listId: list.id }}
          currentListId={list.id}
        />
      )}
    </main>
  );
}
