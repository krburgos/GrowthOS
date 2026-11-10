"use client";

import { Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SortableHeader } from "@/components/ui/sortable-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usd } from "@/lib/companies/value";
import { chunk } from "@/lib/contacts/bulk-actions";
import { getFriendlyErrorMessage } from "@/lib/errors/friendly-message";
import { createClient } from "@/lib/supabase/client";

/** Ids per archive_companies() call. */
const BATCH = 150;

const noun = (n: number) => `${n.toLocaleString()} ${n === 1 ? "company" : "companies"}`;

export interface CompanyRow {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  employees: number;
  prospectValue: number;
  contactCount: number;
  openOpps: number;
}

/**
 * Design System §8.5 — navy-header table, server-driven sort via
 * `SortableHeader`. Client-confirmed (2026-10-14, "CRM Pages Refresh"):
 * Prospect Value with a bar scaled to the largest company in the current
 * results, Opportunities Value and an Open opps count join the original
 * columns. Text is left-aligned; every number is right-aligned under a
 * right-aligned header, and the bar is a fixed width so figures line up.
 * Search and filters live in CompaniesToolbar. Below `lg` the table stacks
 * into labelled cards.
 *
 * Client-confirmed (2026-11-10, approved mockup "Delete Companies Table
 * Mockup"): Owner, Admin and CRO Admin get the Opportunities List's
 * checkbox column and floating bar, with Delete. "Select all N" ticks every
 * company matching the current search and filters. Companies that still
 * have contacts or opportunities are skipped by archive_companies().
 */
export function CompaniesTable({
  companies,
  maxValue,
  canDelete = false,
  matching = [],
}: {
  companies: CompanyRow[];
  maxValue: number;
  canDelete?: boolean;
  /** Every company matching the search and filters, across pages, for "Select all N". */
  matching?: Pick<CompanyRow, "id" | "contactCount" | "openOpps">[];
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const selectedIds = allMatching ? matching.map((c) => c.id) : [...picked];
  const isPicked = (id: string) => allMatching || picked.has(id);
  const pageAllPicked = companies.length > 0 && companies.every((c) => isPicked(c.id));
  const clear = () => {
    setPicked(new Set());
    setAllMatching(false);
  };
  const toggle = (ids: string[], on: boolean) => {
    const next = new Set(allMatching ? matching.map((c) => c.id) : picked);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    setAllMatching(false);
    setPicked(next);
  };

  // A guess for the dialog; archive_companies() decides (it also counts Won and Lost opportunities).
  const factsById = new Map([...matching, ...companies].map((c) => [c.id, c]));
  const blocked = selectedIds.filter((id) => {
    const c = factsById.get(id);
    return !!c && (c.contactCount > 0 || c.openOpps > 0);
  }).length;
  const toDelete = selectedIds.length - blocked;

  const applyDelete = async () => {
    setBusy(true);
    const supabase = createClient();
    let deleted = 0;
    let skipped = 0;
    for (const ids of chunk(selectedIds, BATCH)) {
      const { data, error } = await supabase.rpc("archive_companies", { p_ids: ids });
      if (error) {
        setBusy(false);
        toast.error(getFriendlyErrorMessage(error));
        router.refresh();
        return;
      }
      const r = data as { deleted: number; skipped: number };
      deleted += r.deleted;
      skipped += r.skipped;
    }
    setBusy(false);
    setConfirming(false);
    clear();
    toast.success(`${noun(deleted)} deleted${skipped ? `, ${skipped.toLocaleString()} skipped` : ""}.`);
    router.refresh();
  };

  const num = (field: string, label: string) => (
    <TableHead variant="solid" className="text-right">
      <SortableHeader variant="solid" field={field} label={label} align="right" />
    </TableHead>
  );
  return (
    <>
    <Table stacked>
      <TableHeader variant="solid">
        <TableRow className="border-b-0 hover:bg-transparent">
          {canDelete && (
            <TableHead variant="solid" className="w-11">
              <Checkbox
                checked={pageAllPicked}
                onCheckedChange={(c) => toggle(companies.map((x) => x.id), !!c)}
                aria-label="Select all on this page"
                className="border-white/50 data-[state=checked]:border-secondary-400 data-[state=checked]:bg-secondary-400"
              />
            </TableHead>
          )}
          <TableHead variant="solid"><SortableHeader variant="solid" field="name" label="Company Name" /></TableHead>
          <TableHead variant="solid">Website</TableHead>
          <TableHead variant="solid"><SortableHeader variant="solid" field="industry" label="Industry" /></TableHead>
          {num("employees", "Employees")}
          {num("value", "Prospect Value")}
          <TableHead variant="solid" className="text-right">Opportunities Value</TableHead>
          {num("contacts", "Contacts")}
          {num("open", "Open opps")}
          <TableHead variant="solid"><SortableHeader variant="solid" field="city" label="City" /></TableHead>
          <TableHead variant="solid">State</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {companies.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={canDelete ? 11 : 10} className="py-8 text-center text-neutral-500">
              No companies match these filters.
            </TableCell>
          </TableRow>
        ) : (
          companies.map((c) => (
            <TableRow key={c.id} selected={canDelete && isPicked(c.id)}>
              {canDelete && (
                <TableCell label="Select">
                  <Checkbox checked={isPicked(c.id)} onCheckedChange={(on) => toggle([c.id], !!on)} aria-label={`Select ${c.name}`} />
                </TableCell>
              )}
              <TableCell label="Company" className="font-medium text-neutral-800">
                <Link href={`/companies/${c.id}`} className="block hover:underline">
                  {c.name}
                </Link>
              </TableCell>
              <TableCell label="Website" className="max-w-[200px] truncate whitespace-nowrap">
                {c.website ? (
                  <a href={c.website} target="_blank" rel="noreferrer" className="text-primary-700 hover:underline">
                    {c.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                  </a>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell label="Industry" className="whitespace-nowrap">{c.industry ?? "—"}</TableCell>
              <TableCell label="Employees" className="text-right tabular-nums">{c.employees || "—"}</TableCell>
              <TableCell label="Prospect Value" className="text-right">
                <span className="inline-flex items-center justify-end gap-2">
                  <span aria-hidden="true" className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-neutral-100 lg:block">
                    <span
                      className="block h-full rounded-full bg-secondary-600"
                      style={{ width: `${Math.round((c.prospectValue / maxValue) * 100)}%` }}
                    />
                  </span>
                  <span className="inline-block min-w-[6.5em] text-right font-semibold tabular-nums text-primary-900">
                    {usd.format(c.prospectValue)}
                  </span>
                </span>
              </TableCell>
              <TableCell label="Opportunities Value" className="text-right tabular-nums text-neutral-600">
                {usd.format(c.prospectValue * 3)}
              </TableCell>
              <TableCell label="Contacts" className="text-right tabular-nums">{c.contactCount}</TableCell>
              <TableCell label="Open opps" className="text-right tabular-nums">{c.openOpps}</TableCell>
              <TableCell label="City" className="whitespace-nowrap">{c.city ?? "—"}</TableCell>
              <TableCell label="State" className="whitespace-nowrap">{c.state ?? "—"}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>

    {canDelete && selectedIds.length > 0 && (
      <>
        {/* Room for the floating bar, so it never covers the last rows. */}
        <div aria-hidden="true" className="h-16" />
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">
          <div
            role="region"
            aria-label="Bulk actions"
            className="pointer-events-auto flex w-full max-w-[920px] flex-wrap items-center gap-x-1 gap-y-2 rounded-xl bg-[linear-gradient(135deg,var(--color-primary-900),var(--color-primary-700)_60%,var(--color-secondary-800))] px-3 py-2 shadow-[0_20px_40px_-16px_rgba(2,20,50,0.6)]"
          >
            <span className="mr-1 text-body-sm font-semibold tabular-nums text-white">{selectedIds.length.toLocaleString()} selected</span>
            {!allMatching && matching.length > selectedIds.length && (
              <button type="button" onClick={() => setAllMatching(true)} className="mr-2 text-body-sm font-semibold text-secondary-300 hover:underline">
                Select all {matching.length.toLocaleString()}
              </button>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirming(true)}
              aria-label="Delete selected companies"
              className="h-8 gap-1.5 px-2.5 text-body-sm text-error-300 hover:bg-error-400/20 hover:text-error-200"
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
            <button
              type="button"
              onClick={clear}
              aria-label="Clear selection"
              className="ml-auto flex size-8 items-center justify-center rounded-md text-white/70 hover:bg-white/15 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      </>
    )}

    <Dialog open={confirming} onOpenChange={(o) => !o && !busy && setConfirming(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {noun(toDelete)}?</DialogTitle>
        </DialogHeader>
        <p className="text-body text-neutral-600">
          They&apos;ll be removed from Companies, search and every total, but kept on record. If a contact from one of them is
          added or imported later, it comes back with its earlier details.
        </p>
        {blocked > 0 && (
          <p className="mt-3 rounded-md bg-neutral-100 px-3 py-2 text-body-sm text-neutral-700">
            {noun(blocked)} {blocked === 1 ? "is" : "are"} skipped: {blocked === 1 ? "it still has" : "they still have"} contacts
            or opportunities.
          </p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void applyDelete()} disabled={toDelete === 0 || busy}>
            {busy ? "Deleting…" : `Delete ${noun(toDelete)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
