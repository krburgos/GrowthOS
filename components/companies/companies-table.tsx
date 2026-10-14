import Link from "next/link";

import { SortableHeader } from "@/components/ui/sortable-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usd } from "@/lib/companies/value";

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
 */
export function CompaniesTable({ companies, maxValue }: { companies: CompanyRow[]; maxValue: number }) {
  const num = (field: string, label: string) => (
    <TableHead variant="solid" className="text-right">
      <SortableHeader variant="solid" field={field} label={label} align="right" />
    </TableHead>
  );
  return (
    <Table stacked>
      <TableHeader variant="solid">
        <TableRow className="border-b-0 hover:bg-transparent">
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
            <TableCell colSpan={10} className="py-8 text-center text-neutral-500">
              No companies match these filters.
            </TableCell>
          </TableRow>
        ) : (
          companies.map((c) => (
            <TableRow key={c.id}>
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
  );
}
