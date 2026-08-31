import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

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
 */
export default async function ListsIndexPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const canEdit = EDIT_ROLES.includes(user.role);
  const supabase = await createClient();

  const { data: lists } = await supabase
    .from("lists")
    .select("id, name, type")
    .eq("account_id", user.account_id)
    .is("archived_at", null)
    .order("name");

  const listsWithCounts = await Promise.all(
    (lists ?? []).map(async (list) => {
      if (list.type === "static") {
        const { count } = await supabase
          .from("list_members")
          .select("*", { count: "exact", head: true })
          .eq("list_id", list.id);
        return { ...list, memberCount: count ?? 0 };
      }
      const { data } = await supabase.rpc("compute_smart_list_members", { p_list_id: list.id });
      return { ...list, memberCount: data?.length ?? 0 };
    })
  );

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-h1 text-primary-900">Lists</h1>
        {canEdit && (
          <Button asChild>
            <Link href="/lists/new">Create List</Link>
          </Button>
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
              <TableHead>Members</TableHead>
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
