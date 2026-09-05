import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DeleteListButton } from "@/components/lists/delete-list-button";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SortableHeader } from "@/components/ui/sortable-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Lists — GrowthOS" };

const EDIT_ROLES = ["msp_owner", "msp_admin", "msp_marketing", "cro_admin", "cro_advisor"];

/**
 * App Flow §4.6, F1 — Lists Index. Name, member count, type
 * (static/smart). Smart list counts are computed live
 * (compute_smart_list_members(), Backend Schema §7.4) rather than
 * stored, matching how List Detail (F2) is required to work.
 *
 * Client-confirmed additions: Bounced/Unsubscribed columns (matching a
 * reference CRM's layout) ahead of Campaigns (Milestone 10) existing.
 * Unsubscribed is real today — contacts.email_opt_out already exists —
 * it's just always 0 in practice until something sets it (the campaign
 * unsubscribe link). Bounced has no data source at all without
 * campaign send history, so it's a hardcoded 0 placeholder until that
 * milestone is built. Type and Active columns were both removed per
 * client feedback (Type badge stays on List Detail).
 *
 * Sorting is applied in JS after the per-list counts are computed,
 * rather than a SQL ORDER BY — those counts come from a follow-up
 * Promise.all, not a plain column, and a handful of lists per account
 * doesn't carry the same "tens of thousands of rows" scale concern
 * that drove Contacts' server-side sort (PRD §6.1).
 */
export default async function ListsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const canEdit = EDIT_ROLES.includes(user.role);
  const supabase = await createClient();

  const { data: lists } = await supabase
    .from("lists")
    .select("id, name, type, created_at")
    .eq("account_id", user.account_id)
    .is("archived_at", null);

  const listsWithCounts = await Promise.all(
    (lists ?? []).map(async (list) => {
      let contactIds: string[];
      if (list.type === "static") {
        const { data } = await supabase.from("list_members").select("contact_id").eq("list_id", list.id);
        contactIds = (data ?? []).map((r) => r.contact_id);
      } else {
        const { data } = await supabase.rpc("compute_smart_list_members", { p_list_id: list.id });
        contactIds = (data ?? []).map((r: { contact_id: string }) => r.contact_id);
      }

      let unsubscribed = 0;
      if (contactIds.length > 0) {
        const { count } = await supabase
          .from("contacts")
          .select("*", { count: "exact", head: true })
          .in("id", contactIds)
          .eq("email_opt_out", true);
        unsubscribed = count ?? 0;
      }

      const bounced = 0; // No data source until Campaigns (Milestone 10) exists.

      return { ...list, memberCount: contactIds.length, bounced, unsubscribed };
    })
  );

  const { sort, dir } = await searchParams;
  const ascending = dir !== "desc";
  const sortAccessors: Record<string, (l: (typeof listsWithCounts)[number]) => string | number> = {
    name: (l) => l.name.toLowerCase(),
    contacts: (l) => l.memberCount,
    created_at: (l) => l.created_at,
    bounced: (l) => l.bounced,
    unsubscribed: (l) => l.unsubscribed,
  };
  const accessor = sortAccessors[sort ?? "created_at"] ?? sortAccessors.created_at;
  listsWithCounts.sort((a, b) => {
    const av = accessor(a);
    const bv = accessor(b);
    if (av < bv) return ascending ? -1 : 1;
    if (av > bv) return ascending ? 1 : -1;
    return 0;
  });

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-h1 text-primary-900">Lists</h1>
        {canEdit && (
          <div className="flex gap-2">
            <Button asChild variant="secondary">
              <Link href="/lists/upload">Upload List</Link>
            </Button>
            <Button asChild>
              <Link href="/lists/new">Create List</Link>
            </Button>
          </div>
        )}
      </div>

      {listsWithCounts.length === 0 ? (
        <EmptyState icon={ListChecks} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><SortableHeader field="name" label="Name" /></TableHead>
              <TableHead><SortableHeader field="contacts" label="Contacts" /></TableHead>
              <TableHead><SortableHeader field="created_at" label="Date Added" /></TableHead>
              <TableHead><SortableHeader field="bounced" label="Bounced" /></TableHead>
              <TableHead><SortableHeader field="unsubscribed" label="Unsubscribed" /></TableHead>
              {canEdit && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {listsWithCounts.map((list) => (
              <TableRow key={list.id}>
                <TableCell className="font-medium text-neutral-800">
                  <Link href={`/lists/${list.id}`} className="block">
                    {list.name}
                  </Link>
                </TableCell>
                <TableCell>{list.memberCount}</TableCell>
                <TableCell>{new Date(list.created_at).toLocaleDateString()}</TableCell>
                <TableCell>{list.bounced}</TableCell>
                <TableCell>{list.unsubscribed}</TableCell>
                {canEdit && (
                  <TableCell>
                    <DeleteListButton listId={list.id} listName={list.name} />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
