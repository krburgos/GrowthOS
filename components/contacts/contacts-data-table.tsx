"use client";

import Link from "next/link";
import { useState } from "react";

import { ContactsBulkToolbar, type ContactSelectionState } from "@/components/contacts/contacts-bulk-toolbar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ContactSelectionScope } from "@/lib/contacts/bulk-actions";
import { statusBadgeVariant } from "@/lib/contacts/status-badge";
import type { ContactListRow } from "@/lib/contacts/types";

/**
 * Client-confirmed redesign, modeled on a reference CRM's Contacts
 * table: every requested column (Email, Full Name, Title, Contact
 * Status, Score, Temp, Employees, Lists, Company, Company Phone,
 * Mobile Phone, LinkedIn, Company Address 1, Company City, Company
 * State, Subscribed, Bounced), horizontally scrollable rather than
 * wrapping, no per-row Actions column — every mutation happens through
 * the bulk toolbar instead. Shared between the All Contacts view and a
 * list's Detail page; `currentListId`/`currentListType` being set is
 * what enables Move-to/Remove-from-list there.
 */
export function ContactsDataTable({
  contacts,
  totalCount,
  accountId,
  statuses,
  owners,
  scope,
  currentListId,
  currentListType,
}: {
  contacts: ContactListRow[];
  totalCount: number;
  accountId: string;
  statuses: { id: string; label: string }[];
  owners: { id: string; label: string }[];
  scope: ContactSelectionScope;
  currentListId?: string;
  currentListType?: "static" | "smart";
}) {
  const [selection, setSelection] = useState<ContactSelectionState>({
    selectedIds: new Set(),
    selectAllMatching: false,
  });

  const toggleAll = (checked: boolean) => {
    setSelection({
      selectAllMatching: false,
      selectedIds: checked ? new Set(contacts.map((c) => c.id)) : new Set(),
    });
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelection((prev) => {
      const next = new Set(prev.selectedIds);
      if (checked) next.add(id);
      else next.delete(id);
      return { selectAllMatching: false, selectedIds: next };
    });
  };

  const clear = () => setSelection({ selectedIds: new Set(), selectAllMatching: false });
  const allLoadedSelected = contacts.length > 0 && selection.selectedIds.size === contacts.length;
  const isSelected = (id: string) => selection.selectAllMatching || selection.selectedIds.has(id);

  return (
    <div className="flex flex-col gap-3">
      <ContactsBulkToolbar
        selection={selection}
        scope={scope}
        accountId={accountId}
        totalCount={totalCount}
        statuses={statuses}
        owners={owners}
        currentListId={currentListId}
        currentListType={currentListType}
        onClear={clear}
        onSelectAllMatching={() => setSelection((prev) => ({ ...prev, selectAllMatching: true }))}
        onActionComplete={clear}
      />

      <div className="overflow-x-auto rounded-md border border-neutral-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={selection.selectAllMatching || allLoadedSelected}
                  onCheckedChange={(c) => toggleAll(!!c)}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Full Name</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Contact Status</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Temp</TableHead>
              <TableHead>Employees</TableHead>
              <TableHead>Lists</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Company Phone</TableHead>
              <TableHead>Mobile Phone</TableHead>
              <TableHead>LinkedIn</TableHead>
              <TableHead>Company Address 1</TableHead>
              <TableHead>Company City</TableHead>
              <TableHead>Company State</TableHead>
              <TableHead>Subscribed</TableHead>
              <TableHead>Bounced</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((c) => (
              <TableRow key={c.id} selected={isSelected(c.id)}>
                <TableCell>
                  <Checkbox
                    checked={isSelected(c.id)}
                    onCheckedChange={(checked) => toggleOne(c.id, !!checked)}
                    aria-label={`Select ${c.full_name}`}
                  />
                </TableCell>
                <TableCell>{c.email}</TableCell>
                <TableCell className="font-medium text-neutral-800">
                  <Link href={`/contacts/${c.id}`} className="whitespace-nowrap">
                    {c.full_name}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-nowrap">{c.title ?? "—"}</TableCell>
                <TableCell>
                  {c.contact_statuses && (
                    <Badge variant={statusBadgeVariant(c.contact_statuses.name)}>{c.contact_statuses.name}</Badge>
                  )}
                </TableCell>
                <TableCell>{c.score ?? "—"}</TableCell>
                <TableCell>
                  {c.temperature && (
                    <Badge variant={c.temperature === "hot" ? "error" : "info"}>
                      {c.temperature === "hot" ? "Hot" : "Cold"}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{c.companies?.company_size ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {c.list_names && c.list_names.length > 0 ? c.list_names.join(", ") : "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap">{c.companies?.name ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{c.companies?.phone ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{c.phone ?? "—"}</TableCell>
                <TableCell>
                  {c.linkedin_url ? (
                    <a
                      href={c.linkedin_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary-700 hover:underline"
                    >
                      Profile
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">{c.companies?.address_line1 ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{c.companies?.city ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{c.companies?.state ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={c.email_opt_out ? "neutral" : "success"}>
                    {c.email_opt_out ? "No" : "Yes"}
                  </Badge>
                </TableCell>
                <TableCell>0</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
