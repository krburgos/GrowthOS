import { Building2 } from "lucide-react";
import type { Metadata } from "next";

import { CompaniesTable, type CompanyRow } from "@/components/companies/companies-table";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Companies — GrowthOS" };

const SORT_COLUMNS: Record<string, string> = {
  name: "name",
  industry: "industry",
  employees: "company_size",
  city: "city",
};

/**
 * Client-confirmed addition (2026-09-08): the Implementation Plan's
 * Milestone 6 originally called for "companies list/detail screens,"
 * but App Flow never specced one and it was never built — the
 * merge-companies flow lived inline on Contact Detail instead (see
 * that dialog's own doc comment). This reopens that gap rather than
 * inventing new scope: same field set already exposed on Contact
 * Detail's Company card (Design System §8.5), no new columns.
 * "Contacts" per row is a live count, computed here rather than
 * stored — an N+1 per-company query would be wasteful, so every
 * account contact's company_id is fetched once and reduced in JS.
 */
export default async function CompaniesListPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { sort, dir } = await searchParams;
  const sortColumn = SORT_COLUMNS[sort ?? "name"] ?? "name";
  const ascending = dir !== "desc";

  const supabase = await createClient();
  const [{ data: companies }, { data: contactRows }] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, website, industry, company_size, city, state")
      .eq("account_id", user.account_id)
      .is("archived_at", null)
      .order(sortColumn, { ascending, nullsFirst: false }),
    supabase
      .from("contacts")
      .select("company_id")
      .eq("account_id", user.account_id)
      .is("archived_at", null)
      .not("company_id", "is", null),
  ]);

  const countByCompany = new Map<string, number>();
  for (const row of contactRows ?? []) {
    if (!row.company_id) continue;
    countByCompany.set(row.company_id, (countByCompany.get(row.company_id) ?? 0) + 1);
  }

  const rows: CompanyRow[] = (companies ?? []).map((c) => ({
    ...c,
    contactCount: countByCompany.get(c.id) ?? 0,
  }));

  if (sort === "contacts") {
    rows.sort((a, b) => (ascending ? a.contactCount - b.contactCount : b.contactCount - a.contactCount));
  }

  return (
    <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-h1 text-primary-900">Companies</h1>
      </div>

      {rows.length === 0 ? <EmptyState icon={Building2} /> : <CompaniesTable companies={rows} />}
    </main>
  );
}
