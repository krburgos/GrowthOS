import { Building2 } from "lucide-react";
import type { Metadata } from "next";

import { CompaniesTable, type CompanyRow } from "@/components/companies/companies-table";
import { CompaniesToolbar } from "@/components/companies/companies-toolbar";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoTip } from "@/components/ui/info-tip";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { employeesOf, prospectValue, usdShort } from "@/lib/companies/value";
import { parsePagination } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Companies — GrowthMission" };

/** Lower bounds for the Employees filter. */
const EMPLOYEE_BANDS = ["1", "10", "50", "100", "250"];

/**
 * Companies List (App Flow D5). Client-confirmed addition (2026-09-08):
 * same field set as Contact Detail's Company card, no Add Company —
 * companies are created only through Add Contact / Import.
 *
 * Client-confirmed redesign (2026-10-14, approved mockup "CRM Pages
 * Refresh"): a summary strip; Prospect Value ($200 × Employees × 12) and
 * Opportunities Value (3×) on every row, with the table **sorted by
 * Prospect Value, highest first** by default; an Open opps count; and
 * search plus Industry / State / Employees / Has-open-opportunity filters.
 *
 * Everything is filtered and sorted here, on the full set, before the
 * page slice (as the Contacts-count sort already required, 2026-09-15),
 * so a filter or sort is never applied to one page only. Employees is
 * free text in the schema, so it sorts numerically in JS rather than by
 * `.order()`, which would put "100" before "20".
 */
export default async function CompaniesListPage({
  searchParams,
}: {
  searchParams: Promise<{
    sort?: string;
    dir?: string;
    page?: string;
    pageSize?: string;
    q?: string;
    industry?: string;
    state?: string;
    min?: string;
    open?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { sort = "value", dir, q, industry, state, min, open, ...pageParams } = await searchParams;
  // Prospect Value and the counts read best highest first; names A to Z.
  const descending = dir ? dir === "desc" : sort === "value" || sort === "contacts" || sort === "employees" || sort === "open";
  const { page, pageSize, from, to } = parsePagination(pageParams);

  const supabase = await createClient();
  const [{ data: companies }, { data: contactRows }, { data: oppRows }] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, website, industry, company_size, city, state, created_at")
      .eq("account_id", user.account_id)
      .is("archived_at", null),
    supabase
      .from("contacts")
      .select("company_id")
      .eq("account_id", user.account_id)
      .is("archived_at", null)
      .not("company_id", "is", null),
    supabase
      .from("opportunities")
      .select("company_id, opportunity_stages!inner(stage_group)")
      .eq("account_id", user.account_id)
      .eq("opportunity_stages.stage_group", "open")
      .not("company_id", "is", null),
  ]);

  const tally = (list: { company_id: string | null }[] | null) => {
    const m = new Map<string, number>();
    for (const r of list ?? []) if (r.company_id) m.set(r.company_id, (m.get(r.company_id) ?? 0) + 1);
    return m;
  };
  const contactsBy = tally(contactRows);
  const openBy = tally(oppRows as { company_id: string | null }[] | null);

  const all: CompanyRow[] = (companies ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    website: c.website,
    industry: c.industry,
    city: c.city,
    state: c.state,
    employees: employeesOf(c.company_size),
    prospectValue: prospectValue(c.company_size),
    contactCount: contactsBy.get(c.id) ?? 0,
    openOpps: openBy.get(c.id) ?? 0,
  }));

  // ---- Summary strip, over every company ----
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
  const addedThisMonth = (companies ?? []).filter((c) => c.created_at >= monthStart).length;
  const totalValue = all.reduce((s, c) => s + c.prospectValue, 0);
  const withOpen = all.filter((c) => c.openOpps > 0).length;

  // ---- Filters, then sort, then the page slice ----
  const term = q?.trim().toLowerCase();
  const minEmployees = Number(min) || 0;
  const rows = all.filter(
    (c) =>
      (!term ||
        c.name.toLowerCase().includes(term) ||
        (c.website ?? "").toLowerCase().includes(term) ||
        (c.city ?? "").toLowerCase().includes(term)) &&
      (!industry || c.industry === industry) &&
      (!state || c.state === state) &&
      c.employees >= minEmployees &&
      (open !== "1" || c.openOpps > 0)
  );
  const key: Record<string, (c: CompanyRow) => number | string> = {
    name: (c) => c.name.toLowerCase(),
    industry: (c) => (c.industry ?? "￿").toLowerCase(),
    employees: (c) => c.employees,
    value: (c) => c.prospectValue,
    contacts: (c) => c.contactCount,
    open: (c) => c.openOpps,
    city: (c) => (c.city ?? "￿").toLowerCase(),
  };
  const by = key[sort] ?? key.value;
  rows.sort((a, b) => {
    const x = by(a);
    const y = by(b);
    const d = x < y ? -1 : x > y ? 1 : a.name.localeCompare(b.name);
    return descending ? -d : d;
  });

  const industries = [...new Set(all.map((c) => c.industry).filter((v): v is string => !!v))].sort();
  const states = [...new Set(all.map((c) => c.state).filter((v): v is string => !!v))].sort();

  return (
    <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-5 p-6 md:p-8">
      <div>
        <h1 className="text-h1 text-primary-900">Companies</h1>
        <p className="text-body text-neutral-500">
          Every organisation your contacts work for. Companies are created when you add or import a contact.
        </p>
      </div>

      {all.length === 0 ? (
        <EmptyState icon={Building2} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Companies" value={all.length.toLocaleString()} sub={`${addedThisMonth} Added This Month`} />
            <Tile
              label="Prospects Value"
              value={usdShort(totalValue)}
              sub={`${all.length.toLocaleString()} Companies`}
            />
            <Tile label="Opportunities Value" value={usdShort(totalValue * 3)} sub={`${all.length.toLocaleString()} Companies`} />
            <Tile
              label="With an Open Opportunity"
              value={withOpen.toLocaleString()}
              sub={`${all.length ? Math.round((withOpen / all.length) * 100) : 0}% of Companies`}
            />
          </div>

          <CompaniesToolbar industries={industries} states={states} bands={EMPLOYEE_BANDS} />

          <div>
            <CompaniesTable companies={rows.slice(from, to + 1)} maxValue={Math.max(1, ...rows.map((r) => r.prospectValue))} />
            <PaginationBar page={page} pageSize={pageSize} totalCount={rows.length} />
          </div>
        </>
      )}
    </main>
  );
}

function Tile({ label, tip, value, sub }: { label: string; tip?: string; value: string; sub: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-primary-100 bg-white px-4 py-3 shadow-lift">
      <span className="flex items-center gap-1.5 text-caption text-neutral-500">
        {label}
        {tip && <InfoTip text={tip} label={`About ${label}`} />}
      </span>
      <span className="text-h3 font-bold tabular-nums text-primary-900">{value}</span>
      <span className="text-caption tabular-nums text-neutral-500">{sub}</span>
    </div>
  );
}
