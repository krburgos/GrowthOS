import { Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SortableHeader } from "@/components/ui/sortable-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import type { ContactListRow } from "@/lib/contacts/types";
import { statusBadgeVariant } from "@/lib/contacts/status-badge";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Contacts — GrowthOS" };

const SORT_COLUMNS: Record<string, string> = {
  name: "full_name",
  company: "companies(name)",
  status: "contact_statuses(name)",
  owner: "users(full_name)",
  employee_size: "companies(company_size)",
  city: "companies(city)",
  state: "companies(state)",
  updated_at: "updated_at",
};

/**
 * App Flow §4.4, D1 — Contacts List. Server-driven sort (searchParams)
 * over a direct RLS-protected query, per Backend Schema §11 (no API
 * route needed for a plain read).
 */
export default async function ContactsListPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { sort, dir } = await searchParams;
  const sortColumn = SORT_COLUMNS[sort ?? "updated_at"] ?? "updated_at";
  const ascending = dir !== "desc";

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("contacts")
    .select(
      "id, full_name, title, email, phone, status_id, contact_statuses(name), company_id, companies(name, city, state, company_size), owner_id, users(full_name), updated_at"
    )
    .eq("account_id", user.account_id)
    .is("archived_at", null)
    .order(sortColumn, { ascending, referencedTable: sortColumn.includes("(") ? sortColumn.split("(")[0] : undefined })
    .limit(100);

  const contacts = (rows ?? []) as unknown as ContactListRow[];

  // Last Activity Date (App Flow §4.4, D1): not part of SORT_COLUMNS yet —
  // Milestone 8 is what actually lets users log activities, so there's no
  // real data to sort by until then. Displayed now via a follow-up
  // aggregate query since it isn't a plain contacts column.
  if (contacts.length > 0) {
    const { data: activityRows } = await supabase
      .from("activities")
      .select("contact_id, occurred_at")
      .in(
        "contact_id",
        contacts.map((c) => c.id)
      )
      .order("occurred_at", { ascending: false });

    const lastActivityByContact = new Map<string, string>();
    for (const row of activityRows ?? []) {
      if (row.contact_id && !lastActivityByContact.has(row.contact_id)) {
        lastActivityByContact.set(row.contact_id, row.occurred_at);
      }
    }
    for (const c of contacts) {
      c.last_activity_at = lastActivityByContact.get(c.id) ?? null;
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-h1 text-primary-900">Contacts</h1>
        <div className="flex gap-3">
          <Button variant="secondary" asChild>
            <Link href="/contacts/import">Import Contacts</Link>
          </Button>
          <Button asChild>
            <Link href="/contacts/new">Add Contact</Link>
          </Button>
        </div>
      </div>

      {contacts.length === 0 ? (
        <EmptyState icon={Users} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><SortableHeader field="name" label="Name" /></TableHead>
              <TableHead><SortableHeader field="company" label="Company" /></TableHead>
              <TableHead><SortableHeader field="status" label="Status" /></TableHead>
              <TableHead><SortableHeader field="owner" label="Owner" /></TableHead>
              <TableHead><SortableHeader field="employee_size" label="Employee Size" /></TableHead>
              <TableHead>Last Activity Date</TableHead>
              <TableHead><SortableHeader field="city" label="Company City" /></TableHead>
              <TableHead><SortableHeader field="state" label="Company State" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((c) => (
              <TableRow key={c.id} className="cursor-pointer">
                <TableCell className="font-medium text-neutral-800">
                  <Link href={`/contacts/${c.id}`} className="block">
                    {c.full_name}
                  </Link>
                </TableCell>
                <TableCell>{c.companies?.name ?? "—"}</TableCell>
                <TableCell>
                  {c.contact_statuses && (
                    <Badge variant={statusBadgeVariant(c.contact_statuses.name)}>
                      {c.contact_statuses.name}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{c.users?.full_name ?? "Unassigned"}</TableCell>
                <TableCell>{c.companies?.company_size ?? "—"}</TableCell>
                <TableCell>
                  {c.last_activity_at ? new Date(c.last_activity_at).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell>{c.companies?.city ?? "—"}</TableCell>
                <TableCell>{c.companies?.state ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
