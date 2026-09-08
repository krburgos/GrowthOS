"use client";

import {
  Briefcase,
  Building2,
  Check,
  ChevronDown,
  Columns3,
  ListChecks,
  Link2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Star,
  Tag,
  Thermometer,
  User,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";

import { AddToListDialog } from "@/components/lists/add-to-list-dialog";
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
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ContactSelectionScope } from "@/lib/contacts/bulk-actions";
import { createClient } from "@/lib/supabase/client";
import { statusBadgeVariant } from "@/lib/contacts/status-badge";
import type { ContactListRow } from "@/lib/contacts/types";
import { cn } from "@/lib/utils";

/**
 * Client-confirmed redesign ("double-click a row to edit it inline,"
 * mockup review): only the contact's own fields are editable here —
 * Company-group columns live on the shared `companies` row and stay
 * read-only (already editable from Contact Detail's Company card),
 * since changing them from one contact's row would silently change
 * every other contact at that company too. Lists membership has its
 * own always-on popover (`ListsCell`, below) independent of row-edit
 * mode, since it's a relationship, not a plain field.
 */
interface ContactDraft {
  full_name: string;
  email: string;
  title: string;
  status_id: string;
  score: string;
  temperature: "hot" | "cold" | "none";
  phone: string;
  linkedin_url: string;
  subscribed: boolean;
}

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
 *
 * Client-confirmed additions (mockup review, 2026-09-08): double-
 * clicking a row (on any cell but Lists, which has its own popover
 * regardless of edit mode) turns the whole row editable at once —
 * Save/Cancel pinned next to the name so they're never scrolled out of
 * view — rather than a cell-by-cell spreadsheet mode. Only the
 * contact's own fields become inputs (see `ContactDraft` above);
 * Company-group columns stay read-only. The Lists column collapses to
 * one pill + a "+N" overflow chip once a contact is in more than one
 * list; either opens `ListsCell`'s popover to remove a list or add a
 * new one, without leaving the table.
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

  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ContactDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const startEdit = (c: ContactListRow) => {
    if (editingId) return; // finish or cancel the row already being edited first
    setEditingId(c.id);
    setDraft({
      full_name: c.full_name,
      email: c.email,
      title: c.title ?? "",
      status_id: c.status_id,
      score: c.score != null ? String(c.score) : "",
      temperature: c.temperature ?? "none",
      phone: c.phone ?? "",
      linkedin_url: c.linkedin_url ?? "",
      subscribed: !c.email_opt_out,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const saveEdit = async () => {
    if (!editingId || !draft) return;
    if (!draft.full_name.trim() || !draft.email.trim()) {
      toast.error("Name and email can't be empty.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const [first_name, ...rest] = draft.full_name.trim().split(/\s+/);
    const { error } = await supabase
      .from("contacts")
      .update({
        first_name,
        last_name: rest.length > 0 ? rest.join(" ") : null,
        email: draft.email.trim(),
        title: draft.title.trim() || null,
        status_id: draft.status_id,
        score: draft.score.trim() ? Number(draft.score) : null,
        temperature: draft.temperature === "none" ? null : draft.temperature,
        phone: draft.phone.trim() || null,
        linkedin_url: draft.linkedin_url.trim() || null,
        email_opt_out: !draft.subscribed,
      })
      .eq("id", editingId);
    setSaving(false);

    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success("Contact updated.");
    setEditingId(null);
    setDraft(null);
    router.refresh();
  };

  const handleDraftKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };

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
              const editing = editingId === c.id;
              return (
                <tr
                  key={c.id}
                  className="group"
                  data-selected={selected ? "true" : undefined}
                  data-editing={editing ? "true" : undefined}
                  onDoubleClick={() => startEdit(c)}
                >
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
                    {editing && draft ? (
                      <div className="flex items-center gap-2">
                        <Avatar name={c.full_name} />
                        <Input
                          autoFocus
                          value={draft.full_name}
                          onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
                          onKeyDown={handleDraftKeyDown}
                          onDoubleClick={(e) => e.stopPropagation()}
                          className="h-8 w-32"
                        />
                        <button
                          type="button"
                          onClick={saveEdit}
                          disabled={saving}
                          aria-label="Save changes"
                          className="flex size-6 shrink-0 items-center justify-center rounded-md bg-success-600 text-white hover:bg-success-700 disabled:opacity-50"
                        >
                          <Check className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={saving}
                          aria-label="Cancel"
                          className="flex size-6 shrink-0 items-center justify-center rounded-md bg-neutral-200 text-neutral-600 hover:bg-neutral-300 disabled:opacity-50"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5">
                        <Avatar name={c.full_name} />
                        <Link href={`/contacts/${c.id}`} className="whitespace-nowrap font-semibold text-primary-900 hover:underline">
                          {c.full_name}
                        </Link>
                      </div>
                    )}
                  </Td>
                  <Td>
                    {editing && draft ? (
                      <Input
                        type="email"
                        value={draft.email}
                        onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                        onKeyDown={handleDraftKeyDown}
                        onDoubleClick={(e) => e.stopPropagation()}
                        className="h-8 w-44"
                      />
                    ) : (
                      <div className="flex items-center gap-2 text-neutral-600">
                        <Mail className="size-3.5 shrink-0 text-neutral-400" />
                        {c.email}
                      </div>
                    )}
                  </Td>
                  {show("title") &&
                    (editing && draft ? (
                      <Td>
                        <Input
                          value={draft.title}
                          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                          onKeyDown={handleDraftKeyDown}
                          onDoubleClick={(e) => e.stopPropagation()}
                          className="h-8 w-32"
                        />
                      </Td>
                    ) : (
                      <Td className="whitespace-nowrap">{c.title ?? "—"}</Td>
                    ))}
                  {show("status") &&
                    (editing && draft ? (
                      <Td onDoubleClick={(e) => e.stopPropagation()}>
                        <Select value={draft.status_id} onValueChange={(v) => setDraft({ ...draft, status_id: v })}>
                          <SelectTrigger className="h-8 w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statuses.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Td>
                    ) : (
                      <Td>
                        {c.contact_statuses && (
                          <Badge variant={statusBadgeVariant(c.contact_statuses.name)}>{c.contact_statuses.name}</Badge>
                        )}
                      </Td>
                    ))}
                  {show("score") &&
                    (editing && draft ? (
                      <Td>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={draft.score}
                          onChange={(e) => setDraft({ ...draft, score: e.target.value })}
                          onKeyDown={handleDraftKeyDown}
                          onDoubleClick={(e) => e.stopPropagation()}
                          className="h-8 w-16"
                        />
                      </Td>
                    ) : (
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
                    ))}
                  {show("temp") &&
                    (editing && draft ? (
                      <Td onDoubleClick={(e) => e.stopPropagation()}>
                        <Select
                          value={draft.temperature}
                          onValueChange={(v) => setDraft({ ...draft, temperature: v as ContactDraft["temperature"] })}
                        >
                          <SelectTrigger className="h-8 w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            <SelectItem value="hot">Hot</SelectItem>
                            <SelectItem value="cold">Cold</SelectItem>
                          </SelectContent>
                        </Select>
                      </Td>
                    ) : (
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
                    ))}
                  {show("employees") && <Td>{c.companies?.company_size ?? "—"}</Td>}
                  {show("lists") && (
                    <Td className="whitespace-nowrap" onDoubleClick={(e) => e.stopPropagation()}>
                      <ListsCell contactId={c.id} accountId={accountId} lists={c.lists ?? []} onChanged={() => router.refresh()} />
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
                  {show("mobile") &&
                    (editing && draft ? (
                      <Td>
                        <Input
                          value={draft.phone}
                          onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                          onKeyDown={handleDraftKeyDown}
                          onDoubleClick={(e) => e.stopPropagation()}
                          className="h-8 w-32"
                        />
                      </Td>
                    ) : (
                      <Td className="whitespace-nowrap">{c.phone ?? "—"}</Td>
                    ))}
                  {show("linkedin") &&
                    (editing && draft ? (
                      <Td>
                        <Input
                          placeholder="https://linkedin.com/in/…"
                          value={draft.linkedin_url}
                          onChange={(e) => setDraft({ ...draft, linkedin_url: e.target.value })}
                          onKeyDown={handleDraftKeyDown}
                          onDoubleClick={(e) => e.stopPropagation()}
                          className="h-8 w-40"
                        />
                      </Td>
                    ) : (
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
                    ))}
                  {show("addr") && <Td className="whitespace-nowrap">{c.companies?.address_line1 ?? "—"}</Td>}
                  {show("city") && <Td className="whitespace-nowrap">{c.companies?.city ?? "—"}</Td>}
                  {show("state") && <Td className="whitespace-nowrap">{c.companies?.state ?? "—"}</Td>}
                  {show("subscribed") &&
                    (editing && draft ? (
                      <Td onDoubleClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={draft.subscribed}
                          onClick={() => setDraft({ ...draft, subscribed: !draft.subscribed })}
                          className={cn(
                            "relative inline-flex h-[18px] w-8 items-center rounded-full transition-colors",
                            draft.subscribed ? "bg-success-600" : "bg-neutral-300"
                          )}
                        >
                          <span
                            className={cn(
                              "inline-block size-3.5 transform rounded-full bg-white transition-transform",
                              draft.subscribed ? "translate-x-[15px]" : "translate-x-1"
                            )}
                          />
                        </button>
                      </Td>
                    ) : (
                      <Td>
                        <Badge variant={c.email_opt_out ? "neutral" : "success"}>{c.email_opt_out ? "No" : "Yes"}</Badge>
                      </Td>
                    ))}
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
  onDoubleClick,
}: {
  children: ReactNode;
  sticky?: "left-0" | "left-11";
  className?: string;
  onDoubleClick?: React.MouseEventHandler<HTMLTableCellElement>;
}) {
  return (
    <td
      onDoubleClick={onDoubleClick}
      className={cn(
        "border-b border-neutral-100 bg-white px-4 py-3.5 align-middle text-neutral-700 transition-colors group-hover:bg-neutral-50 group-data-[selected=true]:bg-secondary-50 group-data-[editing=true]:bg-secondary-50",
        sticky && `sticky z-10 ${sticky}`,
        className
      )}
    >
      {children}
    </td>
  );
}

/**
 * Client-confirmed redesign ("clickable Lists column," mockup review):
 * up to one list shows as a pill; anything past that collapses into a
 * "+N" chip. Clicking either opens the same popover — every list the
 * contact is in, each removable, plus "Add to list" at the bottom,
 * reusing the same `AddToListDialog` used everywhere else lists are
 * managed. Independent of row-edit mode — list membership is a
 * relationship, not a plain field, so it stays interactive whether or
 * not the row is being edited.
 */
function ListsCell({
  contactId,
  accountId,
  lists,
  onChanged,
}: {
  contactId: string;
  accountId: string;
  lists: { id: string; name: string }[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleRemove = async (listId: string, listName: string) => {
    setRemovingId(listId);
    const supabase = createClient();
    const { error } = await supabase.from("list_members").delete().eq("list_id", listId).eq("contact_id", contactId);
    setRemovingId(null);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success(`Removed from ${listName}.`);
    onChanged();
  };

  if (lists.length === 0) {
    return <span className="text-neutral-400">—</span>;
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="inline-flex items-center gap-1">
            <span className="inline-flex items-center rounded-full border border-secondary-100 bg-secondary-50 px-2.5 py-0.5 text-caption font-medium text-secondary-800 hover:bg-secondary-100">
              {lists[0].name}
            </span>
            {lists.length > 1 && (
              <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-caption font-semibold text-neutral-600 hover:bg-neutral-200">
                +{lists.length - 1}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-60">
          <p className="px-2 pb-2 pt-1 text-caption font-semibold uppercase tracking-wide text-neutral-400">
            In {lists.length} list{lists.length === 1 ? "" : "s"}
          </p>
          <div className="flex flex-col">
            {lists.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-neutral-50">
                <span className="truncate text-body-sm text-neutral-800">{l.name}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(l.id, l.name)}
                  disabled={removingId === l.id}
                  aria-label={`Remove from ${l.name}`}
                  className="flex size-5 shrink-0 items-center justify-center rounded text-neutral-400 hover:bg-error-100 hover:text-error-700 disabled:opacity-50"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setAddOpen(true);
            }}
            className="mt-1 flex w-full items-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-2 py-1.5 text-body-sm font-medium text-secondary-700 hover:border-secondary-300 hover:bg-secondary-50"
          >
            <Plus className="size-3.5" />
            Add to list
          </button>
        </PopoverContent>
      </Popover>

      <AddToListDialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) onChanged();
        }}
        selection={{ selectAllMatching: false, selectedIds: [contactId] }}
        scope={{ mode: "all-contacts", accountId }}
        selectedCount={1}
        accountId={accountId}
      />
    </>
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
