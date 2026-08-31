"use client";

import { useState } from "react";
import Link from "next/link";

import { AddToListDialog } from "@/components/lists/add-to-list-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SortableHeader } from "@/components/ui/sortable-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ContactListRow } from "@/lib/contacts/types";
import { statusBadgeVariant } from "@/lib/contacts/status-badge";

/**
 * App Flow §4.6 — static list membership via "bulk-select from the
 * contacts table" (Implementation Plan Milestone 7), added onto the
 * Milestone 6 Contacts List. Design System §8.5 — secondary-800
 * checkbox on selected rows.
 */
export function ContactsTable({ contacts, accountId }: { contacts: ContactListRow[]; accountId: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addToListOpen, setAddToListOpen] = useState(false);

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(contacts.map((c) => c.id)) : new Set());
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const allSelected = contacts.length > 0 && selected.size === contacts.length;

  return (
    <div className="flex flex-col gap-3">
      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-md border border-secondary-200 bg-secondary-50 px-4 py-2">
          <span className="text-body-sm text-secondary-800">{selected.size} selected</span>
          <Button size="sm" onClick={() => setAddToListOpen(true)}>
            Add to List
          </Button>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox checked={allSelected} onCheckedChange={(c) => toggleAll(!!c)} aria-label="Select all" />
            </TableHead>
            <TableHead><SortableHeader field="name" label="Name" /></TableHead>
            <TableHead><SortableHeader field="company" label="Company" /></TableHead>
            <TableHead><SortableHeader field="status" label="Status" /></TableHead>
            <TableHead><SortableHeader field="owner" label="Owner" /></TableHead>
            <TableHead><SortableHeader field="employee_size" label="Employee Size" /></TableHead>
            <TableHead>Last Activity Date</TableHead>
            <TableHead><SortableHeader field="city" label="Company City" /></TableHead>
            <TableHead><SortableHeader field="state" label="Company State" /></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((c) => (
            <TableRow key={c.id} selected={selected.has(c.id)}>
              <TableCell>
                <Checkbox
                  checked={selected.has(c.id)}
                  onCheckedChange={(checked) => toggleOne(c.id, !!checked)}
                  aria-label={`Select ${c.full_name}`}
                />
              </TableCell>
              <TableCell className="font-medium text-neutral-800">
                <Link href={`/contacts/${c.id}`} className="block">
                  {c.full_name}
                </Link>
              </TableCell>
              <TableCell>{c.companies?.name ?? "—"}</TableCell>
              <TableCell>
                {c.contact_statuses && (
                  <Badge variant={statusBadgeVariant(c.contact_statuses.name)}>
                    {c.contact_statuses.name}
                  </Badge>
                )}
              </TableCell>
              <TableCell>{c.users?.full_name ?? "Unassigned"}</TableCell>
              <TableCell>{c.companies?.company_size ?? "—"}</TableCell>
              <TableCell>
                {c.last_activity_at ? new Date(c.last_activity_at).toLocaleDateString() : "—"}
              </TableCell>
              <TableCell>{c.companies?.city ?? "—"}</TableCell>
              <TableCell>{c.companies?.state ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AddToListDialog
        open={addToListOpen}
        onOpenChange={setAddToListOpen}
        contactIds={[...selected]}
        accountId={accountId}
      />
    </div>
  );
}
