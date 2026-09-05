"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { MoveOrCopyDialog } from "@/components/lists/move-or-copy-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
 * Client-confirmed hybrid smart lists: Remove, bulk-select, and
 * Move/Copy now work on both list types. For a static list, Remove is
 * a plain list_members delete. For a smart list, "removing" a contact
 * means excluding them (list_exclusions insert) since they might be a
 * live criteria match with no list_members row to delete — the exclude
 * always applies regardless of whether they were a manual add or a
 * natural match (Backend Schema §7.4, compute_smart_list_members).
 */
export function ListMembersTable({
  members,
  listId,
  listType,
  accountId,
  canEdit,
}: {
  members: ListMemberRow[];
  listId: string;
  listType: "static" | "smart";
  accountId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveOpen, setMoveOpen] = useState(false);

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(members.map((m) => m.id)) : new Set());
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const allSelected = members.length > 0 && selected.size === members.length;

  const handleRemove = async (contactId: string) => {
    setPendingId(contactId);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let error;
    if (listType === "smart") {
      ({ error } = await supabase.from("list_exclusions").upsert(
        { list_id: listId, contact_id: contactId, excluded_by: user!.id },
        { onConflict: "list_id,contact_id", ignoreDuplicates: true }
      ));
      if (!error) {
        await supabase.from("list_members").delete().eq("list_id", listId).eq("contact_id", contactId);
      }
    } else {
      ({ error } = await supabase.from("list_members").delete().eq("list_id", listId).eq("contact_id", contactId));
    }
    setPendingId(null);

    if (error) {
      toast.error(error.message);
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3">
      {canEdit && selected.size > 0 && (
        <div className="flex items-center justify-between rounded-md border border-secondary-200 bg-secondary-50 px-4 py-2">
          <span className="text-body-sm text-secondary-800">{selected.size} selected</span>
          <Button size="sm" onClick={() => setMoveOpen(true)}>
            Move / Copy to List
          </Button>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            {canEdit && (
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={(c) => toggleAll(!!c)} aria-label="Select all" />
              </TableHead>
            )}
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Status</TableHead>
            {canEdit && <TableHead>Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => (
            <TableRow key={m.id} selected={selected.has(m.id)}>
              {canEdit && (
                <TableCell>
                  <Checkbox
                    checked={selected.has(m.id)}
                    onCheckedChange={(checked) => toggleOne(m.id, !!checked)}
                    aria-label={`Select ${m.full_name}`}
                  />
                </TableCell>
              )}
              <TableCell className="font-medium text-neutral-800">
                <Link href={`/contacts/${m.id}`}>{m.full_name}</Link>
              </TableCell>
              <TableCell>{m.email}</TableCell>
              <TableCell>{m.company_name ?? "—"}</TableCell>
              <TableCell>
                {m.status_name && <Badge variant={statusBadgeVariant(m.status_name)}>{m.status_name}</Badge>}
              </TableCell>
              {canEdit && (
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

      {canEdit && (
        <MoveOrCopyDialog
          open={moveOpen}
          onOpenChange={setMoveOpen}
          currentListId={listId}
          currentListType={listType}
          accountId={accountId}
          selectedContactIds={[...selected]}
          onDone={() => setSelected(new Set())}
        />
      )}
    </div>
  );
}
