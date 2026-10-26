"use client";

import { Check, ChevronDown, Columns3, GripVertical, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { OpportunityLink } from "@/components/opportunities/opportunity-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SortableHeader } from "@/components/ui/sortable-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { daysSince, usd } from "@/lib/companies/value";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { STAGE_GROUP_BADGE_VARIANT, type StageGroup } from "@/lib/opportunities/stages";
import { createClient } from "@/lib/supabase/client";
import { useFlash } from "@/lib/use-flash";
import { cn } from "@/lib/utils";

export interface OpportunityListRow {
  id: string;
  name: string | null;
  contact_name: string;
  company_name: string | null;
  employees: number;
  prospect_value: number;
  stage_id: string;
  stage_name: string;
  stage_group: StageGroup;
  win_probability: number;
  owner_id: string | null;
  owner_name: string | null;
  closed_at: string | null;
  stage_entered_at: string;
}

interface StageOption {
  id: string;
  name: string;
  stage_group: StageGroup;
  win_probability: number;
}

interface Draft {
  name: string;
  stageId: string;
  ownerId: string;
}

const NOBODY = "__nobody__";

type MovableKey = "company" | "employees" | "stage" | "pv" | "ov" | "win" | "salesperson" | "days";
type ColumnKey = "opportunity" | MovableKey;

/** Heading, sort field, alignment and default share of the width (approved mockup "List column widths"). */
const COLUMNS: Record<ColumnKey, { label: string; sort: string; right?: boolean; width: string }> = {
  opportunity: { label: "Opportunity", sort: "contact", width: "19%" },
  company: { label: "Company", sort: "company", width: "15%" },
  employees: { label: "Employees", sort: "employees", right: true, width: "8%" },
  stage: { label: "Stage", sort: "stage", width: "15%" },
  pv: { label: "Prospect Value", sort: "value", right: true, width: "10%" },
  ov: { label: "Opportunities Value", sort: "opps_value", right: true, width: "11%" },
  win: { label: "Win %", sort: "win", width: "9%" },
  salesperson: { label: "Salesperson", sort: "salesperson", width: "8%" },
  days: { label: "In stage", sort: "days", right: true, width: "5%" },
};

/** Every column after Opportunity, which stays first. */
const DEFAULT_ORDER: MovableKey[] = ["company", "employees", "stage", "pv", "ov", "win", "salesperson", "days"];

const MIN_WIDTH = 80;
const MAX_WIDTH = 600;
const clampWidth = (w: number) => Math.round(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w)));

// Resized widths and moved columns persist per browser, as on Contacts.
const WIDTHS_KEY = "growthmission.opportunities.columnWidths";
const ORDER_KEY = "growthmission.opportunities.columnOrder";
const LAYOUT_EVENT = "growthmission:opportunity-columns";

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveLayout(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: the change can't be kept, so the table stays as it was.
  }
  window.dispatchEvent(new Event(LAYOUT_EVENT));
}

function subscribeLayout(onChange: () => void) {
  window.addEventListener(LAYOUT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(LAYOUT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The saved layout, read without an effect; the server renders the default. */
function useColumnLayout() {
  const rawWidths = useSyncExternalStore(subscribeLayout, () => readStorage(WIDTHS_KEY), () => null);
  const rawOrder = useSyncExternalStore(subscribeLayout, () => readStorage(ORDER_KEY), () => null);
  return useMemo(() => {
    const widths: Partial<Record<ColumnKey, number>> = {};
    try {
      const parsed = rawWidths ? (JSON.parse(rawWidths) as Record<string, unknown>) : {};
      for (const key of Object.keys(COLUMNS) as ColumnKey[]) {
        const v = parsed[key];
        if (typeof v === "number" && Number.isFinite(v)) widths[key] = clampWidth(v);
      }
    } catch {
      // A damaged saved value falls back to the default widths.
    }
    let order = DEFAULT_ORDER;
    try {
      const saved = rawOrder ? (JSON.parse(rawOrder) as string[]) : [];
      const known = saved.filter((k): k is MovableKey => (DEFAULT_ORDER as string[]).includes(k));
      // Columns added since this order was saved go at the end.
      if (known.length) order = [...new Set([...known, ...DEFAULT_ORDER])];
    } catch {
      // A damaged saved value falls back to the default order.
    }
    return { widths, order, orderChanged: order.some((k, i) => k !== DEFAULT_ORDER[i]) };
  }, [rawWidths, rawOrder]);
}

/**
 * App Flow §4.5, E2 — Opportunity List, the Board's alternate view.
 *
 * Client-confirmed (2026-10-14, "CRM Pages Refresh"): Prospect Value and
 * Opportunities Value (the client's company-size formula) replace the
 * typed Value, plus Employees, win probability, salesperson and days in
 * stage. Alignment follows the table rule: text left, numbers right under
 * right-aligned headers, and the win bar with its number in a fixed slot.
 * Below `lg` the table stacks into one labelled card per row.
 *
 * Client-confirmed (2026-10-26, approved mockup "CRM Side Panels", section
 * 5): edit in place, the Contacts table's pattern. Double-click a row and
 * its name, stage and salesperson become fields, with the teal rail and a
 * ✓ / ✕ beside the name. Enter, ✓ or a click anywhere outside the row
 * saves; Escape or ✕ cancels; the saved row glows. Clicking the name still
 * opens the opportunity's panel. A touch screen has no double-click, so on
 * a phone the name opens the panel, where every field is editable.
 *
 * Client-confirmed (2026-10-26, approved mockup "Opportunity List
 * Columns"): columns resize from a heading's right edge and move by
 * dragging the heading, Opportunity staying first; Columns › Reset puts
 * either back. Both persist per browser.
 */
export function OpportunityListTable({
  opportunities,
  stages,
  owners,
  canEdit,
}: {
  opportunities: OpportunityListRow[];
  stages: StageOption[];
  owners: { id: string; full_name: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const { flashId, flash } = useFlash();
  const layout = useColumnLayout();
  // Which heading is being dragged, and where it would land.
  const [dragging, setDragging] = useState<ColumnKey | null>(null);
  const [dropAt, setDropAt] = useState<{ key: ColumnKey; after: boolean } | null>(null);
  // A press that starts on the resize edge resizes; it must not also drag.
  const fromResizeEdge = useRef(false);

  const startEdit = (o: OpportunityListRow) => {
    if (!canEdit || editingId) return; // finish or cancel the row already being edited first
    setEditingId(o.id);
    setDraft({ name: o.name ?? "", stageId: o.stage_id, ownerId: o.owner_id ?? NOBODY });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const saveEdit = async () => {
    if (!editingId || !draft || saving) return;
    const row = opportunities.find((o) => o.id === editingId);
    if (!row) return cancelEdit();
    if (!draft.name.trim()) {
      toast.error("Give the opportunity a name.");
      return;
    }
    const unchanged =
      draft.name.trim() === (row.name ?? "") && draft.stageId === row.stage_id && draft.ownerId === (row.owner_id ?? NOBODY);
    if (unchanged) return cancelEdit();

    const group = stages.find((s) => s.id === draft.stageId)?.stage_group;
    const closing = group === "won" || group === "lost";
    const wasClosed = row.stage_group === "won" || row.stage_group === "lost";
    setSaving(true);
    const { error } = await createClient()
      .from("opportunities")
      .update({
        name: draft.name.trim(),
        stage_id: draft.stageId,
        owner_id: draft.ownerId === NOBODY ? null : draft.ownerId,
        // Won or Lost keeps the day it first closed; reopening clears it (as in the panel).
        closed_at: closing ? (wasClosed && row.closed_at ? row.closed_at : new Date().toISOString()) : null,
      })
      .eq("id", editingId);
    setSaving(false);
    if (error) {
      toast.error(getFriendlyErrorMessage(error));
      return;
    }
    toast.success("Opportunity updated.");
    flash(editingId);
    cancelEdit();
    router.refresh();
  };

  // Clicking anywhere outside the row being edited saves it, as on Contacts.
  // Clicks inside the row, or in a dropdown it opened, don't count.
  const saveRef = useRef(saveEdit);
  useEffect(() => {
    saveRef.current = saveEdit;
  });
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

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void saveEdit();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };

  const winOf = (o: OpportunityListRow) =>
    editingId === o.id && draft ? (stages.find((s) => s.id === draft.stageId)?.win_probability ?? o.win_probability) : o.win_probability;

  /** One body cell, by column, so the row follows the header's order. */
  const cell = (key: ColumnKey, o: OpportunityListRow, editing: boolean) => {
    switch (key) {
      case "opportunity":
        return (
          <TableCell key={key} label="Opportunity" className="relative font-medium text-neutral-800">
            {editing && <span aria-hidden="true" className="absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 bg-secondary-500" />}
            {editing && draft ? (
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  aria-label="Opportunity name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  error={!draft.name.trim()}
                  className="h-8 min-w-0 flex-1"
                />
                <button
                  type="button"
                  aria-label="Save"
                  onClick={() => void saveEdit()}
                  disabled={saving}
                  className="flex size-6 shrink-0 items-center justify-center rounded-md bg-success-600 text-white hover:bg-success-700 disabled:opacity-50"
                >
                  <Check className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Cancel"
                  onClick={cancelEdit}
                  disabled={saving}
                  className="flex size-6 shrink-0 items-center justify-center rounded-md bg-neutral-200 text-neutral-600 hover:bg-neutral-300 disabled:opacity-50"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <>
                <OpportunityLink id={o.id} className="block truncate hover:underline" title={o.name?.trim() || o.contact_name}>
                  {o.name?.trim() || o.contact_name}
                </OpportunityLink>
                <span className="block truncate text-caption font-normal text-neutral-500" title={o.contact_name}>
                  {o.contact_name}
                </span>
              </>
            )}
          </TableCell>
        );
      case "company":
        return (
          <TableCell key={key} label="Company" className="lg:truncate" title={o.company_name ?? undefined}>
            {o.company_name ?? "—"}
          </TableCell>
        );
      case "employees":
        return (
          <TableCell key={key} label="Employees" className="text-right tabular-nums">
            {o.employees || "—"}
          </TableCell>
        );
      case "stage":
        return (
          <TableCell key={key} label="Stage">
            {editing && draft ? (
              <Select value={draft.stageId} onValueChange={(v) => v && setDraft({ ...draft, stageId: v })}>
                <SelectTrigger aria-label="Stage" className="h-8 w-full">
                  <SelectValue>
                    <span className="block truncate">{stages.find((s) => s.id === draft.stageId)?.name}</span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex w-full items-baseline justify-between gap-3">
                        <span>{s.name}</span>
                        <span className="text-caption tabular-nums text-neutral-400">{s.win_probability}%</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge variant={STAGE_GROUP_BADGE_VARIANT[o.stage_group]}>{o.stage_name}</Badge>
            )}
          </TableCell>
        );
      case "pv":
        return (
          <TableCell key={key} label="Prospect Value" className="text-right font-semibold tabular-nums text-primary-900">
            {usd.format(o.prospect_value)}
          </TableCell>
        );
      case "ov":
        return (
          <TableCell key={key} label="Opportunities Value" className="text-right tabular-nums text-neutral-600">
            {usd.format(o.prospect_value * 3)}
          </TableCell>
        );
      case "win": {
        const win = winOf(o);
        return (
          <TableCell key={key} label="Win %">
            <span className="inline-flex items-center gap-2 text-body-sm font-semibold tabular-nums text-neutral-700">
              <span aria-hidden="true" className="block h-1.5 w-12 overflow-hidden rounded-full bg-neutral-100">
                <span className="block h-full rounded-full bg-secondary-600" style={{ width: `${win}%` }} />
              </span>
              <span className="inline-block min-w-[2.6em] text-right">{win}%</span>
            </span>
          </TableCell>
        );
      }
      case "salesperson":
        return (
          <TableCell key={key} label="Salesperson" className="lg:truncate" title={editing ? undefined : (o.owner_name ?? undefined)}>
            {editing && draft ? (
              <Select value={draft.ownerId} onValueChange={(v) => v && setDraft({ ...draft, ownerId: v })}>
                <SelectTrigger aria-label="Salesperson" className="h-8 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NOBODY}>Nobody yet</SelectItem>
                  {owners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              (o.owner_name ?? "—")
            )}
          </TableCell>
        );
      case "days":
        return (
          <TableCell key={key} label="In stage" className="text-right tabular-nums text-neutral-500">
            {daysSince(o.stage_entered_at)}
          </TableCell>
        );
    }
  };

  const columns: ColumnKey[] = ["opportunity", ...layout.order];

  return (
    <div className="flex flex-col gap-2">
      <div className="hidden justify-end lg:flex">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="secondary" size="sm" className="gap-1.5">
              <Columns3 className="size-4" />
              Columns
              <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem disabled={Object.keys(layout.widths).length === 0} onSelect={() => saveLayout(WIDTHS_KEY, {})}>
              Reset column widths
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!layout.orderChanged} onSelect={() => saveLayout(ORDER_KEY, DEFAULT_ORDER)}>
              Reset column order
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Table stacked className="lg:table-fixed">
        {/* Fixed shares of the width by default (client-confirmed, 2026-10-26,
            approved mockup "List column widths"); a column someone resized keeps
            its own width in pixels. Long text ends in an ellipsis. */}
        <colgroup>
          {columns.map((key) => (
            <col key={key} style={{ width: layout.widths[key] ? `${layout.widths[key]}px` : COLUMNS[key].width }} />
          ))}
        </colgroup>
        <TableHeader variant="solid">
          <TableRow className="border-b-0 hover:bg-transparent">
            {columns.map((key) => {
              const col = COLUMNS[key];
              const movable = key !== "opportunity";
              return (
                <TableHead
                  key={key}
                  variant="solid"
                  draggable={movable}
                  title={movable ? `${col.label} · drag to move` : undefined}
                  onPointerDown={(e) => {
                    fromResizeEdge.current = !!(e.target as HTMLElement).closest('[role="separator"]');
                  }}
                  onDragStart={(e) => {
                    if (!movable || fromResizeEdge.current) {
                      e.preventDefault();
                      return;
                    }
                    e.dataTransfer.effectAllowed = "move";
                    try {
                      e.dataTransfer.setData("text/plain", col.label);
                    } catch {
                      // Some browsers refuse custom data; the drag still works.
                    }
                    setDragging(key);
                  }}
                  onDragOver={(e) => {
                    if (!movable || !dragging || dragging === key) return;
                    e.preventDefault();
                    const r = e.currentTarget.getBoundingClientRect();
                    setDropAt({ key, after: e.clientX > r.left + r.width / 2 });
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragging && dropAt && dragging !== dropAt.key && dropAt.key !== "opportunity" && dragging !== "opportunity") {
                      const rest = layout.order.filter((k) => k !== dragging);
                      const i = rest.indexOf(dropAt.key) + (dropAt.after ? 1 : 0);
                      saveLayout(ORDER_KEY, [...rest.slice(0, i), dragging, ...rest.slice(i)]);
                    }
                    setDragging(null);
                    setDropAt(null);
                  }}
                  onDragEnd={() => {
                    setDragging(null);
                    setDropAt(null);
                  }}
                  className={cn(
                    "group/th relative overflow-hidden whitespace-nowrap",
                    col.right && "text-right",
                    movable && "cursor-grab active:cursor-grabbing",
                    dragging === key && "opacity-50",
                    dropAt?.key === key && !dropAt.after && "shadow-[inset_3px_0_0_var(--color-secondary-500)]",
                    dropAt?.key === key && dropAt.after && "shadow-[inset_-3px_0_0_var(--color-secondary-500)]"
                  )}
                >
                  {movable && (
                    <GripVertical
                      aria-hidden="true"
                      className="absolute left-0 top-1/2 size-3 -translate-y-1/2 text-white/0 transition-colors group-hover/th:text-white/60"
                    />
                  )}
                  <SortableHeader variant="solid" field={col.sort} label={col.label} align={col.right ? "right" : "left"} />
                  <ResizeHandle
                    label={col.label}
                    width={layout.widths[key]}
                    onChange={(w) => saveLayout(WIDTHS_KEY, { ...layout.widths, [key]: w })}
                    onReset={() => {
                      const next = { ...layout.widths };
                      delete next[key];
                      saveLayout(WIDTHS_KEY, next);
                    }}
                  />
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {opportunities.map((o) => {
            const editing = editingId === o.id && !!draft;
            return (
              <TableRow
                key={o.id}
                data-editing={editing ? "true" : undefined}
                data-flash={flashId === o.id ? "true" : undefined}
                onDoubleClick={() => startEdit(o)}
                onKeyDown={editing ? onKeyDown : undefined}
                title={canEdit && !editingId ? "Double-click to edit" : undefined}
                className="data-[editing=true]:bg-secondary-50 data-[flash=true]:animate-saved"
              >
                {columns.map((key) => cell(key, o, editing))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * A heading's right edge, the Contacts table's resize handle. Dragging
 * starts from the column's drawn width (a share of the table until first
 * resized); double-click resets; with focus, ← and → step by 16px.
 */
function ResizeHandle({
  label,
  width,
  onChange,
  onReset,
}: {
  label: string;
  /** The saved width, if this column has been resized. */
  width: number | undefined;
  onChange: (width: number) => void;
  onReset: () => void;
}) {
  const [active, setActive] = useState(false);

  const onPointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget;
    const startX = e.clientX;
    const startWidth = target.closest("th")?.getBoundingClientRect().width ?? width ?? MIN_WIDTH;
    target.setPointerCapture(e.pointerId);
    setActive(true);
    const move = (ev: PointerEvent) => onChange(clampWidth(startWidth + ev.clientX - startX));
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
          const current = width ?? e.currentTarget.closest("th")?.getBoundingClientRect().width ?? MIN_WIDTH;
          onChange(clampWidth(current + (e.key === "ArrowRight" ? 16 : -16)));
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
