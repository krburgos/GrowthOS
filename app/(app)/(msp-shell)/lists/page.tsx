import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DeleteListButton } from "@/components/lists/delete-list-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
 * Client-confirmed additions: Bounced/Unsubscribed/Active columns
 * (matching a reference CRM's layout) ahead of Campaigns (Milestone 10)
 * existing. Unsubscribed is real today — contacts.email_opt_out already
 * exists — it's just always 0 in practice until something sets it
 * (the campaign unsubscribe link). Bounced has no data source at all
 * without campaign send history, so it's a hardcoded 0 placeholder
 * until that milestone is built.
 */
export default async function ListsIndexPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const canEdit = EDIT_ROLES.includes(user.role);
  const supabase = await createClient();

  const { data: lists } = await supabase
    .from("lists")
    .select("id, name, type, created_at")
    .eq("account_id", user.account_id)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

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

      return {
        ...list,
        memberCount: contactIds.length,
        bounced,
        unsubscribed,
        active: contactIds.length - bounced - unsubscribed,
      };
    })
  );

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
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Contacts</TableHead>
              <TableHead>Date Added</TableHead>
              <TableHead>Bounced</TableHead>
              <TableHead>Unsubscribed</TableHead>
              <TableHead>Active</TableHead>
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
                <TableCell>
                  <Badge variant={list.type === "smart" ? "info" : "neutral"}>
                    {list.type === "smart" ? "Smart" : "Static"}
                  </Badge>
                </TableCell>
                <TableCell>{list.memberCount}</TableCell>
                <TableCell>{new Date(list.created_at).toLocaleDateString()}</TableCell>
                <TableCell>{list.bounced}</TableCell>
                <TableCell>{list.unsubscribed}</TableCell>
                <TableCell>{list.active}</TableCell>
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
