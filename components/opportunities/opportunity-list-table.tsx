"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { OpportunityLink } from "@/components/opportunities/opportunity-panel";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SortableHeader } from "@/components/ui/sortable-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { daysSince, usd } from "@/lib/companies/value";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { STAGE_GROUP_BADGE_VARIANT, type StageGroup } from "@/lib/opportunities/stages";
import { createClient } from "@/lib/supabase/client";
import { useFlash } from "@/lib/use-flash";

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

  return (
    <Table stacked>
      <TableHeader variant="solid">
        <TableRow className="border-b-0 hover:bg-transparent">
          <TableHead variant="solid"><SortableHeader variant="solid" field="contact" label="Opportunity" /></TableHead>
          <TableHead variant="solid">Company</TableHead>
          <TableHead variant="solid" className="text-right">Employees</TableHead>
          <TableHead variant="solid"><SortableHeader variant="solid" field="stage" label="Stage" /></TableHead>
          <TableHead variant="solid" className="text-right">
            <SortableHeader variant="solid" field="value" label="Prospect Value" align="right" />
          </TableHead>
          <TableHead variant="solid" className="text-right">Opportunities Value</TableHead>
          <TableHead variant="solid">Win %</TableHead>
          <TableHead variant="solid">Salesperson</TableHead>
          <TableHead variant="solid" className="text-right">
            <SortableHeader variant="solid" field="days" label="In stage" align="right" />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {opportunities.map((o) => {
          const editing = editingId === o.id && !!draft;
          const winProbability = editing ? (stages.find((s) => s.id === draft.stageId)?.win_probability ?? o.win_probability) : o.win_probability;
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
              <TableCell label="Opportunity" className="relative font-medium text-neutral-800">
                {editing && <span aria-hidden="true" className="absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 bg-secondary-500" />}
                {editing ? (
                  <div className="flex min-w-[220px] items-center gap-2">
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
                    <OpportunityLink id={o.id} className="hover:underline">
                      {o.name?.trim() || o.contact_name}
                    </OpportunityLink>
                    <span className="block text-caption font-normal text-neutral-500">{o.contact_name}</span>
                  </>
                )}
              </TableCell>
              <TableCell label="Company">{o.company_name ?? "—"}</TableCell>
              <TableCell label="Employees" className="text-right tabular-nums">{o.employees || "—"}</TableCell>
              <TableCell label="Stage">
                {editing ? (
                  <Select value={draft.stageId} onValueChange={(v) => v && setDraft({ ...draft, stageId: v })}>
                    <SelectTrigger aria-label="Stage" className="h-8 min-w-[180px]">
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
              <TableCell label="Prospect Value" className="text-right font-semibold tabular-nums text-primary-900">
                {usd.format(o.prospect_value)}
              </TableCell>
              <TableCell label="Opportunities Value" className="text-right tabular-nums text-neutral-600">
                {usd.format(o.prospect_value * 3)}
              </TableCell>
              <TableCell label="Win %">
                <span className="inline-flex items-center gap-2 text-body-sm font-semibold tabular-nums text-neutral-700">
                  <span aria-hidden="true" className="block h-1.5 w-12 overflow-hidden rounded-full bg-neutral-100">
                    <span className="block h-full rounded-full bg-secondary-600" style={{ width: `${winProbability}%` }} />
                  </span>
                  <span className="inline-block min-w-[2.6em] text-right">{winProbability}%</span>
                </span>
              </TableCell>
              <TableCell label="Salesperson">
                {editing ? (
                  <Select value={draft.ownerId} onValueChange={(v) => v && setDraft({ ...draft, ownerId: v })}>
                    <SelectTrigger aria-label="Salesperson" className="h-8 min-w-[150px]">
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
              <TableCell label="In stage" className="text-right tabular-nums text-neutral-500">
                {daysSince(o.stage_entered_at)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
