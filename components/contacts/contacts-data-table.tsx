"use client";

import {
  Briefcase,
  Building2,
  ListChecks,
  Link2,
  Mail,
  MapPin,
  Phone,
  Star,
  Tag,
  Thermometer,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { ContactsBulkToolbar, type ContactSelectionState } from "@/components/contacts/contacts-bulk-toolbar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { ContactSelectionScope } from "@/lib/contacts/bulk-actions";
import { statusBadgeVariant } from "@/lib/contacts/status-badge";
import type { ContactListRow } from "@/lib/contacts/types";
import { cn } from "@/lib/utils";

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
 *
 * Client-confirmed visual pass ("Concept A — Navy Command Bar" from the
 * mockup review): solid primary-900 header instead of the light
 * neutral-50 wash, generous padding, Full Name + checkbox columns
 * pinned while the rest scrolls, and selected rows get a secondary-50
 * tint plus a secondary-500 left rail rather than just a background
 * change. Custom markup rather than the shared Table primitives — this
 * table's density/pinning needs are specific to it; the shared
 * components (Lists, Users & Roles, etc.) are untouched.
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

      <div className="overflow-x-auto rounded-lg border border-neutral-200 shadow-sm">
        <table className="w-full min-w-[1400px] border-collapse text-body">
          <thead>
            <tr>
              <Th sticky="left-0" className="w-11">
                <Checkbox
                  checked={selection.selectAllMatching || allLoadedSelected}
                  onCheckedChange={(c) => toggleAll(!!c)}
                  aria-label="Select all"
                  className="border-white/50 data-[state=checked]:border-secondary-400 data-[state=checked]:bg-secondary-400"
                />
              </Th>
              <Th sticky="left-11" className="border-r border-primary-800">
                <User className="size-3.5" /> Full Name
              </Th>
              <Th>
                <Mail className="size-3.5" /> Email
              </Th>
              <Th>
                <Briefcase className="size-3.5" /> Title
              </Th>
              <Th>
                <Tag className="size-3.5" /> Contact Status
              </Th>
              <Th>
                <Star className="size-3.5" /> Score
              </Th>
              <Th>
                <Thermometer className="size-3.5" /> Temp
              </Th>
              <Th>
                <Users className="size-3.5" /> Employees
              </Th>
              <Th>
                <ListChecks className="size-3.5" /> Lists
              </Th>
              <Th>
                <Building2 className="size-3.5" /> Company
              </Th>
              <Th>
                <Phone className="size-3.5" /> Company Phone
              </Th>
              <Th>
                <Phone className="size-3.5" /> Mobile Phone
              </Th>
              <Th>
                <Link2 className="size-3.5" /> LinkedIn
              </Th>
              <Th>
                <MapPin className="size-3.5" /> Company Address 1
              </Th>
              <Th>
                <MapPin className="size-3.5" /> Company City
              </Th>
              <Th>
                <MapPin className="size-3.5" /> Company State
              </Th>
              <Th>Subscribed</Th>
              <Th>Bounced</Th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => {
              const selected = isSelected(c.id);
              return (
                <tr key={c.id} className="group" data-selected={selected ? "true" : undefined}>
                  <Td sticky="left-0" className="w-11">
                    <span className="relative flex items-center justify-center">
                      {selected && (
                        <span className="absolute -left-4 top-1/2 h-8 w-[3px] -translate-y-1/2 bg-secondary-500" />
                      )}
                      <Checkbox
                        checked={selected}
                        onCheckedChange={(checked) => toggleOne(c.id, !!checked)}
                        aria-label={`Select ${c.full_name}`}
                      />
                    </span>
                  </Td>
                  <Td sticky="left-11" className="border-r border-neutral-200">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={c.full_name} />
                      <Link href={`/contacts/${c.id}`} className="whitespace-nowrap font-semibold text-primary-900 hover:underline">
                        {c.full_name}
                      </Link>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2 text-neutral-600">
                      <Mail className="size-3.5 shrink-0 text-neutral-400" />
                      {c.email}
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap">{c.title ?? "—"}</Td>
                  <Td>
                    {c.contact_statuses && (
                      <Badge variant={statusBadgeVariant(c.contact_statuses.name)}>{c.contact_statuses.name}</Badge>
                    )}
                  </Td>
                  <Td>
                    {c.score != null ? (
                      <div className="flex items-center gap-2">
                        <span className="font-semibold tabular-nums text-primary-900">{c.score}</span>
                        <span className="h-1.5 w-11 overflow-hidden rounded-full bg-neutral-200">
                          <span
                            className="block h-full rounded-full bg-secondary-500"
                            style={{ width: `${Math.max(0, Math.min(100, c.score))}%` }}
                          />
                        </span>
                      </div>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    {c.temperature ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-body-sm font-semibold",
                          c.temperature === "hot" ? "text-error-600" : "text-primary-500"
                        )}
                      >
                        <Thermometer className="size-3.5" />
                        {c.temperature === "hot" ? "Hot" : "Cold"}
                      </span>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>{c.companies?.company_size ?? "—"}</Td>
                  <Td className="whitespace-nowrap">
                    {c.list_names && c.list_names.length > 0 ? c.list_names.join(", ") : "—"}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {c.companies?.name ? (
                      <div className="flex items-center gap-2">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-500">
                          <Building2 className="size-3.5" />
                        </span>
                        {c.companies.name}
                      </div>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">{c.companies?.phone ?? "—"}</Td>
                  <Td className="whitespace-nowrap">{c.phone ?? "—"}</Td>
                  <Td>
                    {c.linkedin_url ? (
                      <a
                        href={c.linkedin_url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`${c.full_name}'s LinkedIn`}
                        className="flex size-7 items-center justify-center rounded-full bg-secondary-50 text-secondary-700 transition-colors hover:bg-secondary-700 hover:text-white"
                      >
                        <Link2 className="size-3.5" />
                      </a>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">{c.companies?.address_line1 ?? "—"}</Td>
                  <Td className="whitespace-nowrap">{c.companies?.city ?? "—"}</Td>
                  <Td className="whitespace-nowrap">{c.companies?.state ?? "—"}</Td>
                  <Td>
                    <Badge variant={c.email_opt_out ? "neutral" : "success"}>{c.email_opt_out ? "No" : "Yes"}</Badge>
                  </Td>
                  <Td className="text-neutral-400">0</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  children,
  sticky,
  className,
}: {
  children: ReactNode;
  sticky?: "left-0" | "left-11";
  className?: string;
}) {
  return (
    <th
      className={cn(
        "sticky top-0 z-20 whitespace-nowrap bg-primary-900 px-4 py-4 text-left text-caption font-semibold tracking-wide text-white",
        sticky && `z-30 ${sticky}`,
        className
      )}
    >
      <span className="flex items-center gap-2 [&>svg]:text-white/70">{children}</span>
    </th>
  );
}

function Td({
  children,
  sticky,
  className,
}: {
  children: ReactNode;
  sticky?: "left-0" | "left-11";
  className?: string;
}) {
  return (
    <td
      className={cn(
        "border-b border-neutral-100 bg-white px-4 py-3.5 align-middle text-neutral-700 transition-colors group-hover:bg-neutral-50 group-data-[selected=true]:bg-secondary-50",
        sticky && `sticky z-10 ${sticky}`,
        className
      )}
    >
      {children}
    </td>
  );
}

const AVATAR_COLORS = ["bg-primary-500", "bg-secondary-700", "bg-success-600", "bg-primary-800"];

function Avatar({ name }: { name: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const hash = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const color = AVATAR_COLORS[hash % AVATAR_COLORS.length];

  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full text-caption font-semibold text-white",
        color
      )}
    >
      {initials}
    </span>
  );
}
