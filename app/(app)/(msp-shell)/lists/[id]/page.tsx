import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddContactsButton } from "@/components/lists/add-contacts-button";
import { DeleteListButton } from "@/components/lists/delete-list-button";
import { ListMembersTable, type ListMemberRow } from "@/components/lists/list-members-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "List — GrowthOS" };

const EDIT_ROLES = ["msp_owner", "msp_admin", "msp_marketing", "cro_admin", "cro_advisor"];

/**
 * App Flow §4.6, F2 — List Detail. Smart list membership is computed
 * live via compute_smart_list_members() on every view (Backend Schema
 * §7.4, updated by the smart_list_manual_overrides migration) — never
 * cached, but client-confirmed to now also fold in manual list_members
 * additions and list_exclusions, so Upload/Add/Move/Remove all work on
 * smart lists too, not just static ones.
 */
export default async function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { id } = await params;
  const supabase = await createClient();

  const { data: list } = await supabase
    .from("lists")
    .select("id, name, type")
    .eq("id", id)
    .is("archived_at", null)
    .single();

  if (!list) notFound();

  const canEdit = EDIT_ROLES.includes(user.role);
  let members: ListMemberRow[] = [];

  if (list.type === "static") {
    const { data } = await supabase
      .from("list_members")
      .select("contacts(id, full_name, email, companies(name), contact_statuses(name))")
      .eq("list_id", id);

    members = (data ?? [])
      .map((row) => {
        const c = row.contacts as unknown as {
          id: string;
          full_name: string;
          email: string;
          companies: { name: string } | { name: string }[] | null;
          contact_statuses: { name: string } | { name: string }[] | null;
        } | null;
        if (!c) return null;
        const company = Array.isArray(c.companies) ? c.companies[0] : c.companies;
        const status = Array.isArray(c.contact_statuses) ? c.contact_statuses[0] : c.contact_statuses;
        return {
          id: c.id,
          full_name: c.full_name,
          email: c.email,
          company_name: company?.name ?? null,
          status_name: status?.name ?? null,
        };
      })
      .filter((m): m is ListMemberRow => m !== null);
  } else {
    const { data: memberIds } = await supabase.rpc("compute_smart_list_members", { p_list_id: id });
    const ids = (memberIds ?? []).map((r: { contact_id: string }) => r.contact_id);

    if (ids.length > 0) {
      const { data } = await supabase
        .from("contacts")
        .select("id, full_name, email, companies(name), contact_statuses(name)")
        .in("id", ids);

      members = (data ?? []).map((c) => {
        const company = Array.isArray(c.companies) ? c.companies[0] : c.companies;
        const status = Array.isArray(c.contact_statuses) ? c.contact_statuses[0] : c.contact_statuses;
        return {
          id: c.id,
          full_name: c.full_name,
          email: c.email,
          company_name: (company as { name: string } | undefined)?.name ?? null,
          status_name: (status as { name: string } | undefined)?.name ?? null,
        };
      });
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-6 md:p-8">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-h1 text-primary-900">{list.name}</h1>
          <Badge variant={list.type === "smart" ? "info" : "neutral"}>
            {list.type === "smart" ? "Smart" : "Static"}
          </Badge>
        </div>
        {canEdit && <DeleteListButton listId={list.id} listName={list.name} redirectTo="/lists" />}
      </div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-body text-neutral-500">
          {members.length} member{members.length === 1 ? "" : "s"}
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

      {members.length === 0 ? (
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
        <ListMembersTable
          members={members}
          listId={list.id}
          listType={list.type}
          accountId={user.account_id!}
          canEdit={canEdit}
        />
      )}
    </main>
  );
}
