"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { statusBadgeVariant } from "@/lib/contacts/status-badge";
import { createClient } from "@/lib/supabase/client";

export interface ListMemberRow {
  id: string;
  full_name: string;
  email: string;
  company_name: string | null;
  status_name: string | null;
}

/**
 * App Flow §4.6, F2 — List Detail. "The list's member contacts as a
 * table (reusing the Contacts List columns), plus add/remove actions."
 * Remove is only offered for static lists — smart list membership is
 * computed, not stored (Backend Schema §7.4).
 */
export function ListMembersTable({
  members,
  listId,
  canEdit,
  isStatic,
}: {
  members: ListMemberRow[];
  listId: string;
  canEdit: boolean;
  isStatic: boolean;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleRemove = async (contactId: string) => {
    setPendingId(contactId);
    const supabase = createClient();
    const { error } = await supabase
      .from("list_members")
      .delete()
      .eq("list_id", listId)
      .eq("contact_id", contactId);
    setPendingId(null);

    if (error) {
      toast.error(error.message);
      return;
    }
    router.refresh();
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Company</TableHead>
          <TableHead>Status</TableHead>
          {canEdit && isStatic && <TableHead>Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((m) => (
          <TableRow key={m.id}>
            <TableCell className="font-medium text-neutral-800">
              <Link href={`/contacts/${m.id}`}>{m.full_name}</Link>
            </TableCell>
            <TableCell>{m.email}</TableCell>
            <TableCell>{m.company_name ?? "—"}</TableCell>
            <TableCell>
              {m.status_name && <Badge variant={statusBadgeVariant(m.status_name)}>{m.status_name}</Badge>}
            </TableCell>
            {canEdit && isStatic && (
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendingId === m.id}
                  onClick={() => handleRemove(m.id)}
                >
                  Remove
                </Button>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
