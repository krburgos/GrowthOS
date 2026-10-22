"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Briefcase,
  Building2,
  Check,
  ChevronDown,
  Columns3,
  GripVertical,
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
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Children, isValidElement, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";

import { AddToListDialog } from "@/components/lists/add-to-list-dialog";
import { ContactsBulkToolbar, type ContactSelectionState } from "@/components/contacts/contacts-bulk-toolbar";
import { StatusPill } from "@/components/contacts/status-pill";
import { LinkedInLogo } from "@/components/icons/linkedin-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ContactSelectionScope } from "@/lib/contacts/bulk-actions";
import { createClient } from "@/lib/supabase/client";
import type { ContactListRow } from "@/lib/contacts/types";
import { employeesOf, opportunitiesValue, prospectValue, usd } from "@/lib/companies/value";
import { cn } from "@/lib/utils";

/**
 * Client-confirmed redesign ("double-click a row to edit it inline,"
 * mockup review): originally only the contact's own fields were editable
 * here, Company-group columns staying read-only because they live on the
 * shared `companies` row. Superseded 2026-10-22 at the client's request:
 * Employees, Company LinkedIn, Company Phone, Address, City and State edit
 * too (see `company` below), and the save says it changed the company for
 * everyone there. Company name stays read-only. Lists membership has its
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
  /**
   * The contact's company fields (client-confirmed, 2026-10-22, reversing
   * the read-only rule above at the client's request). They live on the
   * shared `companies` row, so saving changes them for every contact at
   * that company; each input's tooltip and the save message say so. Null when the
   * contact has no company. The company's name stays read-only: renaming
   * it from one contact is more likely a mistake than a rename.
   */
  company: CompanyDraft | null;
}

interface CompanyDraft {
  company_size: string;
  linkedin_url: string;
  phone: string;
  address_line1: string;
  city: string;
  state: string;
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
  | "bounced"
  | "pv"
  | "ov";

/**
 * Column widths (client-confirmed, 2026-10-18, approved mockup "Contacts
 * Column Widths"). Every column starts at a set width, so one long title
 * no longer stretches its whole column; text that doesn't fit ends in an
 * ellipsis and shows in full on hover. Dragging a heading's right edge
 * resizes it between MIN_WIDTH and MAX_WIDTH, double-clicking the edge
 * resets it, and the widths persist per browser like the visible columns.
 */
type WidthKey = ColumnKey | "name" | "email";

// Widened 2026-10-22 so every heading fits beside its sort arrow at the
// default width (seen cut short in the live app). A width someone has
// dragged is kept; these only apply to columns left alone.
const DEFAULT_WIDTHS: Record<WidthKey, number> = {
  name: 200,
  linkedin: 185,
  email: 240,
  title: 220,
  status: 185,
  score: 125,
  temp: 115,
  pv: 175,
  ov: 210,
  employees: 155,
  lists: 200,
  company: 220,
  companyLinkedin: 200,
  cphone: 190,
  mobile: 165,
  addr: 230,
  city: 175,
  state: 180,
  subscribed: 145,
  bounced: 130,
};

const MIN_WIDTH = 80;
const MAX_WIDTH = 600;
/** The pinned checkbox column, which is not resizable. */
const SELECT_WIDTH = 44;
const WIDTHS_STORAGE_KEY = "growthmission.contacts.columnWidths";

const clampWidth = (w: number) => Math.round(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w)));

function loadWidths(): Partial<Record<WidthKey, number>> {
  try {
    const raw = window.localStorage.getItem(WIDTHS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<Record<WidthKey, number>> = {};
    for (const key of Object.keys(DEFAULT_WIDTHS) as WidthKey[]) {
      const v = parsed[key];
      if (typeof v === "number" && Number.isFinite(v)) out[key] = clampWidth(v);
    }
    return out;
  } catch {
    return {};
  }
}

/** The order the table draws its resizable columns in; must match the header and every row. */
const BODY_ORDER: ColumnKey[] = [
  "title",
  "status",
  "score",
  "temp",
  "pv",
  "ov",
  "employees",
  "lists",
  "company",
  "companyLinkedin",
  "cphone",
  "mobile",
  "addr",
  "city",
  "state",
  "subscribed",
  "bounced",
];

/**
 * Column order (client-confirmed, 2026-10-22, approved mockup "Contacts
 * Filters"): every heading after Full Name can be dragged left or right;
 * the checkbox and Full Name stay pinned first. The order persists per
 * browser like the visible columns and widths, and Columns › Reset column
 * order puts it back.
 */
type OrderKey = ColumnKey | "email";

const DEFAULT_ORDER: OrderKey[] = ["linkedin", "email", ...BODY_ORDER];
const ORDER_STORAGE_KEY = "growthmission.contacts.columnOrder";

function loadOrder(): OrderKey[] {
  try {
    const raw = window.localStorage.getItem(ORDER_STORAGE_KEY);
    if (!raw) return DEFAULT_ORDER;
    const saved = (JSON.parse(raw) as string[]).filter((k): k is OrderKey => (DEFAULT_ORDER as string[]).includes(k));
    // Columns added since this order was saved go at the end.
    return [...new Set([...saved, ...DEFAULT_ORDER])];
  } catch {
    return DEFAULT_ORDER;
  }
}

const HEADINGS: Record<OrderKey, { label: string; icon?: ReactNode; right?: boolean; center?: boolean }> = {
  linkedin: { label: "Person LinkedIn", icon: <LinkedInLogo className="size-3.5" /> },
  email: { label: "Email", icon: <Mail className="size-3.5" /> },
  title: { label: "Title", icon: <Briefcase className="size-3.5" /> },
  status: { label: "Contact Status", icon: <Tag className="size-3.5" /> },
  score: { label: "Score", icon: <Star className="size-3.5" /> },
  temp: { label: "Temp", icon: <Thermometer className="size-3.5" /> },
  pv: { label: "Prospect Value", right: true },
  ov: { label: "Opportunities Value", right: true },
  employees: { label: "Employees", icon: <Users className="size-3.5" />, right: true },
  lists: { label: "Lists", icon: <ListChecks className="size-3.5" /> },
  company: { label: "Company", icon: <Building2 className="size-3.5" /> },
  companyLinkedin: { label: "Company LinkedIn", icon: <Link2 className="size-3.5" /> },
  cphone: { label: "Company Phone", icon: <Phone className="size-3.5" /> },
  mobile: { label: "Work Phone", icon: <Phone className="size-3.5" /> },
  addr: { label: "Company Address", icon: <MapPin className="size-3.5" /> },
  city: { label: "Company City", icon: <MapPin className="size-3.5" /> },
  state: { label: "Company State", icon: <MapPin className="size-3.5" /> },
  subscribed: { label: "Subscribed", center: true },
  bounced: { label: "Bounced", center: true },
};

/** Puts a row's tagged cells (`col`) in the current column order. */
function OrderedCells({ order, children }: { order: OrderKey[]; children: ReactNode }) {
  const cells = Children.toArray(children).filter(isValidElement) as React.ReactElement<{ col?: OrderKey }>[];
  const at = (el: React.ReactElement<{ col?: OrderKey }>) => {
    const i = el.props.col ? order.indexOf(el.props.col) : -1;
    return i < 0 ? order.length : i;
  };
  return <>{[...cells].sort((a, b) => at(a) - at(b))}</>;
}

const COLUMN_GROUPS: { label: string; columns: { key: ColumnKey; label: string }[] }[] = [
  {
    label: "Contact",
    columns: [
      { key: "title", label: "Title" },
      { key: "status", label: "Contact Status" },
      { key: "score", label: "Score" },
      { key: "temp", label: "Temp" },
      { key: "lists", label: "Lists" },
      { key: "mobile", label: "Work Phone" },
      { key: "linkedin", label: "Person LinkedIn" },
    ],
  },
  // Client-confirmed (2026-10-14, "CRM Pages Refresh"): the client's
  // company-size formulas, placed right after Temp so they show without
  // scrolling. Read-only, like every Company-derived column.
  {
    label: "Value",
    columns: [
      { key: "pv", label: "Prospect Value" },
      { key: "ov", label: "Opportunities Value" },
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
  compact: ["title", "status", "pv"],
  sales: ["title", "status", "score", "temp", "pv", "ov", "company"],
};

const COLUMNS_STORAGE_KEY = "growthmission.contacts.visibleColumns";
/** Columns added after people had saved a layout, switched on once for them. */
const ADDED_COLUMNS: { key: string; columns: ColumnKey[] }[] = [
  { key: "growthmission.contacts.addedValueColumns", columns: ["pv", "ov"] },
];

function loadVisibleColumns(): Set<ColumnKey> {
  if (typeof window === "undefined") return new Set(ALL_COLUMN_KEYS);
  try {
    const raw = window.localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (!raw) return new Set(ALL_COLUMN_KEYS);
    const parsed = JSON.parse(raw) as string[];
    const valid = new Set(parsed.filter((k): k is ColumnKey => (ALL_COLUMN_KEYS as string[]).includes(k)));
    for (const added of ADDED_COLUMNS) {
      if (window.localStorage.getItem(added.key)) continue;
      added.columns.forEach((c) => valid.add(c));
      window.localStorage.setItem(added.key, "1");
    }
    return valid;
  } catch {
    return new Set(ALL_COLUMN_KEYS);
  }
}

/**
 * Client-confirmed redesign, modeled on a reference CRM's Contacts
 * table: every requested column (Email, Full Name, Title, Contact
 * Status, Score, Temp, Employees, Lists, Company, Company Phone,
 * Work Phone (was Mobile Phone), LinkedIn, Company Address 1, Company City, Company
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
  toolbar,
  belowToolbar,
}: {
  /** Views and search, drawn on the table's own toolbar row (Contacts page). */
  toolbar?: ReactNode;
  /** A full-width row under the toolbar: the active filter chips (Contacts page). */
  belowToolbar?: ReactNode;
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

  const [widths, setWidths] = useState<Partial<Record<WidthKey, number>>>({});
  const [widthsHydrated, setWidthsHydrated] = useState(false);

  useEffect(() => {
    setWidths(loadWidths());
    setWidthsHydrated(true);
  }, []);

  useEffect(() => {
    if (!widthsHydrated) return;
    try {
      window.localStorage.setItem(WIDTHS_STORAGE_KEY, JSON.stringify(widths));
    } catch {
      // Storage blocked: widths still apply for this visit.
    }
  }, [widths, widthsHydrated]);

  const widthOf = (key: WidthKey) => widths[key] ?? DEFAULT_WIDTHS[key];
  const resizeFor = (key: WidthKey, label: string): ResizeProps => ({
    label,
    width: widthOf(key),
    onChange: (w) => setWidths((prev) => ({ ...prev, [key]: clampWidth(w) })),
    onReset: () =>
      setWidths((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      }),
  });

  const [order, setOrder] = useState<OrderKey[]>(DEFAULT_ORDER);
  const [orderHydrated, setOrderHydrated] = useState(false);
  useEffect(() => {
    setOrder(loadOrder());
    setOrderHydrated(true);
  }, []);
  useEffect(() => {
    if (!orderHydrated) return;
    try {
      window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(order));
    } catch {
      // Storage blocked: the order still applies for this visit.
    }
  }, [order, orderHydrated]);
  const orderChanged = order.some((k, i) => k !== DEFAULT_ORDER[i]);

  // Which heading is being dragged, and where it would land.
  const [dragging, setDragging] = useState<OrderKey | null>(null);
  const [dropAt, setDropAt] = useState<{ key: OrderKey; after: boolean } | null>(null);
  const dragFor = (key: OrderKey, label: string): DragProps => ({
    label,
    dragging: dragging === key,
    dropSide: dropAt?.key === key ? (dropAt.after ? "after" : "before") : null,
    onStart: () => setDragging(key),
    onOver: (after) => {
      if (dragging && dragging !== key) setDropAt({ key, after });
    },
    onDrop: () => {
      if (dragging && dropAt && dragging !== dropAt.key) {
        setOrder((prev) => {
          const rest = prev.filter((k) => k !== dragging);
          const i = rest.indexOf(dropAt.key) + (dropAt.after ? 1 : 0);
          return [...rest.slice(0, i), dragging, ...rest.slice(i)];
        });
      }
      setDragging(null);
      setDropAt(null);
    },
    onEnd: () => {
      setDragging(null);
      setDropAt(null);
    },
  });

  // Sorting is server-side, through `sort`/`dir` in the address, so it
  // covers every contact (or every member, on List Detail). Lists can't
  // sort: a contact can be in several.
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSort = searchParams.get("sort");
  const activeDir = searchParams.get("dir") === "desc" ? "desc" : "asc";
  const sortFor = (key: string, label: string): SortProps => {
    const active = activeSort === key;
    const p = new URLSearchParams(searchParams.toString());
    p.set("sort", key);
    p.set("dir", active && activeDir === "asc" ? "desc" : "asc");
    p.delete("page");
    return { label, active, dir: activeDir, href: `${pathname}?${p.toString()}` };
  };

  const show = (key: ColumnKey) => visibleColumns.has(key);
  const visibleOrder = order.filter((k) => k === "email" || show(k));
  const widthOrder: WidthKey[] = ["name", ...visibleOrder];
  const tableWidth = SELECT_WIDTH + widthOrder.reduce((sum, k) => sum + widthOf(k), 0);
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
    setDraft(draftOf(c));
  };

  const draftOf = (c: ContactListRow): ContactDraft => ({
      full_name: c.full_name,
      email: c.email,
      title: c.title ?? "",
      status_id: c.status_id,
      score: c.score != null ? String(c.score) : "",
      temperature: c.temperature ?? "none",
      phone: c.phone ?? "",
      linkedin_url: c.linkedin_url ?? "",
      subscribed: !c.email_opt_out,
      company: c.company_id && c.companies ? companyDraftOf(c) : null,
  });

  const companyDraftOf = (c: ContactListRow): CompanyDraft => ({
    company_size: c.companies?.company_size ?? "",
    linkedin_url: c.companies?.linkedin_url ?? "",
    phone: c.companies?.phone ?? "",
    address_line1: c.companies?.address_line1 ?? "",
    city: c.companies?.city ?? "",
    state: c.companies?.state ?? "",
  });

  /**
   * A company column while editing a contact with no company (client-
   * confirmed, 2026-10-22): says why it can't be edited instead of a bare
   * "—", with the reason in the tooltip. The Company cell adds the way to
   * fix it, which is Contact Detail.
   */
  const noCompanyCell = (col: OrderKey, c: ContactListRow) => (
    <Td col={col}>
      <span
        className="inline-flex items-center gap-1.5 text-caption text-neutral-400"
        title={`${c.full_name} has no company linked, so company details can't be edited here. Add a company on their contact page.`}
      >
        No company
        {col === "company" && (
          <Link
            href={`/contacts/${c.id}`}
            className="font-semibold text-secondary-700 hover:underline"
            // Leaving for Contact Detail keeps whatever was typed in the row.
            onClick={() => void saveRef.current()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            Add one
          </Link>
        )}
      </span>
    </Td>
  );

  /** One company field while the row is being edited. */
  const companyInput = (field: keyof CompanyDraft, placeholder: string, numeric = false) =>
    draft?.company ? (
      <Input
        value={draft.company[field]}
        inputMode={numeric ? "numeric" : undefined}
        placeholder={placeholder}
        aria-label={placeholder}
        title={`Changes this for everyone at ${contacts.find((x) => x.id === editingId)?.companies?.name ?? "this company"}`}
        onChange={(e) =>
          setDraft({
            ...draft,
            company: { ...draft.company!, [field]: numeric ? e.target.value.replace(/\D/g, "").slice(0, 9) : e.target.value },
          })
        }
        onKeyDown={handleDraftKeyDown}
        onDoubleClick={(e) => e.stopPropagation()}
        className={cn("h-8 w-full min-w-0", numeric && "text-right tabular-nums")}
      />
    ) : null;

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const saveEdit = async () => {
    if (!editingId || !draft || saving) return;
    const row = contacts.find((x) => x.id === editingId);
    const original = row ? draftOf(row) : null;
    // The contact's own fields, without the company's.
    const own = (d: ContactDraft) => JSON.stringify({ ...d, company: null });
    const contactChanged = !original || own(draft) !== own(original);
    // Nothing changed: just leave edit mode, with no save and no message.
    if (original && JSON.stringify(draft) === JSON.stringify(original)) {
      cancelEdit();
      return;
    }
    if (!draft.full_name.trim() || !draft.email.trim()) {
      toast.error("Name and email can't be empty.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const [first_name, ...rest] = draft.full_name.trim().split(/\s+/);
    const { error } = contactChanged
      ? await supabase
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
          .eq("id", editingId)
      : { error: null };

    if (error) {
      setSaving(false);
      toast.error(getFriendlyErrorMessage(error));
      return;
    }

    // The company's own fields, only when one of them actually changed.
    const before = row && row.company_id && row.companies ? companyDraftOf(row) : null;
    const after = draft.company;
    let companyNote = "";
    if (row?.company_id && before && after && (Object.keys(after) as (keyof CompanyDraft)[]).some((k) => after[k].trim() !== before[k].trim())) {
      const blank = (v: string) => v.trim() || null;
      const { error: companyError } = await supabase
        .from("companies")
        .update({
          company_size: blank(after.company_size),
          linkedin_url: blank(after.linkedin_url),
          phone: blank(after.phone),
          address_line1: blank(after.address_line1),
          city: blank(after.city),
          state: blank(after.state),
        })
        .eq("id", row.company_id);
      if (companyError) {
        setSaving(false);
        toast.error(`Contact saved, but the company's details weren't: ${getFriendlyErrorMessage(companyError)}`);
        router.refresh();
        return;
      }
      companyNote = ` ${row.companies?.name ?? "The company"} updated for everyone there.`;
    }
    setSaving(false);
    toast.success(`Contact updated.${companyNote}`);
    setEditingId(null);
    setDraft(null);
    router.refresh();
  };

  // Client-confirmed (2026-10-22): clicking anywhere outside the row being
  // edited saves it, as well as Enter and the ✓. Clicks inside the row, or
  // in a dropdown it opened (Status, Temp), don't count as outside. A ref
  // keeps the listener on the latest draft without re-binding per keystroke.
  const saveRef = useRef(saveEdit);
  saveRef.current = saveEdit;
  useEffect(() => {
    if (!editingId) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest) return;
      if (target.closest('tr[data-editing="true"]')) return;
      if (target.closest("[data-radix-popper-content-wrapper], [role='listbox'], [role='dialog'], [role='menu']")) return;
      void saveRef.current();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [editingId]);

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

      <div className="flex flex-wrap items-center gap-2">
        {toolbar}
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <span className="text-caption font-semibold text-neutral-500">Columns</span>
          <div role="group" aria-label="Column preset" className="flex rounded-md border border-neutral-200 bg-neutral-50 p-1 shadow-inner">
            {(
              [
                ["all", "All"],
                ["sales", "Sales"],
                ["compact", "Compact"],
              ] as const
            ).map(([key, label]) => {
              const on = PRESETS[key].length === visibleColumns.size && PRESETS[key].every((k) => visibleColumns.has(k));
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => applyPreset(key)}
                  className={cn(
                    "rounded px-3 py-1 text-body-sm font-medium transition-colors",
                    on ? "bg-white text-primary-800 shadow-sm" : "text-neutral-500 hover:text-neutral-800"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="hidden lg:block">
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
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={Object.keys(widths).length === 0} onSelect={() => setWidths({})}>
                Reset column widths
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!orderChanged} onSelect={() => setOrder(DEFAULT_ORDER)}>
                Reset column order
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {belowToolbar}

      {/* Below lg the table becomes one card per contact (client-confirmed,
          2026-10-05). Eighteen toggleable columns cannot be made good at
          390px, and the Columns menu is no answer — picking three of
          eighteen is configuration work nobody does on a phone. The card
          shows a fixed identity set instead: name, title, company, email,
          status and score. Selection is kept, because the bulk action bar
          is how list membership and status changes happen in quantity.
          Editing is not: inline row editing opens on double-click, which
          touch has no equivalent for, so a card links through to Contact
          Detail where every field is editable anyway. */}
      <div className="flex flex-col gap-2.5 lg:hidden">
        {contacts.map((c) => (
          <ContactCard
            key={c.id}
            contact={c}
            selected={isSelected(c.id)}
            onSelect={(checked) => toggleOne(c.id, checked)}
          />
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-neutral-200 shadow-sm lg:block">
        <table
          className="border-collapse text-body"
          // Fixed layout so the <col> widths hold; the empty last column
          // takes any spare room, so widening the window never stretches
          // the set widths.
          style={{ tableLayout: "fixed", width: "100%", minWidth: `${tableWidth}px` }}
        >
          <colgroup>
            <col style={{ width: SELECT_WIDTH }} />
            {widthOrder.map((k) => (
              <col key={k} style={{ width: widthOf(k) }} />
            ))}
            <col />
          </colgroup>
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
              <Th
                sticky="left-11"
                className="border-r border-primary-800"
                resize={resizeFor("name", "Full Name")}
                sort={sortFor("name", "Full Name")}
              >
                <User className="size-3.5" />
                <span className="min-w-0 truncate">Full Name</span>
              </Th>
              {visibleOrder.map((k) => {
                const h = HEADINGS[k];
                return (
                  <Th
                    key={k}
                    right={h.right}
                    center={h.center}
                    resize={resizeFor(k, h.label)}
                    drag={dragFor(k, h.label)}
                    sort={k === "lists" ? undefined : sortFor(k, h.label)}
                  >
                    {h.icon}
                    <span className="min-w-0 truncate">{h.label}</span>
                  </Th>
                );
              })}
              <th aria-hidden="true" className="sticky top-0 z-20 bg-primary-900" />
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => {
              const selected = isSelected(c.id);
              const editing = editingId === c.id;
              // Editing a contact with no company: the company columns say so.
              const noCompany = editing && !!draft && !draft.company;
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
                          className="h-8 min-w-0 flex-1"
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
                        <Link
                          href={`/contacts/${c.id}`}
                          title={c.full_name}
                          className="min-w-0 truncate font-semibold text-primary-900 hover:underline"
                        >
                          {c.full_name}
                        </Link>
                      </div>
                    )}
                  </Td>
                  <OrderedCells order={visibleOrder}>
                  {show("linkedin") &&
                    (editing && draft ? (
                      <Td col="linkedin">
                        <Input
                          placeholder="https://linkedin.com/in/…"
                          value={draft.linkedin_url}
                          onChange={(e) => setDraft({ ...draft, linkedin_url: e.target.value })}
                          onKeyDown={handleDraftKeyDown}
                          onDoubleClick={(e) => e.stopPropagation()}
                          className="h-8 w-full min-w-0"
                        />
                      </Td>
                    ) : (
                      <Td col="linkedin">
                        {c.linkedin_url ? (
                          <a
                            href={c.linkedin_url}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`${c.full_name}'s LinkedIn`}
                            className="flex size-7 items-center justify-center rounded-full bg-secondary-50 text-secondary-700 transition-colors hover:bg-secondary-700 hover:text-white"
                          >
                            <LinkedInLogo className="size-3.5" />
                          </a>
                        ) : (
                          "—"
                        )}
                      </Td>
                    ))}
                  <Td col="email">
                    {editing && draft ? (
                      <Input
                        type="email"
                        value={draft.email}
                        onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                        onKeyDown={handleDraftKeyDown}
                        onDoubleClick={(e) => e.stopPropagation()}
                        className="h-8 w-full min-w-0"
                      />
                    ) : (
                      <div className="flex min-w-0 items-center gap-2 text-neutral-600" title={c.email}>
                        <Mail className="size-3.5 shrink-0 text-neutral-400" />
                        <span className="truncate">{c.email}</span>
                      </div>
                    )}
                  </Td>
                  {show("title") &&
                    (editing && draft ? (
                      <Td col="title">
                        <Input
                          value={draft.title}
                          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                          onKeyDown={handleDraftKeyDown}
                          onDoubleClick={(e) => e.stopPropagation()}
                          className="h-8 w-full min-w-0"
                        />
                      </Td>
                    ) : (
                      <Td col="title" title={c.title}>{c.title ?? "—"}</Td>
                    ))}
                  {show("status") &&
                    (editing && draft ? (
                      <Td col="status" onDoubleClick={(e) => e.stopPropagation()}>
                        <Select value={draft.status_id} onValueChange={(v) => setDraft({ ...draft, status_id: v })}>
                          <SelectTrigger className="h-8 w-full min-w-0">
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
                      <Td col="status">
                        {c.contact_statuses && (
                          <StatusPill name={c.contact_statuses.name} color={c.contact_statuses.color} />
                        )}
                      </Td>
                    ))}
                  {show("score") &&
                    (editing && draft ? (
                      <Td col="score">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={draft.score}
                          onChange={(e) => setDraft({ ...draft, score: e.target.value })}
                          onKeyDown={handleDraftKeyDown}
                          onDoubleClick={(e) => e.stopPropagation()}
                          className="h-8 w-full min-w-0 max-w-20"
                        />
                      </Td>
                    ) : (
                      <Td col="score">
                        {c.score != null ? (
                          <div className="flex items-center gap-2">
                            <span className="h-1.5 w-12 overflow-hidden rounded-full bg-neutral-100">
                              <span
                                className="block h-full rounded-full bg-secondary-600"
                                style={{ width: `${Math.max(0, Math.min(100, c.score))}%` }}
                              />
                            </span>
                            <span className="inline-block min-w-[2.2em] text-right font-semibold tabular-nums text-neutral-800">{c.score}</span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </Td>
                    ))}
                  {show("temp") &&
                    (editing && draft ? (
                      <Td col="temp" onDoubleClick={(e) => e.stopPropagation()}>
                        <Select
                          value={draft.temperature}
                          onValueChange={(v) => setDraft({ ...draft, temperature: v as ContactDraft["temperature"] })}
                        >
                          <SelectTrigger className="h-8 w-full min-w-0">
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
                      <Td col="temp">
                        {c.temperature ? (
                          <span className="inline-flex items-center gap-1.5 text-body-sm text-neutral-700">
                            <span
                              aria-hidden="true"
                              className={cn("size-2 rounded-full", c.temperature === "hot" ? "bg-error-500" : "bg-primary-400")}
                            />
                            {c.temperature === "hot" ? "Hot" : "Cold"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </Td>
                    ))}
                  {show("pv") && (
                    <Td col="pv" className="text-right font-semibold tabular-nums text-primary-900">
                      {c.companies ? usd.format(prospectValue(c.companies.company_size)) : "—"}
                    </Td>
                  )}
                  {show("ov") && (
                    <Td col="ov" className="text-right tabular-nums text-neutral-600">
                      {c.companies ? usd.format(opportunitiesValue(c.companies.company_size)) : "—"}
                    </Td>
                  )}
                  {show("employees") &&
                    (noCompany ? noCompanyCell("employees", c) : editing && draft?.company ? (
                      <Td col="employees">{companyInput("company_size", "Employees", true)}</Td>
                    ) : (
                      <Td col="employees" className="text-right tabular-nums">{employeesOf(c.companies?.company_size) || "—"}</Td>
                    ))}
                  {show("lists") && (
                    <Td col="lists" onDoubleClick={(e) => e.stopPropagation()}>
                      <ListsCell contactId={c.id} accountId={accountId} lists={c.lists ?? []} onChanged={() => router.refresh()} />
                    </Td>
                  )}
                  {show("company") && noCompany && noCompanyCell("company", c)}
                  {show("company") && !noCompany && (
                    <Td col="company" title={c.companies?.name}>
                      {c.companies?.name ? (
                        <span className="font-medium text-neutral-800">{c.companies.name}</span>
                      ) : (
                        "—"
                      )}
                    </Td>
                  )}
                  {show("companyLinkedin") && editing && draft?.company && (
                    <Td col="companyLinkedin">{companyInput("linkedin_url", "https://linkedin.com/company/…")}</Td>
                  )}
                  {show("companyLinkedin") && noCompany && noCompanyCell("companyLinkedin", c)}
                  {show("companyLinkedin") && !noCompany && !(editing && draft?.company) && (
                    <Td col="companyLinkedin">
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
                  {show("cphone") &&
                    (noCompany ? noCompanyCell("cphone", c) : editing && draft?.company ? (
                      <Td col="cphone">{companyInput("phone", "Company phone")}</Td>
                    ) : (
                      <Td col="cphone" title={c.companies?.phone}>{c.companies?.phone ?? "—"}</Td>
                    ))}
                  {show("mobile") &&
                    (editing && draft ? (
                      <Td col="mobile">
                        <Input
                          value={draft.phone}
                          onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                          onKeyDown={handleDraftKeyDown}
                          onDoubleClick={(e) => e.stopPropagation()}
                          className="h-8 w-full min-w-0"
                        />
                      </Td>
                    ) : (
                      <Td col="mobile" title={c.phone}>{c.phone ?? "—"}</Td>
                    ))}
                  {show("addr") &&
                    (noCompany ? noCompanyCell("addr", c) : editing && draft?.company ? (
                      <Td col="addr">{companyInput("address_line1", "Street address")}</Td>
                    ) : (
                      <Td col="addr" title={c.companies?.address_line1}>{c.companies?.address_line1 ?? "—"}</Td>
                    ))}
                  {show("city") &&
                    (noCompany ? noCompanyCell("city", c) : editing && draft?.company ? (
                      <Td col="city">{companyInput("city", "City")}</Td>
                    ) : (
                      <Td col="city" title={c.companies?.city}>{c.companies?.city ?? "—"}</Td>
                    ))}
                  {show("state") &&
                    (noCompany ? noCompanyCell("state", c) : editing && draft?.company ? (
                      <Td col="state">{companyInput("state", "State")}</Td>
                    ) : (
                      <Td col="state" title={c.companies?.state}>{c.companies?.state ?? "—"}</Td>
                    ))}
                  {show("subscribed") &&
                    (editing && draft ? (
                      <Td col="subscribed" onDoubleClick={(e) => e.stopPropagation()}>
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
                      <Td col="subscribed" className="text-center">
                        <Badge variant={c.email_opt_out ? "neutral" : "success"}>{c.email_opt_out ? "No" : "Yes"}</Badge>
                      </Td>
                    ))}
                  {show("bounced") && (
                    <Td
                      col="bounced"
                      className="text-center"
                      title={c.email_bounced_at ? `Bounced ${new Date(c.email_bounced_at).toLocaleDateString()}` : undefined}
                    >
                      {/* Client-confirmed (2026-10-22): a lasting bounce from any email, campaign or 1-1. */}
                      <Badge variant={c.email_bounced_at ? "error" : "neutral"}>{c.email_bounced_at ? "Yes" : "No"}</Badge>
                    </Td>
                  )}
                  </OrderedCells>
                  <td
                    aria-hidden="true"
                    className="border-b border-neutral-100 bg-white transition-colors group-hover:bg-neutral-50 group-data-[selected=true]:bg-secondary-50 group-data-[editing=true]:bg-secondary-50"
                  />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Room for the floating bulk bar, so it never covers the last rows or cards. */}
      {(selection.selectAllMatching || selection.selectedIds.size > 0) && <div aria-hidden="true" className="h-28 lg:h-16" />}
    </div>
  );
}

/**
 * One contact as a card, for widths below `lg`.
 *
 * A fixed identity set rather than whatever the Columns menu happens to
 * have on: name, title, company, email, status and score. Tapping the name
 * goes to Contact Detail, which is where everything is editable — the
 * table's own inline editing is double-click driven and unreachable by
 * touch.
 */
function ContactCard({
  contact,
  selected,
  onSelect,
}: {
  contact: ContactListRow;
  selected: boolean;
  onSelect: (checked: boolean) => void;
}) {
  return (
    <article
      className={`rounded-xl border p-3.5 ${
        selected ? "border-secondary-500 bg-secondary-50" : "border-neutral-200 bg-white"
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-label={`Select ${contact.full_name}`}
          onClick={() => onSelect(!selected)}
          className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded border-[1.5px] ${
            selected ? "border-secondary-800 bg-secondary-800 text-white" : "border-neutral-300 bg-white"
          }`}
        >
          {selected && <Check className="size-3.5" strokeWidth={3} />}
        </button>

        <div className="min-w-0 flex-1">
          <Link
            href={`/contacts/${contact.id}`}
            className="block truncate text-body font-semibold text-primary-900 hover:text-secondary-700 hover:underline"
          >
            {contact.full_name}
          </Link>
          {(contact.title || contact.companies?.name) && (
            <p className="truncate text-caption text-neutral-500">
              {[contact.title, contact.companies?.name].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        {contact.contact_statuses?.name && (
          <StatusPill name={contact.contact_statuses.name} color={contact.contact_statuses.color} className="shrink-0" />
        )}
      </div>

      <div className="mt-2 flex flex-col gap-1">
        <a
          href={`mailto:${contact.email}`}
          className="flex min-h-[32px] items-center gap-1.5 truncate text-body-sm text-secondary-700 hover:underline"
        >
          <Mail className="size-3.5 shrink-0" />
          <span className="truncate">{contact.email}</span>
        </a>
        {contact.phone && (
          <a
            href={`tel:${contact.phone}`}
            className="flex min-h-[32px] items-center gap-1.5 text-body-sm text-secondary-700 hover:underline"
          >
            <Phone className="size-3.5 shrink-0" />
            {contact.phone}
          </a>
        )}
      </div>

      {(contact.score !== null || contact.temperature || contact.companies) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-neutral-100 pt-2 text-caption text-neutral-500">
          {contact.companies && (
            <span className="tabular-nums">
              <b className="font-semibold text-primary-900">{usd.format(prospectValue(contact.companies.company_size))}</b> Prospect Value
            </span>
          )}
          {contact.score !== null && <span className="tabular-nums">Score {contact.score}</span>}
          {contact.temperature && (
            <span
              className={`font-semibold capitalize ${
                contact.temperature === "hot" ? "text-error-600" : "text-primary-500"
              }`}
            >
              {contact.temperature}
            </span>
          )}
        </div>
      )}
    </article>
  );
}

interface SortProps {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  href: string;
}

interface DragProps {
  label: string;
  dragging: boolean;
  /** Where the dragged column would land, drawn as a cyan edge. */
  dropSide: "before" | "after" | null;
  onStart: () => void;
  onOver: (after: boolean) => void;
  onDrop: () => void;
  onEnd: () => void;
}

interface ResizeProps {
  label: string;
  width: number;
  onChange: (width: number) => void;
  onReset: () => void;
}

/**
 * The drag edge on a column heading. Pointer drag resizes live; double-
 * click resets; with focus, ← and → step by 16px.
 */
function ResizeHandle({ label, width, onChange, onReset }: ResizeProps) {
  const [active, setActive] = useState(false);

  const onPointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = width;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    setActive(true);
    const move = (ev: PointerEvent) => onChange(startWidth + ev.clientX - startX);
    const up = () => {
      setActive(false);
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  };

  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label}`}
      aria-valuenow={width}
      aria-valuemin={MIN_WIDTH}
      aria-valuemax={MAX_WIDTH}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      onPointerDown={onPointerDown}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onReset();
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          onChange(width + (e.key === "ArrowRight" ? 16 : -16));
        }
      }}
      className="group/resize absolute inset-y-0 right-0 flex w-2.5 cursor-col-resize touch-none justify-center outline-none"
    >
      <span
        aria-hidden="true"
        className={cn(
          "my-2.5 w-0.5 rounded-full bg-white/25 transition-colors group-hover/th:bg-white/55 group-focus-visible/resize:my-0 group-focus-visible/resize:w-[3px] group-focus-visible/resize:bg-secondary-500",
          active && "my-0 w-[3px] bg-secondary-500 group-hover/th:bg-secondary-500"
        )}
      />
    </span>
  );
}

function Th({
  children,
  sticky,
  className,
  right,
  center,
  resize,
  drag,
  sort,
}: {
  children: ReactNode;
  sticky?: "left-0" | "left-11";
  className?: string;
  /** A numeric column: the title lines up with its right-aligned figures. */
  right?: boolean;
  center?: boolean;
  /** Makes the column resizable from its right edge. */
  resize?: ResizeProps;
  /** Makes the heading draggable to move its column. */
  drag?: DragProps;
  /** Makes the heading a sort link (client-confirmed, 2026-10-22). */
  sort?: SortProps;
}) {
  // A press that starts on the resize edge resizes; it must not also drag.
  const fromResizeEdge = useRef(false);
  return (
    <th
      draggable={!!drag}
      // The full name too, since a narrow column cuts it short.
      title={drag ? `${drag.label} · drag to move` : sort?.label}
      onPointerDown={(e) => {
        fromResizeEdge.current = !!(e.target as HTMLElement).closest('[role="separator"]');
      }}
      onDragStart={(e) => {
        if (!drag || fromResizeEdge.current) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.effectAllowed = "move";
        try {
          e.dataTransfer.setData("text/plain", drag.label);
        } catch {
          // Some browsers refuse custom data; the drag still works.
        }
        drag.onStart();
      }}
      onDragOver={(e) => {
        if (!drag) return;
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        drag.onOver(e.clientX > r.left + r.width / 2);
      }}
      onDrop={(e) => {
        if (!drag) return;
        e.preventDefault();
        drag.onDrop();
      }}
      onDragEnd={() => drag?.onEnd()}
      className={cn(
        "group/th sticky top-0 z-20 overflow-hidden whitespace-nowrap bg-primary-900 px-4 py-4 text-left text-caption font-semibold tracking-wide text-white",
        sticky && `z-30 ${sticky}`,
        // Keeps the sort arrow clear of the resize edge.
        resize && "pr-5",
        drag && "cursor-grab active:cursor-grabbing",
        drag?.dragging && "opacity-50",
        drag?.dropSide === "before" && "shadow-[inset_3px_0_0_var(--color-secondary-500)]",
        drag?.dropSide === "after" && "shadow-[inset_-3px_0_0_var(--color-secondary-500)]",
        className
      )}
    >
      {drag && (
        <GripVertical
          aria-hidden="true"
          className="absolute left-0.5 top-1/2 size-3.5 -translate-y-1/2 text-white/0 transition-colors group-hover/th:text-white/60"
        />
      )}
      <span
        className={cn(
          "flex min-w-0 items-center gap-2 [&>svg]:shrink-0 [&>svg]:text-white/70",
          right && "justify-end",
          center && "justify-center"
        )}
      >
        {sort ? (
          // Sort arrows as on every other sortable table (Design System §8.5,
          // SortableHeader's solid variant). A click sorts; a drag still moves.
          <Link
            href={sort.href}
            scroll={false}
            draggable={false}
            aria-label={`Sort by ${sort.label}${sort.active ? `, now ${sort.dir === "asc" ? "ascending" : "descending"}` : ""}`}
            className="flex min-w-0 items-center gap-2 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-300 [&>svg]:shrink-0 [&>svg]:text-white/70"
          >
            {children}
            <SortIcon active={sort.active} dir={sort.dir} />
          </Link>
        ) : (
          children
        )}
      </span>
      {resize && <ResizeHandle {...resize} />}
    </th>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return <Icon aria-hidden="true" className={cn("size-3.5 shrink-0", active ? "!text-secondary-300" : "!text-white/50")} />;
}

function Td({
  children,
  sticky,
  className,
  title,
  onDoubleClick,
}: {
  /** Which column this cell belongs to, read by OrderedCells. */
  col?: OrderKey;
  children: ReactNode;
  sticky?: "left-0" | "left-11";
  className?: string;
  /** The full text, shown on hover when the column cuts it short. */
  title?: string | null;
  onDoubleClick?: React.MouseEventHandler<HTMLTableCellElement>;
}) {
  return (
    <td
      onDoubleClick={onDoubleClick}
      title={title ?? undefined}
      className={cn(
        // Fixed column widths (client-confirmed, 2026-10-18): text that
        // doesn't fit ends in an ellipsis rather than widening the column.
        "overflow-hidden text-ellipsis whitespace-nowrap border-b border-neutral-100 bg-white px-4 py-3.5 align-middle text-neutral-700 transition-colors group-hover:bg-neutral-50 group-data-[selected=true]:bg-secondary-50 group-data-[editing=true]:bg-secondary-50",
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
            <span className="text-body-sm text-primary-600 hover:underline">{lists[0].name}</span>
            {lists.length > 1 && <span className="text-caption font-semibold text-neutral-400">+{lists.length - 1}</span>}
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

function Avatar({ name }: { name: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  // One calm colour (client-confirmed, 2026-10-14): the hashed palette
  // added a fourth colour to every row and carried no information.
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-caption font-bold text-primary-700">
      {initials}
    </span>
  );
}
