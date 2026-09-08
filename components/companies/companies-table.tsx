"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { SortableHeader } from "@/components/ui/sortable-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface CompanyRow {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  company_size: string | null;
  city: string | null;
  state: string | null;
  contactCount: number;
}

/**
 * Design System §8.5, client-confirmed addition (Companies page,
 * 2026-09-08) — same shell as Lists Index: navy-header table, radius-lg
 * card border, server-driven sort via `SortableHeader` (URL search
 * params, same pattern as Lists/Contacts/Opportunities), and a
 * client-side name search above it filtering whatever page of
 * already-sorted rows the server sent down.
 */
export function CompaniesTable({ companies }: { companies: CompanyRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => c.name.toLowerCase().includes(q));
  }, [companies, query]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-full max-w-xs self-end">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search companies…"
          className="pl-9"
          aria-label="Search companies"
        />
      </div>

      <Table>
        <TableHeader variant="solid">
          <TableRow className="border-b-0 hover:bg-transparent">
            <TableHead variant="solid"><SortableHeader variant="solid" field="name" label="Company Name" /></TableHead>
            <TableHead variant="solid">Website</TableHead>
            <TableHead variant="solid"><SortableHeader variant="solid" field="industry" label="Industry" /></TableHead>
            <TableHead variant="solid"><SortableHeader variant="solid" field="employees" label="Employees" /></TableHead>
            <TableHead variant="solid"><SortableHeader variant="solid" field="city" label="City" /></TableHead>
            <TableHead variant="solid">State</TableHead>
            <TableHead variant="solid"><SortableHeader variant="solid" field="contacts" label="Contacts" /></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={7} className="py-8 text-center text-neutral-500">
                No companies match &ldquo;{query}&rdquo;.
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium text-neutral-800">
                  <Link href={`/companies/${c.id}`} className="block">
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {c.website ? (
                    <a href={c.website} target="_blank" rel="noreferrer" className="text-primary-700 hover:underline">
                      {c.website}
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">{c.industry ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{c.company_size ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{c.city ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{c.state ?? "—"}</TableCell>
                <TableCell className="tabular-nums">{c.contactCount}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
