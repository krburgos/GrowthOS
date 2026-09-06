"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ListActionsMenu } from "@/components/lists/list-actions-menu";
import { Input } from "@/components/ui/input";
import { SortableHeader } from "@/components/ui/sortable-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface ListRow {
  id: string;
  name: string;
  memberCount: number;
  created_at: string;
  bounced: number;
  unsubscribed: number;
}

/**
 * Design System §8.5, client-confirmed modernization pass ("Concept A —
 * Refined table"): member/bounced/unsubscribed counts read as centered,
 * tabular-nums figures rather than left-aligned bare numbers, and a
 * zero reads as quiet neutral-400 instead of the same weight as a real
 * count (bounced/unsubscribed are 0 for nearly every list today). A
 * client-side name search sits above the table — with only a handful
 * of lists per account this doesn't need the server-side sort's
 * "tens of thousands of rows" treatment (PRD §6.1); it filters
 * whatever page of already-sorted rows the server sent down.
 */
export function ListsTable({ lists, canEdit }: { lists: ListRow[]; canEdit: boolean }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lists;
    return lists.filter((l) => l.name.toLowerCase().includes(q));
  }, [lists, query]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-full max-w-xs self-end">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search lists…"
          className="pl-9"
          aria-label="Search lists"
        />
      </div>

      <Table>
        <TableHeader variant="solid">
          <TableRow className="border-b-0 hover:bg-transparent">
            <TableHead variant="solid"><SortableHeader variant="solid" field="name" label="Name" /></TableHead>
            <TableHead variant="solid" className="text-center">
              <div className="flex justify-center"><SortableHeader variant="solid" field="contacts" label="Contacts" /></div>
            </TableHead>
            <TableHead variant="solid" className="text-center">
              <div className="flex justify-center"><SortableHeader variant="solid" field="created_at" label="Date Added" /></div>
            </TableHead>
            <TableHead variant="solid" className="text-center">
              <div className="flex justify-center"><SortableHeader variant="solid" field="bounced" label="Bounced" /></div>
            </TableHead>
            <TableHead variant="solid" className="text-center">
              <div className="flex justify-center"><SortableHeader variant="solid" field="unsubscribed" label="Unsubscribed" /></div>
            </TableHead>
            {canEdit && <TableHead variant="solid" className="text-center">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={canEdit ? 6 : 5} className="py-8 text-center text-neutral-500">
                No lists match &ldquo;{query}&rdquo;.
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((list) => (
              <TableRow key={list.id}>
                <TableCell className="font-medium text-neutral-800">
                  <Link href={`/lists/${list.id}`} className="block">
                    {list.name}
                  </Link>
                </TableCell>
                <TableCell className="text-center tabular-nums">{list.memberCount}</TableCell>
                <TableCell className="text-center text-neutral-500">
                  {new Date(list.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className={cn("text-center tabular-nums", list.bounced === 0 && "text-neutral-400")}>
                  {list.bounced}
                </TableCell>
                <TableCell className={cn("text-center tabular-nums", list.unsubscribed === 0 && "text-neutral-400")}>
                  {list.unsubscribed}
                </TableCell>
                {canEdit && (
                  <TableCell className="text-center">
                    <ListActionsMenu listId={list.id} listName={list.name} />
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
