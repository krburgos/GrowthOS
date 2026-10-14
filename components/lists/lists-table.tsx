"use client";

import { LayoutGrid, ListChecks, Rows3, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ListActionsMenu } from "@/components/lists/list-actions-menu";
import { Input } from "@/components/ui/input";
import { SortableHeader } from "@/components/ui/sortable-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usd, usdShort } from "@/lib/companies/value";
import { cn } from "@/lib/utils";

export interface ListRow {
  id: string;
  name: string;
  memberCount: number;
  created_at: string;
  active: number;
  bounced: number;
  unsubscribed: number;
  /** $200 × Employees × 12 over the companies on the list, each once. */
  prospectValue: number;
}

const VIEW_KEY = "growthmission.lists.view";

/**
 * Lists Index (client-confirmed redesign, 2026-10-14, "CRM Pages
 * Refresh"): cards by default, a Table one click away, and a search over
 * the lists on this page. The choice of view is remembered per browser,
 * the same way the sidebar remembers being collapsed.
 *
 * Each list shows a health bar: active (cyan), unsubscribed (amber) and
 * bounced (grey), with the counts written out beside it so the colours are
 * never the only way to read it. In the table, numbers are right-aligned
 * under right-aligned headers.
 */
export function ListsBoard({ lists, canEdit }: { lists: ListRow[]; canEdit: boolean }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"cards" | "table">("cards");

  useEffect(() => {
    try {
      if (window.localStorage.getItem(VIEW_KEY) === "table") setView("table");
    } catch {
      /* storage unavailable: stay on cards */
    }
  }, []);
  const choose = (v: "cards" | "table") => {
    setView(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? lists.filter((l) => l.name.toLowerCase().includes(q)) : lists;
  }, [lists, query]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search lists"
            className="h-9 pl-9"
            aria-label="Search lists"
          />
        </div>
        <div role="group" aria-label="Layout" className="ml-auto flex rounded-md border border-neutral-200 bg-neutral-50 p-1 shadow-inner">
          {(
            [
              ["cards", "Cards", LayoutGrid],
              ["table", "Table", Rows3],
            ] as const
          ).map(([v, label, Icon]) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => choose(v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded px-3 py-1 text-body-sm font-medium transition-colors",
                view === v ? "bg-white text-primary-800 shadow-sm" : "text-neutral-500 hover:text-neutral-800"
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-neutral-200 bg-white py-10 text-center text-body-sm text-neutral-500">
          No lists match &ldquo;{query}&rdquo;.
        </p>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((l) => (
            <ListCard key={l.id} list={l} canEdit={canEdit} />
          ))}
        </div>
      ) : (
        <Table stacked>
          <TableHeader variant="solid">
            <TableRow className="border-b-0 hover:bg-transparent">
              <TableHead variant="solid"><SortableHeader variant="solid" field="name" label="List" /></TableHead>
              <Num field="contacts" label="Contacts" />
              <Num field="value" label="Prospect Value" />
              <TableHead variant="solid">Health</TableHead>
              <Num field="active" label="Active" />
              <Num field="unsubscribed" label="Unsubscribed" />
              <Num field="bounced" label="Bounced" />
              <TableHead variant="solid"><SortableHeader variant="solid" field="created_at" label="Added" /></TableHead>
              {canEdit && (
                <TableHead variant="solid" className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((l) => (
              <TableRow key={l.id}>
                <TableCell label="List" className="font-medium text-neutral-800">
                  <Link href={`/lists/${l.id}`} className="block hover:underline">
                    {l.name}
                  </Link>
                </TableCell>
                <TableCell label="Contacts" className="text-right font-semibold tabular-nums">{l.memberCount}</TableCell>
                <TableCell label="Prospect Value" className="text-right font-semibold tabular-nums text-primary-900">
                  {usd.format(l.prospectValue)}
                </TableCell>
                <TableCell label="Health">
                  <Health list={l} className="w-28" />
                </TableCell>
                <TableCell label="Active" className="text-right tabular-nums">{l.active}</TableCell>
                <TableCell label="Unsubscribed" className={cn("text-right tabular-nums", l.unsubscribed === 0 && "text-neutral-400")}>
                  {l.unsubscribed}
                </TableCell>
                <TableCell label="Bounced" className={cn("text-right tabular-nums", l.bounced === 0 && "text-neutral-400")}>
                  {l.bounced}
                </TableCell>
                <TableCell label="Added" className="whitespace-nowrap text-neutral-500">
                  {new Date(l.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </TableCell>
                {canEdit && (
                  <TableCell className="text-center">
                    <ListActionsMenu listId={l.id} listName={l.name} />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function Num({ field, label }: { field: string; label: string }) {
  return (
    <TableHead variant="solid" className="text-right">
      <SortableHeader variant="solid" field={field} label={label} align="right" />
    </TableHead>
  );
}

function Health({ list: l, className }: { list: ListRow; className?: string }) {
  const total = Math.max(l.memberCount, 1);
  return (
    <span aria-hidden="true" className={cn("flex h-2 gap-0.5 overflow-hidden rounded-full bg-neutral-100", className)}>
      {l.active > 0 && <span className="h-full bg-secondary-600" style={{ width: `${(l.active / total) * 100}%` }} />}
      {l.unsubscribed > 0 && <span className="h-full bg-warning-600" style={{ width: `${(l.unsubscribed / total) * 100}%` }} />}
      {l.bounced > 0 && <span className="h-full bg-neutral-400" style={{ width: `${(l.bounced / total) * 100}%` }} />}
    </span>
  );
}

function ListCard({ list: l, canEdit }: { list: ListRow; canEdit: boolean }) {
  return (
    <div className="relative flex flex-col gap-3 rounded-xl border border-primary-100 bg-white p-4 shadow-lift transition-colors hover:border-primary-200">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
          <ListChecks className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          {/* Stretched link: the whole card opens the list, except the menu. */}
          <Link
            href={`/lists/${l.id}`}
            className="block truncate text-body font-semibold text-primary-900 after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-secondary-500"
          >
            {l.name}
          </Link>
          <p className="text-caption text-neutral-500">
            Added {new Date(l.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
        {canEdit && (
          <div className="relative z-10">
            <ListActionsMenu listId={l.id} listName={l.name} />
          </div>
        )}
      </div>

      <div className="flex items-end justify-between gap-3">
        <p className="text-h2 font-bold leading-none tabular-nums text-primary-900">
          {l.memberCount.toLocaleString()}
          <span className="ml-1 text-body-sm font-medium text-neutral-500">{l.memberCount === 1 ? "Contact" : "Contacts"}</span>
        </p>
        <p className="text-right">
          <span className="block text-body font-bold tabular-nums text-primary-900">{usdShort(l.prospectValue)}</span>
          <span className="block text-caption text-neutral-500">Prospect Value</span>
        </p>
      </div>

      <Health list={l} />
      <p className="flex flex-wrap gap-x-3.5 gap-y-1 text-caption tabular-nums text-neutral-600">
        <Legend tone="bg-secondary-600" n={l.active} label="Active" />
        <Legend tone="bg-warning-600" n={l.unsubscribed} label="Unsubscribed" />
        <Legend tone="bg-neutral-400" n={l.bounced} label="Bounced" />
      </p>
    </div>
  );
}

function Legend({ tone, n, label }: { tone: string; n: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={cn("size-2 rounded-sm", tone)} />
      {n} {label}
    </span>
  );
}
