"use client";

import {
  Briefcase,
  Building2,
  ChevronDown,
  Columns3,
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
import { useEffect, useState, type ReactNode } from "react";

import { ContactsBulkToolbar, type ContactSelectionState } from "@/components/contacts/contacts-bulk-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ContactSelectionScope } from "@/lib/contacts/bulk-actions";
import { statusBadgeVariant } from "@/lib/contacts/status-badge";
import type { ContactListRow } from "@/lib/contacts/types";
import { cn } from "@/lib/utils";

/**
 * Impeccable critique finding (2026-09-06, P1): every role saw all 18
 * columns unconditionally, with no way to trim the table to what a
 * given role actually uses. Full Name and Email stay permanently
 * visible (Full Name is also the sticky/pinned column); everything
 * else is toggleable via the Columns menu below, persisted per browser
 * in localStorage so nobody re-configures it every session.
 */
type ColumnKey =
  | "title"
  | "status"
  | "score"
  | "temp"
  | "employees"
  | "lists"
  | "company"
  | "cphone"
  | "mobile"
  | "linkedin"
  | "companyLinkedin"
  | "addr"
  | "city"
  | "state"
  | "subscribed"
  | "bounced";

const COLUMN_GROUPS: { label: string; columns: { key: ColumnKey; label: string }[] }[] = [
  {
    label: "Contact",
    columns: [
      { key: "title", label: "Title" },
      { key: "status", label: "Contact Status" },
      { key: "score", label: "Score" },
      { key: "temp", label: "Temp" },
      { key: "lists", label: "Lists" },
      { key: "mobile", label: "Mobile Phone" },
      { key: "linkedin", label: "Person LinkedIn" },
    ],
  },
  {
    label: "Company",
    columns: [
      { key: "employees", label: "Employees" },
      { key: "company", label: "Company" },
      // Client-confirmed addition alongside companies.linkedin_url —
      // not part of the original 18-column request, but toggleable and
      // visible under the "All columns" preset like every other column.
      { key: "companyLinkedin", label: "Company LinkedIn" },
      { key: "cphone", label: "Company Phone" },
      { key: "addr", label: "Company Address" },
      { key: "city", label: "Company City" },
      { key: "state", label: "Company State" },
    ],
  },
  {
    label: "Marketing",
    columns: [
      { key: "subscribed", label: "Subscribed" },
      { key: "bounced", label: "Bounced" },
    ],
  },
];

const ALL_COLUMN_KEYS = COLUMN_GROUPS.flatMap((g) => g.columns.map((c) => c.key));

const PRESETS: Record<"all" | "compact" | "sales", ColumnKey[]> = {
  all: ALL_COLUMN_KEYS,
  compact: ["title", "status"],
  sales: ["title", "status", "score", "temp", "company"],
};

const COLUMNS_STORAGE_KEY = "growthos.contacts.visibleColumns";

function loadVisibleColumns(): Set<ColumnKey> {
  if (typeof window === "undefined") return new Set(ALL_COLUMN_KEYS);
  try {
    const raw = window.localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (!raw) return new Set(ALL_COLUMN_KEYS);
    const parsed = JSON.parse(raw) as string[];
    const valid = parsed.filter((k): k is ColumnKey => (ALL_COLUMN_KEYS as string[]).includes(k));
    return new Set(valid);
  } catch {
    return new Set(ALL_COLUMN_KEYS);
  }
}

/**
 * Client-confirmed redesign, modeled on a reference CRM's Contacts
 * table: every requested column (Email, Full Name, Title, Contact
 * Status, Score, Temp, Employees, Lists, Company, Company Phone,
 * Mobile Phone, LinkedIn, Company Address 1, Company City, Company
 * State, Subscribed, Bounced), horizontally scrollable rather than
 * wrapping, no per-row Actions column — every mutation happens through
 * the bulk toolbar instead. Shared between the All Contacts view and a
 * list's Detail page; `currentListId` being set is what enables
 * Move-to/Remove-from-list there.
 *
 * Client-confirmed visual pass ("Concept A — Navy Command Bar" from the
 * mockup review): solid primary-900 header instead of the light
 * neutral-50 wash, generous padding, Full Name + checkbox columns
 * pinned while the rest scrolls, and selected rows get a secondary-50
 * tint plus a secondary-500 left rail rather than just a background
 * change. Custom markup rather than the shared Table primitives — this
 * table's density/pinning needs are specific to it; the shared
 * components (Lists, Users & Roles, etc.) are untouched.
 *
 * Impeccable critique finding (2026-09-06, P1) + fix: every role saw
 * all 18 columns unconditionally, with no way to trim them to what a
 * given role actually needs. The Columns menu + All/Compact/Sales
 * presets above the table let a user hide any column but Full Name and
 * Email; the choice persists per browser via localStorage (Phase 1 —
 * a real per-user settings row is a natural follow-up once one exists).
 */
export function ContactsDataTable({
  contacts,
  totalCount,
  accountId,
  statuses,
  owners,
  scope,
  currentListId,
}: {
  contacts: ContactListRow[];
  totalCount: number;
  accountId: string;
  statuses: { id: string; label: string }[];
  owners: { id: string; label: string }[];
  scope: ContactSelectionScope;
  currentListId?: string;
}) {
  const [selection, setSelection] = useState<ContactSelectionState>({
    selectedIds: new Set(),
    selectAllMatching: false,
  });
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(() => new Set(ALL_COLUMN_KEYS));
  const [columnsHydrated, setColumnsHydrated] = useState(false);

  useEffect(() => {
    setVisibleColumns(loadVisibleColumns());
    setColumnsHydrated(true);
  }, []);

  useEffect(() => {
    if (!columnsHydrated) return;
    window.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify([...visibleColumns]));
  }, [visibleColumns, columnsHydrated]);

  const show = (key: ColumnKey) => visibleColumns.has(key);
  const toggleColumn = (key: ColumnKey, checked: boolean) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };
  const applyPreset = (preset: keyof typeof PRESETS) => setVisibleColumns(new Set(PRESETS[preset]));

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
        onClear={clear}
        onSelectAllMatching={() => setSelection((prev) => ({ ...prev, selectAllMatching: true }))}
        onActionComplete={clear}
      />

      <div className="flex items-center gap-2">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => applyPreset("all")}
            className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-caption font-medium text-neutral-600 transition-colors hover:border-primary-700 hover:text-primary-800"
          >
            All columns
          </button>
          <button
            type="button"
            onClick={() => applyPreset("compact")}
            className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-caption font-medium text-neutral-600 transition-colors hover:border-primary-700 hover:text-primary-800"
          >
            Compact
          </button>
          <button
            type="button"
            onClick={() => applyPreset("sales")}
            className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-caption font-medium text-neutral-600 transition-colors hover:border-primary-700 hover:text-primary-800"
          >
            Sales
          </button>
        </div>
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="secondary" size="sm" className="gap-1.5">
                <Columns3 className="size-4" />
                Columns
                <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {COLUMN_GROUPS.map((group) => (
                <div key={group.label} className="mb-1 last:mb-0">
                  <p className="px-2 pb-1 pt-2 text-caption font-semibold uppercase tracking-wide text-neutral-400">
                    {group.label}
                  </p>
                  {group.columns.map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col.key}
                      checked={show(col.key)}
                      onCheckedChange={(checked) => toggleColumn(col.key, checked)}
                    >
                      {col.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 shadow-sm">
        <table
          className="w-full border-collapse text-body"
          style={{ minWidth: `${560 + visibleColumns.size * 130}px` }}
        >
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
              {show("title") && (
                <Th>
                  <Briefcase className="size-3.5" /> Title
                </Th>
              )}
              {show("status") && (
                <Th>
                  <Tag className="size-3.5" /> Contact Status
                </Th>
              )}
              {show("score") && (
                <Th>
                  <Star className="size-3.5" /> Score
                </Th>
              )}
              {show("temp") && (
                <Th>
                  <Thermometer className="size-3.5" /> Temp
                </Th>
              )}
              {show("employees") && (
                <Th>
                  <Users className="size-3.5" /> Employees
                </Th>
              )}
              {show("lists") && (
                <Th>
                  <ListChecks className="size-3.5" /> Lists
                </Th>
              )}
              {show("company") && (
                <Th>
                  <Building2 className="size-3.5" /> Company
                </Th>
              )}
              {show("companyLinkedin") && (
                <Th>
                  <Link2 className="size-3.5" /> Company LinkedIn
                </Th>
              )}
              {show("cphone") && (
                <Th>
                  <Phone className="size-3.5" /> Company Phone
                </Th>
              )}
              {show("mobile") && (
                <Th>
                  <Phone className="size-3.5" /> Mobile Phone
                </Th>
              )}
              {show("linkedin") && (
                <Th>
                  <Link2 className="size-3.5" /> Person LinkedIn
                </Th>
              )}
              {show("addr") && (
                <Th>
                  <MapPin className="size-3.5" /> Company Address
                </Th>
              )}
              {show("city") && (
                <Th>
                  <MapPin className="size-3.5" /> Company City
                </Th>
              )}
              {show("state") && (
                <Th>
                  <MapPin className="size-3.5" /> Company State
                </Th>
              )}
              {show("subscribed") && <Th>Subscribed</Th>}
              {show("bounced") && <Th>Bounced</Th>}
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
                  {show("title") && <Td className="whitespace-nowrap">{c.title ?? "—"}</Td>}
                  {show("status") && (
                    <Td>
                      {c.contact_statuses && (
                        <Badge variant={statusBadgeVariant(c.contact_statuses.name)}>{c.contact_statuses.name}</Badge>
                      )}
                    </Td>
                  )}
                  {show("score") && (
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
                  )}
                  {show("temp") && (
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
                  )}
                  {show("employees") && <Td>{c.companies?.company_size ?? "—"}</Td>}
                  {show("lists") && (
                    <Td className="whitespace-nowrap">
                      {c.list_names && c.list_names.length > 0 ? c.list_names.join(", ") : "—"}
                    </Td>
                  )}
                  {show("company") && (
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
                  )}
                  {show("companyLinkedin") && (
                    <Td>
                      {c.companies?.linkedin_url ? (
                        <a
                          href={c.companies.linkedin_url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`${c.companies.name}'s LinkedIn`}
                          className="flex size-7 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition-colors hover:bg-primary-700 hover:text-white"
                        >
                          <Link2 className="size-3.5" />
                        </a>
                      ) : (
                        "—"
                      )}
                    </Td>
                  )}
                  {show("cphone") && <Td className="whitespace-nowrap">{c.companies?.phone ?? "—"}</Td>}
                  {show("mobile") && <Td className="whitespace-nowrap">{c.phone ?? "—"}</Td>}
                  {show("linkedin") && (
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
                  )}
                  {show("addr") && <Td className="whitespace-nowrap">{c.companies?.address_line1 ?? "—"}</Td>}
                  {show("city") && <Td className="whitespace-nowrap">{c.companies?.city ?? "—"}</Td>}
                  {show("state") && <Td className="whitespace-nowrap">{c.companies?.state ?? "—"}</Td>}
                  {show("subscribed") && (
                    <Td>
                      <Badge variant={c.email_opt_out ? "neutral" : "success"}>{c.email_opt_out ? "No" : "Yes"}</Badge>
                    </Td>
                  )}
                  {show("bounced") && <Td className="text-neutral-400">0</Td>}
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
